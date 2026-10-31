import { formatarData, type Aviso } from '@shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { usePessoas } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Etiqueta, Modal, Pagina } from '../../componentes';
import { hoje } from '../../util/hoje';

const PUBLICO: Record<Aviso['publico'], string> = { todos: 'Todos', gestores: 'Gestores', bolsistas: 'Bolsistas', pessoas: 'Pessoas específicas' };

function AvisoForm({ aviso, aoFechar }: { aviso: Aviso; aoFechar: () => void }) {
  const pessoas = usePessoas();
  const salvar = useMutacao('avisos.salvar', ['avisos.listar']);
  const [a, setA] = useState(aviso);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Modal
      aberto
      titulo={aviso.id ? 'Editar aviso' : 'Novo aviso'}
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
              try {
                await salvar.mutateAsync(a);
                aoFechar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Publicar aviso
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <Campo rotulo="Título">{(id) => <input id={id} className="cc-entrada" value={a.titulo} onChange={(e) => setA({ ...a, titulo: e.target.value })} />}</Campo>
        <Campo rotulo="Texto">{(id) => <textarea id={id} className="cc-entrada" value={a.texto} onChange={(e) => setA({ ...a, texto: e.target.value })} />}</Campo>
        <div className="grade-2">
          <Campo rotulo="Para quem">
            {(id) => (
              <select id={id} className="cc-entrada" value={a.publico} onChange={(e) => setA({ ...a, publico: e.target.value as Aviso['publico'] })}>
                {Object.entries(PUBLICO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Válido até (opcional)" ajuda="Depois desta data o aviso some sozinho.">
            {(id) => <input id={id} className="cc-entrada" type="date" value={a.validoAte ?? ''} onChange={(e) => setA({ ...a, validoAte: e.target.value || null })} />}
          </Campo>
        </div>
        {a.publico === 'pessoas' && (
          <Campo rotulo="Pessoas">
            {(id) => (
              <select
                id={id}
                className="cc-entrada"
                multiple
                style={{ minHeight: 160 }}
                value={a.pessoasIds}
                onChange={(e) => setA({ ...a, pessoasIds: [...e.target.selectedOptions].map((o) => o.value) })}
              >
                {pessoas.lista.filter((p) => p.ativo).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        )}
        <div className="linha">
          <label className="cc-caixa">
            <input type="checkbox" checked={a.fixado} onChange={(e) => setA({ ...a, fixado: e.target.checked })} /> Fixar no topo
          </label>
          <label className="cc-caixa">
            <input type="checkbox" checked={a.pedeConfirmacao} onChange={(e) => setA({ ...a, pedeConfirmacao: e.target.checked })} /> Pedir confirmação de leitura
          </label>
        </div>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

export function Mural() {
  const eu = useEu();
  const q = useConsulta('avisos.listar', null);
  const pessoas = usePessoas();
  const [filtro, setFiltro] = useState('');
  const [editando, setEditando] = useState<Aviso | null>(null);
  if (q.isLoading) return <Carregando />;
  const avisos = (q.data ?? []).filter((a) => !filtro || a.publico === filtro);
  const novo = (): Aviso => ({
    id: '', titulo: '', texto: '', publico: 'todos', pessoasIds: [], fixado: false, validoAte: null, pedeConfirmacao: false,
    autorId: eu.id, criadoEm: '', leituras: [],
  });

  return (
    <Pagina
      titulo="Mural de avisos"
      subtitulo="Comunicados para a equipe. Avisos automáticos do sistema vão para o sininho."
      acoes={
        <Botao variante="primario" onClick={() => setEditando(novo())}>
          <Plus size={16} aria-hidden /> Novo aviso
        </Botao>
      }
    >
      <select className="cc-entrada" style={{ width: 'auto' }} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por público">
        <option value="">Todos os públicos</option>
        {Object.entries(PUBLICO).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {!avisos.length && <EstadoVazio titulo="Nenhum aviso" />}
      {avisos.map((a) => {
        const expirado = !!a.validoAte && a.validoAte < hoje();
        return (
          <Cartao
            key={a.id}
            destaque={a.fixado}
            titulo={
              <div>
                <h2>{a.titulo}</h2>
                <span className="linha pequeno texto-2">
                  {formatarData(a.criadoEm.slice(0, 10))} · {pessoas.pessoa.get(a.autorId)?.nome.split(' ')[0] ?? ''}
                  <Etiqueta tom="info">{PUBLICO[a.publico]}</Etiqueta>
                  {a.fixado && <Etiqueta tom="destaque">Fixado</Etiqueta>}
                  {a.validoAte && <Etiqueta tom={expirado ? 'neutro' : 'aviso'}>{expirado ? 'Expirado' : `Até ${formatarData(a.validoAte)}`}</Etiqueta>}
                </span>
              </div>
            }
            acoes={
              <Botao tamanho="pequeno" onClick={() => setEditando(a)}>
                Editar
              </Botao>
            }
          >
            <div className="pilha-2">
              <p style={{ whiteSpace: 'pre-line' }}>{a.texto}</p>
              {a.pedeConfirmacao && (
                <details>
                  <summary className="pequeno texto-2" style={{ cursor: 'pointer' }}>
                    {a.leituras.length} leitura(s) confirmada(s)
                  </summary>
                  <p className="pequeno">{a.leituras.map((id) => pessoas.pessoa.get(id)?.nome ?? id).join(', ') || '—'}</p>
                </details>
              )}
            </div>
          </Cartao>
        );
      })}
      {editando && <AvisoForm aviso={editando} aoFechar={() => setEditando(null)} />}
    </Pagina>
  );
}
