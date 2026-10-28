import {
  ATIVIDADES_PEDIDO,
  CATEGORIAS_PEDIDO,
  errosDoPedido,
  ESPACOS_PEDIDO,
  INDICACOES_ETARIAS,
  NOMES_ATIVIDADE,
  textoPrivacidade,
  type DiaPedido,
  type PedidoDatasDados,
} from '@shared';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApi } from '../../api/cliente';
import { useConsulta } from '../../api/hooks';
import { Alerta, Botao, Campo, Cartao } from '../../componentes';
import { consultarCep, consultarCnpj } from '../../util/brasilapi';
import { hoje } from '../../util/hoje';
import { AvisoPrivacidade } from '../ficha/AvisoPrivacidade';
import { AntiRobo } from './AntiRobo';
import '../ficha/ficha.css';
import './pedido.css';

const vazio = (): PedidoDatasDados => ({
  evento: '', categoria: '', categoriaOutra: '', dias: [{ data: '', atividade: 'evento', inicio: '', fim: '' }], observacoesHorarios: '',
  programacao: '', indicacao: '', pessoasEnvolvidas: null, espacos: [], espacoOutro: '', publico: null, informacoes: '',
  solicitante: { razaoSocial: '', documento: '', endereco: '', cep: '', inscricaoEstadual: '', inscricaoMunicipal: '' },
  responsavel: { nome: '', cpf: '', email: '', telefone: '' },
});

const numero = (v: string) => (v === '' ? null : Math.max(0, Math.round(Number(v))));

function Moldura({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="ficha-pagina">
      <header className="ficha-topo">
        <img src="/logo-cc-branco.png" alt="Centro de Convenções PRE | UFSM" />
        <strong>Pedido de data</strong>
      </header>
      <main className="ficha-conteudo pedido-pagina">
        {children}
        {rodape}
      </main>
    </div>
  );
}

/** Página pública (sem login) para pedir data no Centro de Convenções: as perguntas do antigo formulário do Google. */
export function PedidoDeData() {
  const api = useApi();
  const config = useConsulta('pedido.abrir', null);
  const [d, setD] = useState<PedidoDatasDados>(vazio);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [tokenRobo, setTokenRobo] = useState('');
  const [site, setSite] = useState('');

  const erros = tentou ? errosDoPedido(d, hoje()) : [];
  const erro = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem ?? null;
  const mudar = (parte: Partial<PedidoDatasDados>) => setD((a) => ({ ...a, ...parte }));
  const mudarSolicitante = (parte: Partial<PedidoDatasDados['solicitante']>) => setD((a) => ({ ...a, solicitante: { ...a.solicitante, ...parte } }));
  const mudarResponsavel = (parte: Partial<PedidoDatasDados['responsavel']>) => setD((a) => ({ ...a, responsavel: { ...a.responsavel, ...parte } }));
  const mudarDia = (i: number, parte: Partial<DiaPedido>) => setD((a) => ({ ...a, dias: a.dias.map((x, k) => (k === i ? { ...x, ...parte } : x)) }));
  const alternarEspaco = (e: string) => mudar({ espacos: d.espacos.includes(e) ? d.espacos.filter((x) => x !== e) : [...d.espacos, e] });

  // CNPJ e CEP preenchem só o que ainda está vazio (BrasilAPI); fora do ar, a pessoa preenche à mão
  async function aoSairDoDocumento() {
    const r = await consultarCnpj(d.solicitante.documento);
    if (r) setD((a) => ({ ...a, solicitante: { ...a.solicitante, razaoSocial: a.solicitante.razaoSocial || r.razaoSocial, endereco: a.solicitante.endereco || r.endereco, cep: a.solicitante.cep || r.cep } }));
  }
  async function aoSairDoCep() {
    if (d.solicitante.endereco) return;
    const r = await consultarCep(d.solicitante.cep);
    if (r) mudarSolicitante({ endereco: r.endereco, cep: r.cep });
  }

  async function enviar() {
    setTentou(true);
    setFalha(null);
    const problemas = errosDoPedido(d, hoje());
    if (problemas.length) {
      setFalha(problemas.length === 1 ? 'Confira o campo marcado.' : `Confira os ${problemas.length} campos marcados.`);
      return;
    }
    setEnviando(true);
    try {
      const r = await api.chamar('pedido.enviar', { dados: d, ...(tokenRobo ? { antiRobo: tokenRobo } : {}), ...(site ? { site } : {}) });
      setProtocolo(r.protocolo);
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setFalha((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const aviso = config.data && <AvisoPrivacidade texto={textoPrivacidade('pedido', config.data.diasGuardarDados)} />;

  if (protocolo) {
    return (
      <Moldura rodape={aviso}>
        <Cartao destaque>
          <div className="pedido-enviado">
            <CheckCircle2 size={36} aria-hidden />
            <h1>Pedido enviado!</h1>
            <p>
              Protocolo <strong>{protocolo}</strong>. Guarde este número.
            </p>
            <p className="texto-2">O Centro de Convenções vai analisar as datas e responder pelo e-mail {d.responsavel.email}.</p>
          </div>
        </Cartao>
      </Moldura>
    );
  }

  const texto = (rotulo: string, campo: string, valor: string, aoMudar: (v: string) => void, extra: { ajuda?: string; tipo?: string; aoSair?: () => void } = {}) => (
    <Campo rotulo={rotulo} erro={erro(campo)} ajuda={extra.ajuda}>
      {(id) => <input id={id} className="cc-entrada" type={extra.tipo ?? 'text'} value={valor} onChange={(e) => aoMudar(e.target.value)} onBlur={extra.aoSair} />}
    </Campo>
  );

  return (
    <Moldura rodape={aviso}>
      <h1>Pedir data no Centro de Convenções</h1>
      <p className="texto-2" style={{ margin: 0 }}>
        Preencha os dados do evento, os dias e horários (inclua montagem, ensaios e desmontagem) e quem está pedindo. A resposta vem pelo e-mail informado.
      </p>

      <Cartao titulo="O evento">
        <div className="pilha">
          {texto('Nome do evento', 'evento', d.evento, (v) => mudar({ evento: v }))}
          <div className="grade-2">
            <Campo rotulo="Categoria do evento" erro={erro('categoria')}>
              {(id) => (
                <select id={id} className="cc-entrada" value={d.categoria} onChange={(e) => mudar({ categoria: e.target.value as PedidoDatasDados['categoria'] })}>
                  <option value="">Escolha…</option>
                  {CATEGORIAS_PEDIDO.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Indicação etária" erro={erro('indicacao')}>
              {(id) => (
                <select id={id} className="cc-entrada" value={d.indicacao} onChange={(e) => mudar({ indicacao: e.target.value as PedidoDatasDados['indicacao'] })}>
                  <option value="">Escolha…</option>
                  {INDICACOES_ETARIAS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
            </Campo>
          </div>
          {d.categoria === 'Outro' && texto('Qual categoria?', 'categoriaOutra', d.categoriaOutra, (v) => mudar({ categoriaOutra: v }))}
          <Campo rotulo="Programação do evento" erro={erro('programacao')}>
            {(id) => <textarea id={id} className="cc-entrada" rows={4} value={d.programacao} onChange={(e) => mudar({ programacao: e.target.value })} />}
          </Campo>
          <div className="grade-2">
            {texto('Público estimado', 'publico', d.publico === null ? '' : String(d.publico), (v) => mudar({ publico: numero(v) }), { tipo: 'number' })}
            {texto('Pessoas envolvidas', 'pessoasEnvolvidas', d.pessoasEnvolvidas === null ? '' : String(d.pessoasEnvolvidas), (v) => mudar({ pessoasEnvolvidas: numero(v) }), {
              tipo: 'number',
              ajuda: 'Toda a equipe de produção e artística.',
            })}
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Dias e horários">
        <div className="pilha">
          <p className="pequeno texto-2" style={{ margin: 0 }}>
            Um dia por linha. Inclua a montagem, os ensaios, a passagem de som e a desmontagem, se houver.
          </p>
          {erro('dias') && <Alerta tom="erro">{erro('dias')}</Alerta>}
          {d.dias.map((dia, i) => (
            <div key={i} className="pedido-dia">
              <input className="cc-entrada" type="date" min={hoje()} aria-label={`Data do dia ${i + 1}`} value={dia.data} onChange={(e) => mudarDia(i, { data: e.target.value })} />
              <select className="cc-entrada" aria-label={`Atividade do dia ${i + 1}`} value={dia.atividade} onChange={(e) => mudarDia(i, { atividade: e.target.value as DiaPedido['atividade'] })}>
                {ATIVIDADES_PEDIDO.map((a) => (
                  <option key={a} value={a}>
                    {NOMES_ATIVIDADE[a]}
                  </option>
                ))}
              </select>
              <input className="cc-entrada" type="time" aria-label={`Início do dia ${i + 1}`} value={dia.inicio} onChange={(e) => mudarDia(i, { inicio: e.target.value })} />
              <input className="cc-entrada" type="time" aria-label={`Fim do dia ${i + 1}`} value={dia.fim} onChange={(e) => mudarDia(i, { fim: e.target.value })} />
              {d.dias.length > 1 && (
                <Botao tamanho="pequeno" variante="fantasma" aria-label={`Remover dia ${i + 1}`} onClick={() => mudar({ dias: d.dias.filter((_, k) => k !== i) })}>
                  <Trash2 size={16} aria-hidden />
                </Botao>
              )}
              {[erro(`dias.${i}.data`), erro(`dias.${i}.inicio`), erro(`dias.${i}.fim`)].filter(Boolean).map((m) => (
                <span key={m} className="cc-campo-erro pedido-dia-erro">
                  {m}
                </span>
              ))}
            </div>
          ))}
          <div>
            <Botao tamanho="pequeno" onClick={() => mudar({ dias: [...d.dias, { data: d.dias.at(-1)?.data ?? '', atividade: 'evento', inicio: '', fim: '' }] })}>
              <Plus size={14} aria-hidden /> Adicionar dia
            </Botao>
          </div>
          <Campo rotulo="Observações sobre os horários (opcional)">
            {(id) => <textarea id={id} className="cc-entrada" rows={2} value={d.observacoesHorarios} onChange={(e) => mudar({ observacoesHorarios: e.target.value })} />}
          </Campo>
        </div>
      </Cartao>

      <Cartao titulo="Espaços do teatro">
        <div className="pilha-2">
          {erro('espacos') && <Alerta tom="erro">{erro('espacos')}</Alerta>}
          <div className="pedido-espacos">
            {ESPACOS_PEDIDO.map((e) => (
              <label key={e} className="cc-caixa">
                <input type="checkbox" checked={d.espacos.includes(e)} onChange={() => alternarEspaco(e)} />
                <span>{e}</span>
              </label>
            ))}
          </div>
          <div>
            <Botao tamanho="pequeno" variante="fantasma" onClick={() => mudar({ espacos: [...ESPACOS_PEDIDO] })}>
              Marcar todos os ambientes
            </Botao>
          </div>
          {texto('Outro espaço (opcional)', 'espacoOutro', d.espacoOutro, (v) => mudar({ espacoOutro: v }))}
        </div>
      </Cartao>

      <Cartao titulo="Quem está pedindo">
        <div className="grade-2">
          {texto('CNPJ (ou CPF)', 'solicitante.documento', d.solicitante.documento, (v) => mudarSolicitante({ documento: v }), {
            aoSair: aoSairDoDocumento,
            ajuda: 'Com o CNPJ, o nome e o endereço se preenchem sozinhos.',
          })}
          {texto('Nome jurídico', 'solicitante.razaoSocial', d.solicitante.razaoSocial, (v) => mudarSolicitante({ razaoSocial: v }))}
          {texto('Endereço completo', 'solicitante.endereco', d.solicitante.endereco, (v) => mudarSolicitante({ endereco: v }))}
          {texto('CEP', 'solicitante.cep', d.solicitante.cep, (v) => mudarSolicitante({ cep: v }), { aoSair: aoSairDoCep })}
          {texto('Inscrição estadual', 'solicitante.inscricaoEstadual', d.solicitante.inscricaoEstadual, (v) => mudarSolicitante({ inscricaoEstadual: v }), { ajuda: 'Ou "Isento".' })}
          {texto('Inscrição municipal', 'solicitante.inscricaoMunicipal', d.solicitante.inscricaoMunicipal, (v) => mudarSolicitante({ inscricaoMunicipal: v }), { ajuda: 'Ou "Isento".' })}
        </div>
      </Cartao>

      <Cartao titulo="Responsável pela solicitação">
        <div className="grade-2">
          {texto('Nome do responsável', 'responsavel.nome', d.responsavel.nome, (v) => mudarResponsavel({ nome: v }))}
          {texto('CPF do responsável', 'responsavel.cpf', d.responsavel.cpf, (v) => mudarResponsavel({ cpf: v }))}
          {texto('E-mail', 'responsavel.email', d.responsavel.email, (v) => mudarResponsavel({ email: v }), { tipo: 'email', ajuda: 'A resposta vem por aqui.' })}
          {texto('Telefone/WhatsApp', 'responsavel.telefone', d.responsavel.telefone, (v) => mudarResponsavel({ telefone: v }), { tipo: 'tel' })}
        </div>
      </Cartao>

      <Cartao>
        <div className="pilha">
          <Campo rotulo="Informações complementares (opcional)">
            {(id) => <textarea id={id} className="cc-entrada" rows={3} value={d.informacoes} onChange={(e) => mudar({ informacoes: e.target.value })} />}
          </Campo>
          {/* armadilha para robôs: escondida das pessoas e dos leitores de tela */}
          <div className="pedido-armadilha" aria-hidden="true">
            <label>
              Site
              <input tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} />
            </label>
          </div>
          <AntiRobo aoToken={setTokenRobo} />
          {falha && <Alerta tom="erro">{falha}</Alerta>}
          <Botao variante="primario" carregando={enviando} onClick={enviar}>
            Enviar pedido
          </Botao>
        </div>
      </Cartao>
    </Moldura>
  );
}
