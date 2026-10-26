import {
  CAPACIDADE_TEATRO,
  descreverLugares,
  DESTINOS_ALIMENTOS,
  errosDaFicha,
  ETAPAS_FICHA,
  formatarData,
  LINK_REGULAMENTO,
  LOCAIS_COFFEE,
  LOCAIS_FICHA,
  MAX_ANEXOS_FICHA,
  MAX_CAMARINS_COLETIVOS,
  MAX_CAMARINS_INDIVIDUAIS,
  TIPOS_EVENTO_FICHA,
  VINCULOS_RESPONSAVEL,
  type AnexoFicha,
  type EtapaFicha,
  type FichaPublica,
  type FichaTecnicaDados,
  type HorarioSessaoFicha,
} from '@shared';
import { Check, ChevronLeft, ChevronRight, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Alerta, BarraProgresso, Botao, Campo } from '../../componentes';
import { ListaNomes } from './ListaNomes';
import { corDoGrupo, MapaPoltronas } from './MapaPoltronas';
import { ResumoFicha } from './ResumoFicha';
import './ficha.css';

type Evento = FichaPublica['evento'];

interface Props {
  evento: Evento;
  inicial: FichaTecnicaDados;
  /** Produtor: cada etapa só avança completa e o fim é "Enviar". Gestor: corrige livremente e salva. */
  modo: 'produtor' | 'gestor';
  aoSalvar: (dados: FichaTecnicaDados, enviar: boolean) => Promise<unknown>;
  aoAnexar?: (arquivo: File) => Promise<AnexoFicha>;
  aoBaixarAnexo?: (a: AnexoFicha) => void;
  linkFolder?: string;
}

// ——— pedaços de formulário ———

function Opcoes<T extends string>({ nome, opcoes, valor, aoMudar }: { nome: string; opcoes: readonly T[]; valor: string; aoMudar: (v: T) => void }) {
  return (
    <div className="ficha-opcoes" role="radiogroup" aria-label={nome}>
      {opcoes.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={valor === o} className="ficha-opcao" onClick={() => aoMudar(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function SimNao({ nome, valor, aoMudar }: { nome: string; valor: boolean | null; aoMudar: (v: boolean) => void }) {
  return <Opcoes nome={nome} opcoes={['Sim', 'Não'] as const} valor={valor === null ? '' : valor ? 'Sim' : 'Não'} aoMudar={(v) => aoMudar(v === 'Sim')} />;
}

/** Pergunta com rótulo e erro, para grupos de botões (o Campo é para um input). */
function Pergunta({ titulo, ajuda, erro, children }: { titulo: string; ajuda?: ReactNode; erro?: string; children: ReactNode }) {
  return (
    <fieldset className="ficha-pergunta">
      <legend>{titulo}</legend>
      {ajuda && <div className="cc-campo-ajuda">{ajuda}</div>}
      {children}
      {erro && <span className="cc-campo-erro">{erro}</span>}
    </fieldset>
  );
}

function Quantidade({ nome, max, valor, aoMudar }: { nome: string; max: number; valor: number; aoMudar: (n: number) => void }) {
  return <Opcoes nome={nome} opcoes={Array.from({ length: max + 1 }, (_, i) => String(i))} valor={String(valor)} aoMudar={(v) => aoMudar(Number(v))} />;
}

const numero = (v: string) => (v === '' ? null : Math.max(0, Math.round(Number(v))));
const ajustarLista = (lista: string[], n: number) => Array.from({ length: n }, (_, i) => lista[i] ?? '');

// ——— formulário ———

export function FormularioFicha({ evento, inicial, modo, aoSalvar, aoAnexar, aoBaixarAnexo, linkFolder }: Props) {
  const [d, setD] = useState<FichaTecnicaDados>(() => preencherHorarios(inicial, evento));
  const [etapa, setEtapa] = useState(0);
  const [tentadas, setTentadas] = useState<Set<EtapaFicha>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [grupoAtivo, setGrupoAtivo] = useState(0);
  const [anexando, setAnexando] = useState(false);
  const topo = useRef<HTMLDivElement>(null);

  const sessoesBase = evento.sessoes.map((s) => ({ id: s.id, data: s.data }));
  const erros = errosDaFicha(d, sessoesBase);
  const atual = ETAPAS_FICHA[etapa];
  const ultima = etapa === ETAPAS_FICHA.length - 1;
  const mostrar = modo === 'gestor' || tentadas.has(atual.id);
  const erro = (campo: string) => (mostrar ? erros.find((e) => e.campo === campo)?.mensagem : undefined);
  const errosDa = (id: EtapaFicha) => erros.filter((e) => e.etapa === id);
  const mudar = (p: Partial<FichaTecnicaDados>) => setD((x) => ({ ...x, ...p }));
  const mudarResp = (p: Partial<FichaTecnicaDados['responsavel']>) => setD((x) => ({ ...x, responsavel: { ...x.responsavel, ...p } }));
  const mudarSessao = (i: number, p: Partial<HorarioSessaoFicha>) => setD((x) => ({ ...x, sessoes: x.sessoes.map((s, j) => (j === i ? { ...s, ...p } : s)) }));

  useEffect(() => {
    topo.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [etapa]);

  async function salvar(enviar: boolean, depois?: () => void) {
    setFalha(null);
    setSalvando(true);
    try {
      await aoSalvar(d, enviar);
      depois?.();
    } catch (e) {
      setFalha((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function irPara(i: number) {
    setTentadas((t) => new Set(t).add(atual.id));
    setEtapa(i);
  }

  function continuar() {
    setTentadas((t) => new Set(t).add(atual.id));
    if (modo === 'produtor' && errosDa(atual.id).length) {
      setFalha('Confira os campos destacados nesta etapa.');
      return;
    }
    void salvar(false, () => setEtapa((e) => e + 1));
  }

  async function anexar(arquivos: FileList | null) {
    if (!arquivos?.length || !aoAnexar) return;
    setFalha(null);
    setAnexando(true);
    try {
      const a = await aoAnexar(arquivos[0]);
      setD((x) => ({ ...x, anexos: [...x.anexos, a] }));
    } catch (e) {
      setFalha((e as Error).message);
    } finally {
      setAnexando(false);
    }
  }

  const nomeSessao = (id: string) => {
    const s = evento.sessoes.find((x) => x.id === id);
    return s ? `${formatarData(s.data)}${s.rotulo ? ` · ${s.rotulo}` : ''}` : 'Sessão';
  };

  const etapas: Record<EtapaFicha, ReactNode> = {
    evento: (
      <>
        <Campo rotulo="Nome do evento">{(id) => <input id={id} className="cc-entrada" value={evento.nome} readOnly />}</Campo>
        <Pergunta titulo="Tipo do evento" erro={erro('tipo')}>
          <Opcoes nome="Tipo do evento" opcoes={TIPOS_EVENTO_FICHA} valor={d.tipo} aoMudar={(tipo) => mudar({ tipo })} />
          {d.tipo === 'Outro' && (
            <Campo rotulo="Qual?" erro={erro('tipoOutro')}>
              {(id) => <input id={id} className="cc-entrada" value={d.tipoOutro} onChange={(e) => mudar({ tipoOutro: e.target.value })} />}
            </Campo>
          )}
        </Pergunta>
        <Alerta tom="info">
          <strong>Direitos autorais (ECAD):</strong> se o evento tiver música (DJ, banda ou som ambiente), apresente a guia do ECAD paga até 2 dias antes do
          início das atividades.
        </Alerta>
        <div className="grade-2">
          <Campo rotulo="Estimativa de público" ajuda={`O teatro comporta ${CAPACIDADE_TEATRO.toLocaleString('pt-BR')} pessoas.`} erro={erro('publico')}>
            {(id) => <input id={id} className="cc-entrada" type="number" inputMode="numeric" min={0} value={d.publico ?? ''} onChange={(e) => mudar({ publico: numero(e.target.value) })} />}
          </Campo>
          <Campo rotulo="Pessoas no elenco" erro={erro('elenco')}>
            {(id) => <input id={id} className="cc-entrada" type="number" inputMode="numeric" min={0} value={d.elenco ?? ''} onChange={(e) => mudar({ elenco: numero(e.target.value) })} />}
          </Campo>
        </div>
        <Campo rotulo="Sinopse ou programação (opcional)" ajuda="Descreva o projeto, a programação ou a sinopse. Se preferir, anexe o material abaixo.">
          {(id) => <textarea id={id} className="cc-entrada" rows={5} value={d.sinopse} onChange={(e) => mudar({ sinopse: e.target.value })} />}
        </Campo>
        {aoAnexar && (
          <div className="pilha-2">
            {d.anexos.map((a) => (
              <span key={a.id} className="ficha-anexo">
                <Paperclip size={14} aria-hidden /> {a.nome}
                <button type="button" className="link-botao" aria-label={`Remover ${a.nome}`} onClick={() => mudar({ anexos: d.anexos.filter((x) => x.id !== a.id) })}>
                  <X size={14} />
                </button>
              </span>
            ))}
            {d.anexos.length < MAX_ANEXOS_FICHA && (
              <label className="cc-botao" data-variante="secundario" data-tamanho="pequeno" aria-busy={anexando || undefined} style={{ alignSelf: 'flex-start' }}>
                {anexando ? <span className="cc-giro" aria-hidden /> : <Paperclip size={16} aria-hidden />} Anexar arquivo (PDF, imagem ou Word)
                <input type="file" className="visualmente-oculto" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => void anexar(e.target.files)} />
              </label>
            )}
          </div>
        )}
        {linkFolder && (
          <p className="pequeno texto-2" style={{ margin: 0 }}>
            Conheça o espaço, a estrutura e os serviços no{' '}
            <a href={linkFolder} target="_blank" rel="noreferrer">
              folder do Centro de Convenções
            </a>
            .
          </p>
        )}
      </>
    ),

    horarios: (
      <>
        <Alerta tom="info">
          <ul className="ficha-regras">
            <li>A entrada de materiais e o início dos trabalhos são liberados a partir das <strong>8h30</strong>.</li>
            <li>Todo o material (cenários e instrumentos) entra pela <strong>rampa lateral direita</strong> do prédio.</li>
            <li>Em eventos de um dia, a montagem e a desmontagem acontecem na mesma data do evento.</li>
          </ul>
        </Alerta>
        <div className="grade-2">
          <Campo rotulo="Início da montagem" erro={erro('montagem')}>
            {(id) => <input id={id} className="cc-entrada" type="datetime-local" value={d.montagem} onChange={(e) => mudar({ montagem: e.target.value })} />}
          </Campo>
          <Campo rotulo="Fim da montagem (opcional)" erro={erro('montagemFim')}>
            {(id) => <input id={id} className="cc-entrada" type="datetime-local" value={d.montagemFim} onChange={(e) => mudar({ montagemFim: e.target.value })} />}
          </Campo>
        </div>
        <Pergunta titulo="Haverá passagem de som?">
          <SimNao nome="Passagem de som" valor={d.passagemSom} aoMudar={(v) => mudar({ passagemSom: v, ...(v ? {} : { passagemInicio: '', passagemFim: '' }) })} />
          {d.passagemSom && (
            <div className="grade-2">
              <Campo rotulo="Início da passagem de som" erro={erro('passagemInicio')}>
                {(id) => <input id={id} className="cc-entrada" type="datetime-local" value={d.passagemInicio} onChange={(e) => mudar({ passagemInicio: e.target.value })} />}
              </Campo>
              <Campo rotulo="Fim da passagem de som" erro={erro('passagemFim')}>
                {(id) => <input id={id} className="cc-entrada" type="datetime-local" value={d.passagemFim} onChange={(e) => mudar({ passagemFim: e.target.value })} />}
              </Campo>
            </div>
          )}
        </Pergunta>
        {d.sessoes.map((h, i) => {
          const e = (c: string) => erro(`sessoes.${i}.${c}`);
          return (
            <fieldset key={h.sessaoId} className="ficha-sessao">
              <legend>{evento.sessoes.length > 1 ? `Sessão de ${nomeSessao(h.sessaoId)}` : `Dia do evento: ${nomeSessao(h.sessaoId)}`}</legend>
              <div className="ficha-horas">
                <Campo rotulo="Abertura das portas" erro={e('portas')}>
                  {(id) => <input id={id} className="cc-entrada" type="time" value={h.portas} onChange={(ev) => mudarSessao(i, { portas: ev.target.value })} />}
                </Campo>
                <Campo rotulo="Início" erro={e('inicio')}>
                  {(id) => <input id={id} className="cc-entrada" type="time" value={h.inicio} onChange={(ev) => mudarSessao(i, { inicio: ev.target.value })} />}
                </Campo>
                <Campo rotulo="Término" erro={e('fim')}>
                  {(id) => <input id={id} className="cc-entrada" type="time" value={h.fim} onChange={(ev) => mudarSessao(i, { fim: ev.target.value })} />}
                </Campo>
              </div>
              <Pergunta titulo="Haverá intervalo?" erro={e('intervalo')}>
                <SimNao nome="Haverá intervalo?" valor={h.intervalo} aoMudar={(v) => mudarSessao(i, { intervalo: v, ...(v ? {} : { intervaloInicio: '', intervaloFim: '' }) })} />
              </Pergunta>
              {h.intervalo && (
                <div className="ficha-horas">
                  <Campo rotulo="Começo do intervalo" erro={e('intervaloInicio')}>
                    {(id) => <input id={id} className="cc-entrada" type="time" value={h.intervaloInicio} onChange={(ev) => mudarSessao(i, { intervaloInicio: ev.target.value })} />}
                  </Campo>
                  <Campo rotulo="Fim do intervalo" erro={e('intervaloFim')}>
                    {(id) => <input id={id} className="cc-entrada" type="time" value={h.intervaloFim} onChange={(ev) => mudarSessao(i, { intervaloFim: ev.target.value })} />}
                  </Campo>
                </div>
              )}
            </fieldset>
          );
        })}
        <Campo
          rotulo="Fim da desmontagem"
          ajuda="Em eventos ligados à UFSM, os chamados para a equipe de mudança (transporte de materiais e mobiliário) são responsabilidade do organizador."
          erro={erro('desmontagem')}
        >
          {(id) => <input id={id} className="cc-entrada" type="datetime-local" value={d.desmontagem} onChange={(e) => mudar({ desmontagem: e.target.value })} />}
        </Campo>
      </>
    ),

    responsavel: (
      <>
        <Pergunta titulo="Vínculo do responsável" erro={erro('responsavel.vinculo')}>
          <Opcoes nome="Vínculo do responsável" opcoes={VINCULOS_RESPONSAVEL} valor={d.responsavel.vinculo} aoMudar={(vinculo) => mudarResp({ vinculo })} />
          {d.responsavel.vinculo === 'Outro' && (
            <Campo rotulo="Qual?" erro={erro('responsavel.vinculoOutro')}>
              {(id) => <input id={id} className="cc-entrada" value={d.responsavel.vinculoOutro} onChange={(e) => mudarResp({ vinculoOutro: e.target.value })} />}
            </Campo>
          )}
        </Pergunta>
        <Campo rotulo="Nome do responsável pelo evento" erro={erro('responsavel.nome')}>
          {(id) => <input id={id} className="cc-entrada" autoComplete="name" value={d.responsavel.nome} onChange={(e) => mudarResp({ nome: e.target.value })} />}
        </Campo>
        <div className="grade-2">
          <Campo rotulo="CPF ou CNPJ" erro={erro('responsavel.documento')}>
            {(id) => <input id={id} className="cc-entrada" inputMode="numeric" value={d.responsavel.documento} onChange={(e) => mudarResp({ documento: e.target.value })} />}
          </Campo>
          {d.responsavel.vinculo === 'Servidor da UFSM' && (
            <Campo rotulo="SIAPE ou matrícula" erro={erro('responsavel.siapeMatricula')}>
              {(id) => <input id={id} className="cc-entrada" inputMode="numeric" value={d.responsavel.siapeMatricula} onChange={(e) => mudarResp({ siapeMatricula: e.target.value })} />}
            </Campo>
          )}
          <Campo rotulo="E-mail" erro={erro('responsavel.email')}>
            {(id) => <input id={id} className="cc-entrada" type="email" autoComplete="email" value={d.responsavel.email} onChange={(e) => mudarResp({ email: e.target.value })} />}
          </Campo>
          <Campo rotulo="Telefone (com DDD)" erro={erro('responsavel.telefone')}>
            {(id) => <input id={id} className="cc-entrada" type="tel" autoComplete="tel" value={d.responsavel.telefone} onChange={(e) => mudarResp({ telefone: e.target.value })} />}
          </Campo>
        </div>
        <Campo rotulo="O que será montado" ajuda="Cenário, painéis, mesas de exposição, equipamentos de som ou luz próprios…" erro={erro('descricaoMontagem')}>
          {(id) => <textarea id={id} className="cc-entrada" rows={4} value={d.descricaoMontagem} onChange={(e) => mudar({ descricaoMontagem: e.target.value })} />}
        </Campo>
        <ListaNomes rotulo="Equipe de montagem" valor={d.equipeMontagem} aoMudar={(equipeMontagem) => mudar({ equipeMontagem })} />
        <p className="cc-campo-ajuda" style={{ margin: 0 }}>
          Para a liberação na portaria de serviço. Pode completar até 2 dias antes do evento.
        </p>
      </>
    ),

    espacos: (
      <>
        <Pergunta titulo="Locais de realização" erro={erro('locais')}>
          <div className="ficha-opcoes">
            {LOCAIS_FICHA.map((l) => (
              <label key={l} className="ficha-opcao" data-marcada={d.locais.includes(l) || undefined}>
                <input
                  type="checkbox"
                  className="visualmente-oculto"
                  checked={d.locais.includes(l)}
                  onChange={(e) => mudar({ locais: e.target.checked ? LOCAIS_FICHA.filter((x) => x === l || d.locais.includes(x)) : d.locais.filter((x) => x !== l) })}
                />
                {d.locais.includes(l) && <Check size={14} aria-hidden />} {l}
              </label>
            ))}
          </div>
        </Pergunta>
        <Pergunta titulo="Haverá sessão de fotos ou filmagem?" ajuda="Sessões de fotos e filmagens acontecem obrigatoriamente no Foyer Principal." erro={erro('sessaoFotos')}>
          <SimNao nome="Sessão de fotos" valor={d.sessaoFotos} aoMudar={(sessaoFotos) => mudar({ sessaoFotos })} />
        </Pergunta>
        <Pergunta
          titulo="Haverá leitura de ingressos?"
          ajuda="Os aparelhos e equipamentos para a leitura e a conferência no local são de inteira responsabilidade do produtor."
          erro={erro('leituraIngressos')}
        >
          <SimNao nome="Leitura de ingressos" valor={d.leituraIngressos} aoMudar={(leituraIngressos) => mudar({ leituraIngressos })} />
        </Pergunta>
        <Pergunta titulo="Haverá ingresso solidário?" erro={erro('ingressoSolidario')}>
          <SimNao nome="Ingresso solidário" valor={d.ingressoSolidario} aoMudar={(ingressoSolidario) => mudar({ ingressoSolidario })} />
          {d.ingressoSolidario && (
            <Pergunta titulo="Destino dos alimentos" erro={erro('destinoAlimentos')}>
              <Opcoes nome="Destino dos alimentos" opcoes={DESTINOS_ALIMENTOS} valor={d.destinoAlimentos} aoMudar={(destinoAlimentos) => mudar({ destinoAlimentos })} />
              {d.destinoAlimentos === 'Outro' && (
                <Campo rotulo="Qual?" erro={erro('destinoOutro')}>
                  {(id) => <input id={id} className="cc-entrada" value={d.destinoOutro} onChange={(e) => mudar({ destinoOutro: e.target.value })} />}
                </Campo>
              )}
            </Pergunta>
          )}
        </Pergunta>
        <Alerta tom="aviso">Se houver venda de ingressos, envie o comprovante e a guia de pagamento do ISS até 2 dias antes do evento.</Alerta>
      </>
    ),

    camarins: (
      <>
        <Pergunta titulo="Camarins individuais" ajuda="Cada um tem banheiro privativo com chuveiro, ar-condicionado, espelho, mesa e poltrona.">
          <Quantidade nome="Camarins individuais" max={MAX_CAMARINS_INDIVIDUAIS} valor={d.camarinsIndividuais.length} aoMudar={(n) => mudar({ camarinsIndividuais: ajustarLista(d.camarinsIndividuais, n) })} />
          {d.camarinsIndividuais.map((nome, i) => (
            <Campo key={i} rotulo={`Camarim individual ${i + 1}: quem vai usar`} erro={erro(`camarinsIndividuais.${i}`)}>
              {(id) => <input id={id} className="cc-entrada" placeholder="Ex.: Fulano de Tal" value={nome} onChange={(e) => mudar({ camarinsIndividuais: d.camarinsIndividuais.map((x, j) => (j === i ? e.target.value : x)) })} />}
            </Campo>
          ))}
        </Pergunta>
        <Pergunta titulo="Camarins coletivos" ajuda="Cada um tem banheiros coletivos com chuveiros, ar-condicionado, espelho, sofás e poltronas, mesas, armários, cabideiros e frigobar.">
          <Quantidade nome="Camarins coletivos" max={MAX_CAMARINS_COLETIVOS} valor={d.camarinsColetivos.length} aoMudar={(n) => mudar({ camarinsColetivos: ajustarLista(d.camarinsColetivos, n) })} />
          {d.camarinsColetivos.map((nome, i) => (
            <Campo key={i} rotulo={`Camarim coletivo ${i + 1}: quem vai usar`} erro={erro(`camarinsColetivos.${i}`)}>
              {(id) => <input id={id} className="cc-entrada" placeholder="Ex.: Dançarinos" value={nome} onChange={(e) => mudar({ camarinsColetivos: d.camarinsColetivos.map((x, j) => (j === i ? e.target.value : x)) })} />}
            </Campo>
          ))}
        </Pergunta>
      </>
    ),

    poltronas: (
      <>
        <Pergunta titulo="Precisa reservar poltronas?" erro={erro('reservarPoltronas')}>
          <SimNao
            nome="Reservar poltronas"
            valor={d.reservarPoltronas}
            aoMudar={(v) => mudar({ reservarPoltronas: v, grupos: v && !d.grupos.length ? [{ nome: '', lugares: [] }] : d.grupos })}
          />
        </Pergunta>
        {d.reservarPoltronas && (
          <>
            <div className="ficha-grupos" role="radiogroup" aria-label="Grupo que recebe as marcações">
              {d.grupos.map((g, i) => (
                <div key={i} className="ficha-grupo" data-ativo={i === grupoAtivo || undefined} style={{ '--cor': corDoGrupo(i) } as CSSProperties}>
                  <button type="button" role="radio" aria-checked={i === grupoAtivo} className="ficha-grupo-cor" onClick={() => setGrupoAtivo(i)} aria-label={`Marcar no grupo ${g.nome || i + 1}`}>
                    {i === grupoAtivo && <Check size={14} aria-hidden />}
                  </button>
                  <input
                    className="cc-entrada"
                    aria-label={`Nome do grupo ${i + 1}`}
                    placeholder="Ex.: Autoridades"
                    value={g.nome}
                    onFocus={() => setGrupoAtivo(i)}
                    onChange={(e) => mudar({ grupos: d.grupos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })}
                  />
                  <span className="pequeno texto-2 ficha-grupo-total">{g.lugares.length}</span>
                  {d.grupos.length > 1 && (
                    <Botao
                      variante="fantasma"
                      tamanho="pequeno"
                      aria-label={`Apagar o grupo ${g.nome || i + 1}`}
                      onClick={() => {
                        mudar({ grupos: d.grupos.filter((_, j) => j !== i) });
                        setGrupoAtivo(0);
                      }}
                    >
                      <Trash2 size={16} aria-hidden />
                    </Botao>
                  )}
                  {erro(`grupos.${i}.nome`) && <span className="cc-campo-erro ficha-grupo-erro">{erro(`grupos.${i}.nome`)}</span>}
                </div>
              ))}
              {d.grupos.length < 8 && (
                <Botao
                  tamanho="pequeno"
                  onClick={() => {
                    mudar({ grupos: [...d.grupos, { nome: '', lugares: [] }] });
                    setGrupoAtivo(d.grupos.length);
                  }}
                >
                  <Plus size={16} aria-hidden /> Novo grupo
                </Botao>
              )}
            </div>
            {erro('grupos') && <span className="cc-campo-erro">{erro('grupos')}</span>}
            <MapaPoltronas grupos={d.grupos} ativo={grupoAtivo} aoMudar={(grupos) => mudar({ grupos })} />
            {d.grupos.some((g) => g.lugares.length) && (
              <ul className="ficha-lista-lugares">
                {d.grupos.map(
                  (g, i) =>
                    g.lugares.length > 0 && (
                      <li key={i}>
                        <strong style={{ color: corDoGrupo(i) }}>{g.nome || `Grupo ${i + 1}`}</strong> ({g.lugares.length}): {descreverLugares(g.lugares)}
                      </li>
                    ),
                )}
              </ul>
            )}
            <Campo rotulo="Observações sobre as poltronas (opcional)">
              {(id) => <textarea id={id} className="cc-entrada" rows={3} value={d.observacoesPoltronas} onChange={(e) => mudar({ observacoesPoltronas: e.target.value })} />}
            </Campo>
          </>
        )}
      </>
    ),

    coffee: (
      <>
        <Alerta tom="aviso">
          <ul className="ficha-regras">
            <li>Não é permitido consumir alimentos no palco e na plateia.</li>
            <li>É proibida a venda de alimentos e a venda e o consumo de bebidas alcoólicas nas dependências do Centro de Convenções e da UFSM.</li>
          </ul>
        </Alerta>
        <Pergunta titulo="Haverá coffee break?" erro={erro('coffeeBreak')}>
          <SimNao nome="Coffee break" valor={d.coffeeBreak} aoMudar={(coffeeBreak) => mudar({ coffeeBreak })} />
        </Pergunta>
        {d.coffeeBreak && (
          <>
            <Pergunta titulo="Onde vai acontecer?" erro={erro('coffeeLocal')}>
              <Opcoes nome="Local do coffee break" opcoes={LOCAIS_COFFEE} valor={d.coffeeLocal} aoMudar={(coffeeLocal) => mudar({ coffeeLocal })} />
            </Pergunta>
            <Campo rotulo="O que será servido?" erro={erro('coffeeCardapio')}>
              {(id) => <textarea id={id} className="cc-entrada" rows={3} value={d.coffeeCardapio} onChange={(e) => mudar({ coffeeCardapio: e.target.value })} />}
            </Campo>
          </>
        )}
      </>
    ),

    revisao: (
      <>
        {modo === 'produtor' && erros.some((e) => e.etapa !== 'revisao') && (
          <Alerta tom="erro">
            <p style={{ margin: '0 0 6px' }}>Ainda faltam itens antes de enviar:</p>
            <ul className="ficha-regras">
              {ETAPAS_FICHA.filter((x) => x.id !== 'revisao' && errosDa(x.id).length).map((x) => (
                <li key={x.id}>
                  <button type="button" className="link-botao" onClick={() => irPara(ETAPAS_FICHA.indexOf(x))}>
                    {x.titulo}
                  </button>
                  : {errosDa(x.id).map((e) => e.mensagem).join(' ')}
                </li>
              ))}
            </ul>
          </Alerta>
        )}
        <ResumoFicha evento={evento} dados={d} aoBaixarAnexo={aoBaixarAnexo} />
        <Alerta tom="info">O preenchimento da ficha não garante que tudo o que foi pedido será disponibilizado.</Alerta>
        <Pergunta titulo="Declaração" erro={erro('aceiteRegulamento')}>
          <label className="cc-caixa">
            <input type="checkbox" checked={d.aceiteRegulamento} onChange={(e) => mudar({ aceiteRegulamento: e.target.checked })} />
            <span>
              Declaro que li integralmente o{' '}
              <a href={LINK_REGULAMENTO} target="_blank" rel="noreferrer">
                Regulamento Interno do Centro de Convenções
              </a>{' '}
              e estou ciente de que a minha produção seguirá todas as normas, sob pena de responsabilização legal e administrativa em caso de descumprimento.
            </span>
          </label>
        </Pergunta>
      </>
    ),
  };

  return (
    <div className="ficha-form" ref={topo}>
      <nav className="ficha-etapas" aria-label="Etapas da ficha">
        <ol>
          {ETAPAS_FICHA.map((x, i) => {
            const pronta = tentadas.has(x.id) && !errosDa(x.id).length;
            return (
              <li key={x.id}>
                <button type="button" aria-current={i === etapa ? 'step' : undefined} data-pronta={pronta || undefined} onClick={() => irPara(i)}>
                  <span className="ficha-etapa-num">{pronta ? <Check size={14} aria-hidden /> : i + 1}</span>
                  {x.titulo}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="ficha-corpo" aria-labelledby="ficha-titulo-etapa">
        <div className="ficha-progresso">
          <span className="pequeno texto-2">
            Etapa {etapa + 1} de {ETAPAS_FICHA.length}
          </span>
          <h2 id="ficha-titulo-etapa">{atual.titulo}</h2>
          <BarraProgresso atual={etapa + 1} total={ETAPAS_FICHA.length} />
        </div>
        <div className="pilha">{etapas[atual.id]}</div>
        {falha && <Alerta tom="erro">{falha}</Alerta>}
        <div className="ficha-rodape">
          <Botao onClick={() => irPara(etapa - 1)} disabled={etapa === 0}>
            <ChevronLeft size={18} aria-hidden /> Voltar
          </Botao>
          {modo === 'gestor' && (
            <Botao variante={ultima ? 'primario' : 'secundario'} carregando={salvando} onClick={() => void salvar(false)}>
              Salvar correções
            </Botao>
          )}
          {!ultima && (
            <Botao variante="primario" carregando={salvando && modo === 'produtor'} onClick={modo === 'gestor' ? () => irPara(etapa + 1) : continuar}>
              {modo === 'produtor' ? 'Salvar e continuar' : 'Próxima'} <ChevronRight size={18} aria-hidden />
            </Botao>
          )}
          {ultima && modo === 'produtor' && (
            <Botao
              variante="primario"
              carregando={salvando}
              onClick={() => {
                setTentadas(new Set(ETAPAS_FICHA.map((x) => x.id)));
                if (erros.length) return setFalha('Confira os itens que faltam antes de enviar.');
                void salvar(true);
              }}
            >
              Enviar ficha
            </Botao>
          )}
        </div>
      </section>
    </div>
  );
}

/** Na primeira vez, traz o início e o término já cadastrados no GestorCC para as sessões. */
function preencherHorarios(d: FichaTecnicaDados, evento: Evento): FichaTecnicaDados {
  return {
    ...d,
    sessoes: d.sessoes.map((h) => {
      const s = evento.sessoes.find((x) => x.id === h.sessaoId);
      return { ...h, inicio: h.inicio || s?.inicio || '', fim: h.fim || s?.fim || '' };
    }),
  };
}
