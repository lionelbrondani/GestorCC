import { pode, type Config, type Feriado } from '@shared';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApi } from '../../api/cliente';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Alerta, Botao, Campo, Carregando, Cartao, Modal, Pagina } from '../../componentes';
import { useQueryClient } from '@tanstack/react-query';
import { feriadosNacionais } from '../../util/brasilapi';
import { hoje } from '../../util/hoje';
import { useEu } from '../../auth/SessaoContexto';
import { CartaoAgendaSetor } from '../pessoal/AgendaGoogle';
import { CartaoSaude } from './CartaoSaude';

function Feriados() {
  const atual = Number(hoje().slice(0, 4));
  const [ano, setAno] = useState(atual);
  const [importando, setImportando] = useState(false);
  const q = useConsulta('feriados.listar', { ano });
  const salvar = useMutacao('feriados.salvar', ['feriados.listar']);
  const [lista, setLista] = useState<Feriado[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setLista(q.data ?? []), [q.data]);

  // nacionais pela BrasilAPI; a pessoa confere e salva (municipais e recessos da UFSM continuam à mão)
  async function importar() {
    setMsg(null);
    setImportando(true);
    const nacionais = await feriadosNacionais(ano);
    setImportando(false);
    if (!nacionais) return setMsg('Não foi possível buscar os feriados agora. Tente de novo ou adicione à mão.');
    const novos = nacionais.filter((n) => !lista.some((f) => f.data === n.data));
    setLista([...lista, ...novos].sort((a, b) => a.data.localeCompare(b.data)));
    setMsg(novos.length ? `${novos.length} ${novos.length === 1 ? 'feriado nacional incluído' : 'feriados nacionais incluídos'}. Confira e clique em Salvar feriados.` : 'Os feriados nacionais já estavam na lista.');
  }

  return (
    <Cartao
      titulo={`Feriados de ${ano}`}
      acoes={
        <>
          <select className="cc-entrada" aria-label="Ano dos feriados" style={{ width: 'auto' }} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            <option value={atual}>{atual}</option>
            <option value={atual + 1}>{atual + 1}</option>
          </select>
          <Botao tamanho="pequeno" carregando={importando} onClick={importar}>
            <Download size={14} aria-hidden /> Importar feriados nacionais
          </Botao>
          <Botao tamanho="pequeno" onClick={() => setLista([...lista, { data: `${ano}-01-01`, nome: '' }])}>
            <Plus size={14} aria-hidden /> Adicionar
          </Botao>
        </>
      }
    >
      <div className="pilha-2">
        {lista.map((f, i) => (
          <div key={i} className="linha">
            <input className="cc-entrada" type="date" style={{ width: 170 }} aria-label="Data do feriado" value={f.data} onChange={(e) => setLista(lista.map((x, k) => (k === i ? { ...x, data: e.target.value } : x)))} />
            <input className="cc-entrada" style={{ flex: 1, minWidth: 160 }} aria-label="Nome do feriado" value={f.nome} onChange={(e) => setLista(lista.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} />
            <Botao tamanho="pequeno" variante="fantasma" aria-label="Remover feriado" onClick={() => setLista(lista.filter((_, k) => k !== i))}>
              <Trash2 size={14} />
            </Botao>
          </div>
        ))}
        <div className="linha">
          <Botao
            variante="primario"
            carregando={salvar.isPending}
            onClick={async () => {
              await salvar.mutateAsync({ ano, feriados: [...lista].sort((a, b) => a.data.localeCompare(b.data)) });
              setMsg('Feriados salvos.');
            }}
          >
            Salvar feriados
          </Botao>
          {msg && <span className="pequeno texto-2">{msg}</span>}
        </div>
      </div>
    </Cartao>
  );
}

export function Configuracoes() {
  const q = useConsulta('config.obter', null);
  const administra = pode(useEu().permissoes, 'configuracoes', 'editar');
  const salvar = useMutacao('config.salvar', ['config.obter']);
  const api = useApi() as ReturnType<typeof useApi> & { restaurar?: () => void };
  const qc = useQueryClient();
  const [c, setC] = useState<Config | null>(null);
  const [msg, setMsg] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [restaurar, setRestaurar] = useState(false);
  useEffect(() => {
    if (q.data) setC(q.data);
  }, [q.data]);
  if (q.isLoading || !c) return <Carregando />;
  const t = (k: keyof Config) => ({ value: String(c[k] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value }) });
  const n = (k: keyof Config) => ({ value: Number(c[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) }) });

  return (
    <Pagina
      titulo="Configurações"
      acoes={
        <Botao
          variante="primario"
          carregando={salvar.isPending}
          onClick={async () => {
            try {
              await salvar.mutateAsync(c);
              setMsg({ tom: 'sucesso', texto: 'Configurações salvas.' });
            } catch (e) {
              setMsg({ tom: 'erro', texto: (e as Error).message });
            }
          }}
        >
          Salvar
        </Botao>
      }
    >
      {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
      {administra && <CartaoSaude />}
      <div className="grade-2">
        <Cartao titulo="Escalas e pagamentos">
          <div className="pilha">
            <Campo rotulo="Diária padrão (R$)">
              {(id) => <input id={id} className="cc-entrada" type="number" step="0.01" value={c.diariaPadrao / 100} onChange={(e) => setC({ ...c, diariaPadrao: Math.round(Number(e.target.value) * 100) })} />}
            </Campo>
            <Campo rotulo="Vagas de bolsistas por sessão (padrão)">{(id) => <input id={id} className="cc-entrada" type="number" {...n('vagasBolsistasPadrao')} />}</Campo>
            <Campo rotulo="Vagas de servidores por sessão (padrão)">{(id) => <input id={id} className="cc-entrada" type="number" {...n('vagasServidoresPadrao')} />}</Campo>
            <Campo rotulo="Mínimo de experientes por sessão">{(id) => <input id={id} className="cc-entrada" type="number" {...n('minimoExperientesPadrao')} />}</Campo>
            <Campo rotulo="Edital (ficha de indicação)">{(id) => <input id={id} className="cc-entrada" {...t('edital')} />}</Campo>
            <Campo rotulo="Iniciativa / fonte do recurso">{(id) => <input id={id} className="cc-entrada" {...t('iniciativa')} />}</Campo>
          </div>
        </Cartao>
        <Cartao titulo="FUNDEP e e-mails">
          <div className="pilha">
            <Campo rotulo="Número do projeto FUNDEP">{(id) => <input id={id} className="cc-entrada" {...t('projetoFundep')} />}</Campo>
            <Campo rotulo="Destinatários da FUNDEP" ajuda="Separe por vírgula.">
              {(id) => (
                <input id={id} className="cc-entrada" value={c.destinatariosFundep.join(', ')} onChange={(e) => setC({ ...c, destinatariosFundep: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              )}
            </Campo>
            <Campo rotulo="Assinatura dos e-mails">{(id) => <textarea id={id} className="cc-entrada" {...t('assinaturaEmail')} />}</Campo>
          </div>
        </Cartao>
        <Cartao titulo="Busca inteligente">
          <div className="pilha">
            <Campo
              rotulo="Informações do setor"
              ajuda="Vão junto com as perguntas ao Gemini, para ele responder dúvidas sobre o Centro de Convenções (capacidade, endereço, horários, contatos do setor). Não escreva dados pessoais: o plano gratuito do Gemini pode usar o texto."
            >
              {(id) => <textarea id={id} className="cc-entrada" rows={5} maxLength={2000} {...t('informacoesSetor')} />}
            </Campo>
            <Campo rotulo="Limite de perguntas por pessoa/dia">{(id) => <input id={id} className="cc-entrada" type="number" {...n('limitePerguntasDia')} />}</Campo>
          </div>
        </Cartao>
        <Cartao titulo="Dados pessoais (LGPD)">
          <div className="pilha">
            <p className="pequeno texto-2" style={{ margin: 0 }}>
              Quantos dias depois do evento os dados pessoais são apagados (0 = nunca). A limpeza roda junto com o backup diário e fica no histórico.
            </p>
            <Campo rotulo="Nomes e matrículas das cortesias (dias)">{(id) => <input id={id} className="cc-entrada" type="number" min={0} {...n('diasGuardarCortesias')} />}</Campo>
            <Campo rotulo="Dados do responsável da ficha técnica (dias)">{(id) => <input id={id} className="cc-entrada" type="number" min={0} {...n('diasGuardarFicha')} />}</Campo>
          </div>
        </Cartao>
        <Cartao titulo="Links dos formulários">
          <div className="pilha-2">
            {c.linksFormularios.map((l, i) => (
              <div key={i} className="linha">
                <input className="cc-entrada" style={{ flex: 1, minWidth: 140 }} aria-label="Nome do formulário" value={l.nome} onChange={(e) => setC({ ...c, linksFormularios: c.linksFormularios.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) })} />
                <input className="cc-entrada" style={{ flex: 2, minWidth: 180 }} aria-label="Link do formulário" value={l.url} onChange={(e) => setC({ ...c, linksFormularios: c.linksFormularios.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} />
                <Botao tamanho="pequeno" variante="fantasma" aria-label="Remover link" onClick={() => setC({ ...c, linksFormularios: c.linksFormularios.filter((_, k) => k !== i) })}>
                  <Trash2 size={14} />
                </Botao>
              </div>
            ))}
            <div>
              <Botao tamanho="pequeno" onClick={() => setC({ ...c, linksFormularios: [...c.linksFormularios, { nome: '', url: '' }] })}>
                <Plus size={14} aria-hidden /> Adicionar link
              </Botao>
            </div>
          </div>
        </Cartao>
        <Feriados />
      </div>
      <CartaoAgendaSetor />
      <Cartao titulo="Protótipo">
        <div className="linha-entre">
          <span className="texto-2">Volta todos os dados fictícios ao estado inicial (desfaz o que foi testado).</span>
          <Botao variante="perigo" onClick={() => setRestaurar(true)}>
            Restaurar dados de exemplo
          </Botao>
        </div>
      </Cartao>
      <Modal
        aberto={restaurar}
        titulo="Restaurar dados de exemplo"
        aoFechar={() => setRestaurar(false)}
        rodape={
          <>
            <Botao onClick={() => setRestaurar(false)}>Cancelar</Botao>
            <Botao
              variante="perigo"
              onClick={async () => {
                api.restaurar?.();
                await qc.invalidateQueries();
                setRestaurar(false);
                setMsg({ tom: 'sucesso', texto: 'Dados de exemplo restaurados.' });
              }}
            >
              Restaurar
            </Botao>
          </>
        }
      >
        <p>Tudo o que foi criado ou alterado no protótipo será apagado deste navegador.</p>
      </Modal>
    </Pagina>
  );
}
