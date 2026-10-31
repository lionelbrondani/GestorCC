import { DIAS_ACHADOS, DIAS_GUARDAR_ACHADOS, DIAS_GUARDAR_CORTESIAS, DIAS_GUARDAR_FICHA, ehGestor, ErroApi, SETOR, type Config, type Feriado, type RegistroHistorico } from '@shared';
import { exigirVersao, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { marcarAgendaPendente } from '../relatorios/pendentes';
import { lerErros } from '../nucleo/erros';
import { VERSAO_API } from '../versao';

/** Valores iniciais do spec (seção 4.1). */
export const CONFIG_PADRAO: Config = {
  diariaPadrao: 8000,
  vagasBolsistasPadrao: 8,
  vagasServidoresPadrao: 1,
  minimoExperientesPadrao: 1,
  edital: '',
  iniciativa: '',
  projetoFundep: SETOR.projetoFundacao,
  destinatariosFundep: [],
  assinaturaEmail: SETOR.assinaturaEmail,
  limitePerguntasDia: 30,
  lotacaoTeatro: SETOR.lotacao,
  informacoesSetor: '',
  diasGuardarCortesias: DIAS_GUARDAR_CORTESIAS,
  diasGuardarFicha: DIAS_GUARDAR_FICHA,
  diasAchados: DIAS_ACHADOS,
  diasGuardarAchados: DIAS_GUARDAR_ACHADOS,
  linksFormularios: [],
  agendaSetor: { nome: SETOR.nomeCompleto, conta: '', link: '', conectada: false },
};

const CHAVE_CONFIG = 'geral';
type LinhaConfig = { id: string; valor: Partial<Config> | null; atualizadoEm?: string; atualizadoPor?: string };
type LinhaHistorico = RegistroHistorico & { quando: string };

/** A agenda do setor é criada pelo `instalar` (AGENDA_ID/AGENDA_CONTA); o que estiver salvo em config não vale. */
function agendaSetor(ctx: Contexto): Config['agendaSetor'] {
  const id = ctx.portas.props.obter('AGENDA_ID');
  return {
    nome: CONFIG_PADRAO.agendaSetor.nome,
    conta: ctx.portas.props.obter('AGENDA_CONTA') ?? '',
    link: id ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(id)}` : '',
    conectada: !!id,
  };
}

const LOGS_POR_PAGINA = 100;
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const paraRegistro = (h: LinhaHistorico): RegistroHistorico => ({
  id: h.id, quando: h.quando, quemId: h.quemId, entidade: h.entidade, entidadeId: h.entidadeId, acao: h.acao, justificativa: h.justificativa ?? '',
});

const linhaConfig = (ctx: Contexto) => ctx.portas.repo.listar<LinhaConfig>('config').find((c) => c.id === CHAVE_CONFIG);

/** Configurações em vigor: o salvo por cima do padrão do spec. */
export const configAtual = (ctx: Contexto): Config => ({ ...CONFIG_PADRAO, ...(linhaConfig(ctx)?.valor ?? {}) });
const nomeDe = (ctx: Contexto) => (id: string) =>
  ctx.portas.repo.listar<{ id: string; nome: string }>('pessoas').find((p) => p.id === id)?.nome ?? 'Outra pessoa';

export const handlersSistema: Handlers = {
  'sistema.ping': () => ({ versao: VERSAO_API }),

  'sistema.saude': (_d, ctx) => {
    const { props, repo, relogio, agenda, email } = ctx.portas;
    let emailsRestantes: number | null;
    try {
      emailsRestantes = email.cotaRestante();
    } catch {
      emailsRestantes = null; // sem a permissão de e-mail
    }
    return {
      versao: VERSAO_API,
      agora: relogio.agora(),
      ultimoBackup: props.obter('ULTIMO_BACKUP'),
      ultimaRotina: props.obter('ULTIMA_ROTINA'),
      agendaLigada: agenda.ligada(),
      agendaPendentes: repo.listar<{ id: string; agendaPendente?: boolean }>('sessoes').filter((s) => s.agendaPendente).length,
      emailsRestantes,
      erros: lerErros(props),
      tabelas: (['pessoas', 'eventos', 'sessoes', 'escalas', 'contratos', 'historico', 'notificacoes'] as const).map((tabela) => ({ tabela, linhas: repo.listar(tabela).length })),
    };
  },

  'config.obter': (_d, ctx) => {
    const linha = linhaConfig(ctx);
    return { ...CONFIG_PADRAO, ...(linha?.valor ?? {}), agendaSetor: agendaSetor(ctx), atualizadoEm: linha?.atualizadoEm };
  },

  'config.salvar': (c, ctx) => {
    const anterior = linhaConfig(ctx);
    if (anterior) exigirVersao(anterior, c.atualizadoEm, nomeDe(ctx));
    const { atualizadoEm: _a, agendaSetor: _ag, ...valor } = c;
    const linha = { id: CHAVE_CONFIG, valor };
    if (anterior) ctx.portas.repo.atualizar('config', linha);
    else ctx.portas.repo.inserir('config', linha);
    registrar(ctx, 'config', CHAVE_CONFIG, 'alterou configurações', anterior?.valor ?? null, valor);
    return { ...CONFIG_PADRAO, ...valor, agendaSetor: agendaSetor(ctx), atualizadoEm: linhaConfig(ctx)?.atualizadoEm };
  },

  'feriados.listar': ({ ano }, ctx) =>
    ctx.portas.repo
      .listar<{ id: string; data: string; nome: string }>('feriados')
      .filter((f) => f.data.startsWith(String(ano)))
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((f): Feriado => ({ data: f.data, nome: f.nome })),

  'feriados.salvar': ({ ano, feriados }, ctx) => {
    const { repo } = ctx.portas;
    const antigos = repo.listar<{ id: string; data: string }>('feriados').filter((f) => f.data.startsWith(String(ano)));
    for (const f of antigos) repo.remover('feriados', f.id);
    const doAno = feriados.filter((f) => f.data.startsWith(String(ano)));
    for (const f of doAno) repo.inserir('feriados', { id: f.data, data: f.data, nome: f.nome.trim() });
    registrar(ctx, 'config', 'feriados', `atualizou feriados de ${ano}`, null, null);
    marcarAgendaPendente(ctx.portas.props, [...antigos, ...doAno].map((f) => f.data.slice(0, 7)));
    return doAno;
  },

  'historico.listar': ({ entidade, entidadeId }, ctx) => {
    if (!ehGestor(ctx.eu!.permissoes)) throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    return ctx.portas.repo
      .listar<LinhaHistorico>('historico')
      .filter((h) => (!entidade || h.entidade === entidade) && (!entidadeId || h.entidadeId.split(',').includes(entidadeId)))
      .sort((a, b) => b.quando.localeCompare(a.quando))
      .slice(0, 200)
      .map(paraRegistro);
  },

  /** Logs do sistema (só quem administra): o histórico inteiro do período, filtrado por pessoa e por palavras. */
  'logs.listar': ({ de, ate, quemId, texto, pagina }, ctx) => {
    const palavras = semAcento(String(texto ?? '')).split(/\s+/).filter(Boolean);
    const todos = ctx.portas.repo
      .listar<LinhaHistorico>('historico')
      .filter((h) => h.quando.slice(0, 10) >= de && h.quando.slice(0, 10) <= ate && (!quemId || h.quemId === quemId))
      .filter((h) => {
        const onde = semAcento(`${h.entidade} ${h.acao} ${h.justificativa ?? ''}`);
        return palavras.every((p) => onde.includes(p));
      })
      .sort((a, b) => b.quando.localeCompare(a.quando));
    const n = Math.max(1, Math.floor(Number(pagina) || 1));
    return { total: todos.length, itens: todos.slice((n - 1) * LOGS_POR_PAGINA, n * LOGS_POR_PAGINA).map(paraRegistro) };
  },
};
