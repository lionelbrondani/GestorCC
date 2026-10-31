import { estoqueCritico, formatarReais, pode, type AlmoxItem } from '@shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { ImportarAlmox } from './ImportarAlmox';
import { Alerta, Botao, Campo, Carregando, Etiqueta, Modal, Tabela } from '../../componentes';

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const INVALIDAR = ['almox.listar', 'almox.movimentos', 'historico.listar'] as const;

function ModalItem({ item, aoFechar }: { item: AlmoxItem; aoFechar: () => void }) {
  const salvar = useMutacao('almox.salvarItem', [...INVALIDAR]);
  const [i, setI] = useState(item);
  const [erro, setErro] = useState<string | null>(null);
  const novo = !item.cod;
  const t = (k: keyof AlmoxItem) => ({ value: String(i[k] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setI({ ...i, [k]: e.target.value }) });
  return (
    <Modal
      aberto
      titulo={novo ? 'Novo item' : `Item ${item.cod}`}
      largura="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            carregando={salvar.isPending}
            onClick={async () => {
              setErro(null);
              if (!i.cod.trim() || !(i.nomeComum || i.nomeAlmox).trim()) return setErro('Informe código e nome.');
              try {
                await salvar.mutateAsync({ ...i, qtdMinima: Number(i.qtdMinima) || 0 });
                aoFechar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grade-2">
        <Campo rotulo="Código (4 dígitos)">{(id) => <input id={id} className="cc-entrada" disabled={!novo} {...t('cod')} />}</Campo>
        <Campo rotulo="Nome no almoxarifado">{(id) => <input id={id} className="cc-entrada" {...t('nomeAlmox')} />}</Campo>
        <Campo rotulo="Nome comum">{(id) => <input id={id} className="cc-entrada" {...t('nomeComum')} />}</Campo>
        <Campo rotulo="Categoria">{(id) => <input id={id} className="cc-entrada" {...t('categoria')} />}</Campo>
        <Campo rotulo="Unidade">{(id) => <input id={id} className="cc-entrada" {...t('unidade')} />}</Campo>
        <Campo rotulo="Sala">{(id) => <input id={id} className="cc-entrada" {...t('sala')} />}</Campo>
        <Campo rotulo="Valor unitário (R$)">
          {(id) => <input id={id} className="cc-entrada" type="number" step="0.01" value={i.valor / 100} onChange={(e) => setI({ ...i, valor: Math.round(Number(e.target.value) * 100) })} />}
        </Campo>
        <Campo rotulo="Estoque mínimo">{(id) => <input id={id} className="cc-entrada" type="number" {...t('qtdMinima')} />}</Campo>
        <Campo rotulo="Status">
          {(id) => (
            <select id={id} className="cc-entrada" value={i.status} onChange={(e) => setI({ ...i, status: e.target.value as AlmoxItem['status'] })}>
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          )}
        </Campo>
      </div>
      {novo && <p className="pequeno texto-2">O saldo inicial entra depois, por "Ajustar estoque".</p>}
      {erro && <Alerta tom="erro">{erro}</Alerta>}
    </Modal>
  );
}

function ModalAjuste({ item, aoFechar }: { item: AlmoxItem; aoFechar: () => void }) {
  const ajustar = useMutacao('almox.ajustar', [...INVALIDAR]);
  const [novoSaldo, setNovoSaldo] = useState(String(item.saldo));
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Modal
      aberto
      titulo={`Ajustar estoque · ${item.nomeComum || item.nomeAlmox}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            carregando={ajustar.isPending}
            onClick={async () => {
              setErro(null);
              try {
                await ajustar.mutateAsync({ cod: item.cod, qtd: Number(novoSaldo) - item.saldo, motivo });
                aoFechar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Registrar ajuste
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <p>
          Saldo atual: <strong>{item.saldo}</strong> {item.unidade}
        </p>
        <Campo rotulo="Saldo contado">{(id) => <input id={id} className="cc-entrada" type="number" min={0} value={novoSaldo} onChange={(e) => setNovoSaldo(e.target.value)} />}</Campo>
        <Campo rotulo="Motivo (obrigatório)">{(id) => <input id={id} className="cc-entrada" value={motivo} placeholder="Ex.: inventário de outubro" onChange={(e) => setMotivo(e.target.value)} />}</Campo>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

export function Estoque() {
  const eu = useEu();
  const q = useConsulta('almox.listar', null);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [sala, setSala] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [soCriticos, setSoCriticos] = useState(false);
  const [editando, setEditando] = useState<AlmoxItem | null>(null);
  const [ajustando, setAjustando] = useState<AlmoxItem | null>(null);
  if (q.isLoading || !q.data) return <Carregando />;
  const editar = pode(eu.permissoes, 'almoxEstoque', 'editar');
  const todos = q.data.itens;
  const categorias = [...new Set(todos.map((i) => i.categoria))].sort();
  const salas = [...new Set(todos.map((i) => i.sala).filter(Boolean))].sort();
  const termo = sem(busca.trim());
  const lista = todos
    .filter((i) => (!status || i.status === status) && (!categoria || i.categoria === categoria) && (!sala || i.sala === sala))
    .filter((i) => !soCriticos || estoqueCritico(i))
    .filter((i) => !termo || sem(`${i.cod} ${i.nomeComum} ${i.nomeAlmox}`).includes(termo))
    .sort((a, b) => Number(estoqueCritico(b)) - Number(estoqueCritico(a)) || (a.nomeComum || a.nomeAlmox).localeCompare(b.nomeComum || b.nomeAlmox, 'pt-BR'));
  const valorTotal = lista.reduce((acc, i) => acc + i.valor * Math.max(0, i.saldo), 0);

  return (
    <div className="pilha">
      <div className="linha" style={{ alignItems: 'flex-end' }}>
        <Campo rotulo="Buscar">{(id) => <input id={id} className="cc-entrada" placeholder="Código ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />}</Campo>
        <Campo rotulo="Categoria">
          {(id) => (
            <select id={id} className="cc-entrada" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Sala">
          {(id) => (
            <select id={id} className="cc-entrada" value={sala} onChange={(e) => setSala(e.target.value)}>
              <option value="">Todas</option>
              {salas.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Status">
          {(id) => (
            <select id={id} className="cc-entrada" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          )}
        </Campo>
        <label className="cc-caixa" style={{ minHeight: 40 }}>
          <input type="checkbox" checked={soCriticos} onChange={(e) => setSoCriticos(e.target.checked)} /> Só críticos
        </label>
        {editar && (
          <Botao
            variante="primario"
            onClick={() => setEditando({ cod: '', nomeAlmox: '', nomeComum: '', unidade: 'Unidade', valor: 0, categoria: 'Outros', qtdMinima: 0, sala: '', status: 'Ativo', saldo: 0 })}
          >
            <Plus size={16} aria-hidden /> Novo item
          </Botao>
        )}
        {editar && <ImportarAlmox />}
      </div>
      <p className="pequeno texto-2">
        {lista.length} itens · valor em estoque {formatarReais(valorTotal)}
      </p>
      <Tabela
        colunas={[
          { chave: 'cod', titulo: 'Cód.' },
          {
            chave: 'nome',
            titulo: 'Item',
            render: (i) => (
              <span className="pilha-2" style={{ gap: 0 }}>
                <strong>{i.nomeComum || i.nomeAlmox}</strong>
                {i.nomeComum && <span className="pequeno texto-3">{i.nomeAlmox}</span>}
              </span>
            ),
          },
          { chave: 'categoria', titulo: 'Categoria' },
          { chave: 'sala', titulo: 'Sala' },
          {
            chave: 'saldo',
            titulo: 'Saldo',
            alinhar: 'direita',
            render: (i) => (
              <span className="linha" style={{ justifyContent: 'flex-end' }}>
                {estoqueCritico(i) && <Etiqueta tom="erro">Crítico</Etiqueta>}
                <strong className="numero">{i.saldo}</strong>
                <span className="pequeno texto-3">/ mín. {i.qtdMinima}</span>
              </span>
            ),
          },
          { chave: 'valor', titulo: 'Valor un.', alinhar: 'direita', render: (i) => formatarReais(i.valor) },
          {
            chave: 'acoes',
            titulo: '',
            render: (i) =>
              editar && (
                <span className="linha">
                  <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEditando(i)}>
                    Editar
                  </Botao>
                  <Botao tamanho="pequeno" variante="fantasma" onClick={() => setAjustando(i)}>
                    Ajustar
                  </Botao>
                </span>
              ),
          },
        ]}
        linhas={lista}
        chaveLinha={(i) => i.cod}
        vazio="Nenhum item com estes filtros."
      />
      {editando && <ModalItem item={editando} aoFechar={() => setEditando(null)} />}
      {ajustando && <ModalAjuste item={ajustando} aoFechar={() => setAjustando(null)} />}
    </div>
  );
}
