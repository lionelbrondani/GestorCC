import {
  ATIVIDADES_PEDIDO,
  CATEGORIAS_PEDIDO,
  diaDaSemanaCurto,
  DO_SETOR,
  errosDoPedido,
  ESPACOS_PEDIDO,
  formatarData,
  INDICACOES_ETARIAS,
  NO_SETOR,
  NOMES_ATIVIDADE,
  SETOR,
  textoPrivacidade,
  type DataISO,
  type DiaPedido,
  type PedidoDatasDados,
  type SituacaoDia,
} from '@shared';
import { CheckCircle2, Mail, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useApi } from '../../api/cliente';
import { useConsulta } from '../../api/hooks';
import { Alerta, Botao, Campo, Cartao, Etiqueta } from '../../componentes';
import { consultarCep, consultarCnpj } from '../../util/brasilapi';
import { hoje } from '../../util/hoje';
import { AvisoPrivacidade } from '../ficha/AvisoPrivacidade';
import { AntiRobo } from './AntiRobo';
import { CalendarioDatas, limitesDoMes } from './CalendarioDatas';
import '../ficha/ficha.css';
import './pedido.css';

const vazio = (): PedidoDatasDados => ({
  evento: '', categoria: '', categoriaOutra: '', dias: [], observacoesHorarios: '',
  programacao: '', indicacao: '', pessoasEnvolvidas: null, espacos: [], espacoOutro: '', publico: null, informacoes: '',
  solicitante: { razaoSocial: '', documento: '', endereco: '', cep: '', inscricaoEstadual: '', inscricaoMunicipal: '' },
  responsavel: { nome: '', cpf: '', email: '', telefone: '' },
});

/** O preenchimento fica no próprio aparelho de quem pede (se a internet cair ou a página fechar); some ao enviar. */
const RASCUNHO = 'gestorcc-pedido-rascunho';

function lerRascunho(): PedidoDatasDados | null {
  try {
    const r = JSON.parse(localStorage.getItem(RASCUNHO) ?? 'null') as Partial<PedidoDatasDados> | null;
    if (!r || typeof r !== 'object') return null;
    const v = vazio();
    return { ...v, ...r, dias: Array.isArray(r.dias) ? r.dias : [], solicitante: { ...v.solicitante, ...r.solicitante }, responsavel: { ...v.responsavel, ...r.responsavel } };
  } catch {
    return null;
  }
}
function guardarRascunho(d: PedidoDatasDados | null) {
  try {
    if (!d || JSON.stringify(d) === JSON.stringify(vazio())) localStorage.removeItem(RASCUNHO);
    else localStorage.setItem(RASCUNHO, JSON.stringify(d));
  } catch {
    // navegador sem armazenamento: o formulário funciona do mesmo jeito
  }
}

const numero = (v: string) => (v === '' ? null : Math.max(0, Math.round(Number(v))));
const milhar = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ordenar = (dias: DiaPedido[]) => [...dias].sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));

function Moldura({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="ficha-pagina">
      <header className="ficha-topo">
        <img src="/logo-branco.png" alt={SETOR.logoAlt} />
        <strong>Pedido de data</strong>
      </header>
      <main className="ficha-conteudo pedido-pagina">
        {children}
        {rodape}
      </main>
    </div>
  );
}

/** Página pública (sem login) para pedir data no setor: as perguntas do antigo formulário do Google. */
export function PedidoDeData() {
  const api = useApi();
  const config = useConsulta('pedido.abrir', null);
  const [inicial] = useState(lerRascunho);
  const [d, setD] = useState<PedidoDatasDados>(() => inicial ?? vazio());
  const [recuperado, setRecuperado] = useState(!!inicial);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ protocolo: string; listaEspera: boolean } | null>(null);
  const [tokenRobo, setTokenRobo] = useState('');
  const [site, setSite] = useState('');
  const [mes, setMes] = useState(() => (inicial?.dias[0]?.data ?? hoje()).slice(0, 7));
  const calendario = useConsulta('pedido.calendario', limitesDoMes(mes));
  // a situação de cada dia já visto no calendário (para marcar os dias escolhidos de outros meses)
  const [situacoes, setSituacoes] = useState<Record<DataISO, SituacaoDia>>({});
  const [esperaEm, setEsperaEm] = useState<DataISO | null>(null);

  useEffect(() => {
    if (!enviado) guardarRascunho(d);
  }, [d, enviado]);
  useEffect(() => {
    const c = calendario.data;
    if (!c) return;
    const { de, ate } = limitesDoMes(mes);
    setSituacoes((s) => {
      const novo = { ...s };
      for (let dia = de; dia <= ate; dia = `${dia.slice(0, 8)}${String(Number(dia.slice(8)) + 1).padStart(2, '0')}`) novo[dia] = 'livre';
      for (const x of c.bloqueados) novo[x] = 'bloqueado';
      for (const x of c.ocupados) novo[x] = 'ocupado';
      return novo;
    });
  }, [calendario.data, mes]);

  const erros = tentou ? errosDoPedido(d, hoje()) : [];
  const erro = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem ?? null;
  const mudar = (parte: Partial<PedidoDatasDados>) => setD((a) => ({ ...a, ...parte }));
  const mudarSolicitante = (parte: Partial<PedidoDatasDados['solicitante']>) => setD((a) => ({ ...a, solicitante: { ...a.solicitante, ...parte } }));
  const mudarResponsavel = (parte: Partial<PedidoDatasDados['responsavel']>) => setD((a) => ({ ...a, responsavel: { ...a.responsavel, ...parte } }));
  const mudarDia = (i: number, parte: Partial<DiaPedido>) => setD((a) => ({ ...a, dias: a.dias.map((x, k) => (k === i ? { ...x, ...parte } : x)) }));
  const alternarEspaco = (e: string) => mudar({ espacos: d.espacos.includes(e) ? d.espacos.filter((x) => x !== e) : [...d.espacos, e] });
  const incluirDia = (data: DataISO) => setD((a) => ({ ...a, dias: ordenar([...a.dias, { data, atividade: 'evento', inicio: '', fim: '' }]) }));
  const escolhidos = new Set(d.dias.map((x) => x.data));

  function escolher(data: DataISO, situacao: SituacaoDia) {
    setEsperaEm(null);
    if (escolhidos.has(data)) return mudar({ dias: d.dias.filter((x) => x.data !== data) });
    if (situacao === 'ocupado') return setEsperaEm(data);
    incluirDia(data);
  }

  function limpar() {
    setD(vazio());
    setTentou(false);
    setFalha(null);
    setRecuperado(false);
    guardarRascunho(null);
  }

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
      guardarRascunho(null);
      setEnviado(r);
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setFalha((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const aviso = config.data && <AvisoPrivacidade texto={textoPrivacidade('pedido', config.data.diasGuardarDados)} />;
  const lotacao = config.data?.lotacao;

  if (enviado) {
    const datas = [...escolhidos].sort().map(formatarData).join(', ');
    const assunto = `Pedido de data ${enviado.protocolo}: ${d.evento}`;
    const corpo = `Olá! Fiz o pedido de data ${enviado.protocolo} para o evento "${d.evento}", nos dias ${datas}.\n\n${d.responsavel.nome}\n${d.responsavel.telefone}`;
    return (
      <Moldura rodape={aviso}>
        <Cartao destaque>
          <div className="pedido-enviado">
            <CheckCircle2 size={36} aria-hidden />
            <h1>Pedido recebido!</h1>
            <p>
              Protocolo <strong>{enviado.protocolo}</strong>. Guarde este número.
            </p>
            {enviado.listaEspera && <Alerta tom="info">Algum dia pedido já tinha evento marcado: o pedido entrou na lista de espera para esse dia.</Alerta>}
            <Alerta tom="aviso">
              <strong>O pedido ainda não garante a reserva da data.</strong> A confirmação vem {DO_SETOR}, pelo e-mail {d.responsavel.email}.
            </Alerta>
            <p>
              Envie agora um e-mail para <strong>{SETOR.email}</strong> avisando que fez a solicitação.
            </p>
            <a className="cc-botao" data-variante="primario" href={`mailto:${SETOR.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`}>
              <Mail size={16} aria-hidden /> Escrever o e-mail
            </a>
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
      <h1>Pedir data {NO_SETOR}</h1>
      <p className="texto-2" style={{ margin: 0 }}>
        Preencha os dados do evento, escolha os dias no calendário (inclua montagem, ensaios e desmontagem) e diga quem está pedindo. A resposta vem pelo e-mail
        informado.
      </p>
      {recuperado && <Alerta tom="info">Recuperamos o que você tinha preenchido neste aparelho. Confira e continue de onde parou.</Alerta>}

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
          {!!lotacao && d.publico !== null && d.publico > lotacao && <Alerta tom="aviso">A lotação máxima do teatro é de {milhar(lotacao)} lugares.</Alerta>}
        </div>
      </Cartao>

      <Cartao titulo="Dias e horários">
        <div className="pilha">
          <p className="pequeno texto-2" style={{ margin: 0 }}>
            Toque nos dias no calendário. Inclua a montagem, os ensaios, a passagem de som e a desmontagem, se houver.
          </p>
          <CalendarioDatas
            mes={mes}
            aoMudarMes={setMes}
            ocupados={new Set(calendario.data?.ocupados ?? [])}
            bloqueados={new Set(calendario.data?.bloqueados ?? [])}
            escolhidos={escolhidos}
            minimo={hoje()}
            carregando={!calendario.data}
            aoEscolher={escolher}
          />
          {esperaEm && (
            <Alerta tom="aviso">
              <div className="pilha-2">
                <span>{formatarData(esperaEm)} já tem evento marcado. Quer entrar na lista de espera para este dia?</span>
                <div className="linha">
                  <Botao
                    tamanho="pequeno"
                    variante="primario"
                    onClick={() => {
                      incluirDia(esperaEm);
                      setEsperaEm(null);
                    }}
                  >
                    Entrar na lista de espera
                  </Botao>
                  <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEsperaEm(null)}>
                    Escolher outro dia
                  </Botao>
                </div>
              </div>
            </Alerta>
          )}
          {erro('dias') && <Alerta tom="erro">{erro('dias')}</Alerta>}
          {d.dias.map((dia, i) => (
            <div key={i} className="pedido-dia" role="group" aria-label={`Dia ${i + 1}: ${formatarData(dia.data)}`}>
              <strong className="pedido-dia-data">
                {diaDaSemanaCurto(dia.data)} {formatarData(dia.data)}
              </strong>
              <select className="cc-entrada" aria-label={`Atividade do dia ${i + 1}`} value={dia.atividade} onChange={(e) => mudarDia(i, { atividade: e.target.value as DiaPedido['atividade'] })}>
                {ATIVIDADES_PEDIDO.map((a) => (
                  <option key={a} value={a}>
                    {NOMES_ATIVIDADE[a]}
                  </option>
                ))}
              </select>
              <input className="cc-entrada" type="time" aria-label={`Início do dia ${i + 1}`} value={dia.inicio} onChange={(e) => mudarDia(i, { inicio: e.target.value })} />
              <input className="cc-entrada" type="time" aria-label={`Fim do dia ${i + 1}`} value={dia.fim} onChange={(e) => mudarDia(i, { fim: e.target.value })} />
              <Botao tamanho="pequeno" variante="fantasma" aria-label={`Outra atividade em ${formatarData(dia.data)}`} title="Outra atividade neste dia" onClick={() => incluirDia(dia.data)}>
                <Plus size={16} aria-hidden />
              </Botao>
              <Botao tamanho="pequeno" variante="fantasma" aria-label={`Remover dia ${i + 1}`} onClick={() => mudar({ dias: d.dias.filter((_, k) => k !== i) })}>
                <Trash2 size={16} aria-hidden />
              </Botao>
              {situacoes[dia.data] === 'ocupado' && (
                <span className="pedido-dia-aviso">
                  <Etiqueta tom="aviso">Lista de espera</Etiqueta>
                </span>
              )}
              {situacoes[dia.data] === 'bloqueado' && (
                <span className="pedido-dia-aviso">Esta data está bloqueada. Você pode pedir mesmo assim, mas o pedido pode não ser aceito.</span>
              )}
              {[erro(`dias.${i}.data`), erro(`dias.${i}.inicio`), erro(`dias.${i}.fim`)].filter(Boolean).map((m) => (
                <span key={m} className="cc-campo-erro pedido-dia-erro">
                  {m}
                </span>
              ))}
            </div>
          ))}
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
          <p className="pequeno texto-2" style={{ margin: 0 }}>
            O que você preenche fica guardado neste aparelho até o envio, se a internet cair ou a página fechar.
          </p>
          <div className="linha">
            <Botao variante="primario" carregando={enviando} onClick={enviar}>
              Enviar pedido
            </Botao>
            <Botao variante="fantasma" onClick={limpar}>
              Limpar formulário
            </Botao>
          </div>
        </div>
      </Cartao>
    </Moldura>
  );
}
