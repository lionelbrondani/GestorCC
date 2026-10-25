import { ehGestor, ErroApi, type Config, type Feriado, type RegistroHistorico } from '@shared';
import { exigirVersao, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { marcarAgendaPendente } from '../relatorios/pendentes';
import { VERSAO_API } from '../versao';

/** Valores iniciais do spec (seção 4.1). */
export const CONFIG_PADRAO: Config = {
  diariaPadrao: 8000,
  vagasBolsistasPadrao: 8,
  vagasServidoresPadrao: 1,
  minimoExperientesPadrao: 1,
  edital: '',
  iniciativa: '',
  projetoFundep: '30055',
  destinatariosFundep: [],
  assinaturaEmail: 'Centro de Convenções - UFSM\nCoordenadoria de Cultura e Arte\nPró-Reitoria de Extensão - UFSM',
  limitePerguntasDia: 30,
  linksFormularios: [],
  agendaSetor: { nome: 'Centro de Convenções UFSM', conta: '', link: '', conectada: false },
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

const linhaConfig = (ctx: Contexto) => ctx.portas.repo.listar<LinhaConfig>('config').find((c) => c.id === CHAVE_CONFIG);
const nomeDe = (ctx: Contexto) => (id: string) =>
  ctx.portas.repo.listar<{ id: string; nome: string }>('pessoas').find((p) => p.id === id)?.nome ?? 'Outra pessoa';

export const handlersSistema: Handlers = {
  'sistema.ping': () => ({ versao: VERSAO_API }),

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
      .map((h) => ({ id: h.id, quando: h.quando, quemId: h.quemId, entidade: h.entidade, entidadeId: h.entidadeId, acao: h.acao, justificativa: h.justificativa ?? '' }));
  },
};
