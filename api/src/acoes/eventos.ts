import { ErroApi, validarEvento, type Evento, type Sessao } from '@shared';
import { removerDaAgenda, sincronizarAgenda } from '../agenda/sincronizar';
import { exigirVersao, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { marcarAgendaPendente } from '../relatorios/agenda';
import { incluirEmRodadaAberta } from './rodadas';

export interface LinhaEvento {
  id: string;
  nome: string;
  tipo: Evento['tipo'];
  organizador: string;
  contatoOrganizador: string;
  servidorResponsavelId: string;
  publicoEstimado: number | null;
  publicoReal: number | null;
  pagamento: Evento['pagamento'];
  pagadorExterno: string;
  instrumento: Evento['instrumento'];
  status: Evento['status'];
  observacoes: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/** Linha da planilha. `googleEventoId` e `agendaPendente` são internas: nunca saem para o app. */
export interface LinhaSessao {
  id: string;
  eventoId: string;
  data: string;
  rotulo: string;
  chegada: string;
  inicio: string;
  fim: string;
  horarioADefinir: boolean;
  vagasBolsistas: number;
  vagasServidores: number;
  diaria: number | null;
  minimoExperientes: number;
  status: Sessao['status'];
  publicadaEm: string;
  convocacaoAbertaAte: string;
  convocacaoVagas: number;
  googleEventoId: string;
  agendaPendente: boolean;
}

const vazio = (v: unknown) => v === '' || v === null || v === undefined;
const textoOuNulo = (v: unknown) => (vazio(v) ? null : String(v));
const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** Planilha → app: textos e números opcionais vazios somem do objeto. */
export function paraEvento(l: LinhaEvento): Evento {
  const e: Evento = {
    id: l.id, nome: l.nome, tipo: l.tipo, organizador: l.organizador ?? '', contatoOrganizador: l.contatoOrganizador ?? '',
    pagamento: l.pagamento, instrumento: l.instrumento, status: l.status, atualizadoEm: l.atualizadoEm,
  };
  if (!vazio(l.servidorResponsavelId)) e.servidorResponsavelId = l.servidorResponsavelId;
  if (!vazio(l.publicoEstimado)) e.publicoEstimado = Number(l.publicoEstimado);
  if (!vazio(l.publicoReal)) e.publicoReal = Number(l.publicoReal);
  if (!vazio(l.pagadorExterno)) e.pagadorExterno = l.pagadorExterno;
  if (!vazio(l.observacoes)) e.observacoes = l.observacoes;
  return e;
}

export function paraSessao(l: LinhaSessao): Sessao {
  const s: Sessao = {
    id: l.id, eventoId: l.eventoId, data: l.data,
    chegada: textoOuNulo(l.chegada), inicio: textoOuNulo(l.inicio), fim: textoOuNulo(l.fim),
    horarioADefinir: !!l.horarioADefinir, vagasBolsistas: Number(l.vagasBolsistas), vagasServidores: Number(l.vagasServidores),
    diaria: vazio(l.diaria) ? null : Number(l.diaria), minimoExperientes: Number(l.minimoExperientes), status: l.status,
    publicadaEm: textoOuNulo(l.publicadaEm),
    convocacao: vazio(l.convocacaoAbertaAte) ? null : { abertaAte: l.convocacaoAbertaAte, vagas: Number(l.convocacaoVagas) || 0 },
  };
  if (!vazio(l.rotulo)) s.rotulo = l.rotulo;
  return s;
}

function linhaEvento(e: Evento, id: string, status: Evento['status']): LinhaEvento {
  return {
    id, nome: e.nome.trim(), tipo: e.tipo, organizador: e.organizador?.trim() ?? '', contatoOrganizador: e.contatoOrganizador?.trim() ?? '',
    servidorResponsavelId: e.servidorResponsavelId ?? '', publicoEstimado: e.publicoEstimado ?? null, publicoReal: e.publicoReal ?? null,
    pagamento: e.pagamento, pagadorExterno: e.pagamento === 'externo' ? (e.pagadorExterno?.trim() ?? '') : '', instrumento: e.instrumento,
    status, observacoes: e.observacoes?.trim() ?? '',
  };
}

/** Sessão vinda do formulário. Status, publicação, convocação e vínculo com o Google ficam como estavam. */
function linhaSessao(s: Sessao, id: string, eventoId: string, anterior?: LinhaSessao): LinhaSessao {
  const hora = (h: string | null) => (s.horarioADefinir ? '' : (h ?? ''));
  return {
    id, eventoId, data: s.data, rotulo: s.rotulo?.trim() ?? '', chegada: hora(s.chegada), inicio: hora(s.inicio), fim: hora(s.fim),
    horarioADefinir: !!s.horarioADefinir, vagasBolsistas: s.vagasBolsistas, vagasServidores: s.vagasServidores, diaria: s.diaria ?? null,
    minimoExperientes: s.minimoExperientes, status: anterior?.status ?? 'ativa', publicadaEm: anterior?.publicadaEm ?? '',
    convocacaoAbertaAte: anterior?.convocacaoAbertaAte ?? '', convocacaoVagas: anterior?.convocacaoVagas ?? 0,
    googleEventoId: anterior?.googleEventoId ?? '', agendaPendente: anterior?.agendaPendente ?? false,
  };
}

export const linhasEventos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaEvento>('eventos');
export const linhasSessoes = (ctx: Contexto) => ctx.portas.repo.listar<LinhaSessao>('sessoes');
const ordemSessao = (a: LinhaSessao, b: LinhaSessao) => a.data.localeCompare(b.data) || (a.chegada ?? '').localeCompare(b.chegada ?? '');
const nomeDe = (ctx: Contexto) => (id: string) =>
  ctx.portas.repo.listar<{ id: string; nome: string }>('pessoas').find((p) => p.id === id)?.nome ?? 'Outra pessoa';

function doEvento(ctx: Contexto, eventoId: string) {
  const linha = linhasEventos(ctx).find((e) => e.id === eventoId)!;
  return { evento: paraEvento(linha), sessoes: linhasSessoes(ctx).filter((s) => s.eventoId === eventoId).sort(ordemSessao).map(paraSessao) };
}

function exigirJustificativa(justificativa: string | undefined): string {
  const texto = (justificativa ?? '').trim();
  if (!texto) throw new ErroApi('JUSTIFICATIVA', 'Informe o motivo do cancelamento.');
  return texto;
}

/** Cancela o evento e as sessões ainda ativas; devolve as sessões alteradas. Repetir não faz nada. */
function cancelarEvento(ctx: Contexto, eventoId: string, justificativa: string): string[] {
  const evento = linhasEventos(ctx).find((e) => e.id === eventoId);
  if (!evento) throw new ErroApi('NAO_ENCONTRADO', 'Evento não encontrado.');
  if (evento.status === 'cancelado') return [];
  ctx.portas.repo.atualizar('eventos', { ...evento, status: 'cancelado' });
  const ativas = linhasSessoes(ctx).filter((s) => s.eventoId === eventoId && s.status === 'ativa');
  for (const s of ativas) ctx.portas.repo.atualizar('sessoes', { ...s, status: 'cancelada' });
  // fase 3: escalas destas sessões viram "cancelado" (não são pagas) e os escalados são avisados
  registrar(ctx, 'evento', eventoId, 'cancelou o evento', { status: 'ativo' }, { status: 'cancelado' }, justificativa);
  return ativas.map((s) => s.id);
}

function cancelarSessao(ctx: Contexto, sessaoId: string, justificativa: string): string[] {
  const sessao = linhasSessoes(ctx).find((s) => s.id === sessaoId);
  if (!sessao) throw new ErroApi('NAO_ENCONTRADO', 'Sessão não encontrada.');
  if (sessao.status === 'cancelada') return [];
  ctx.portas.repo.atualizar('sessoes', { ...sessao, status: 'cancelada' });
  registrar(ctx, 'sessao', sessaoId, 'cancelou a sessão', { status: 'ativa' }, { status: 'cancelada' }, justificativa);
  return [sessaoId];
}

/** Leva o cancelamento para a agenda do setor e marca os meses da aba AGENDA para refazer. */
function aposCancelar(ctx: Contexto, sessaoIds: string[]) {
  sincronizarAgenda(ctx.portas, sessaoIds);
  const meses = linhasSessoes(ctx).filter((s) => sessaoIds.includes(s.id)).map((s) => s.data.slice(0, 7));
  marcarAgendaPendente(ctx.portas.props, meses);
}

export const handlersEventos: Handlers = {
  'eventos.listar': ({ de, ate }, ctx) => {
    const sessoes = linhasSessoes(ctx).filter((s) => s.data >= de && s.data <= ate).sort(ordemSessao);
    const ids = [...new Set(sessoes.map((s) => s.eventoId))];
    const eventos = linhasEventos(ctx);
    return {
      eventos: ids.map((id) => eventos.find((e) => e.id === id)).filter((e): e is LinhaEvento => !!e).map(paraEvento),
      sessoes: sessoes.map(paraSessao),
    };
  },

  'eventos.salvar': ({ evento, sessoes }, ctx) => {
    const problema = validarEvento(evento, sessoes);
    if (problema) throw new ErroApi('VALIDACAO', problema);
    const { repo } = ctx.portas;

    const anterior = evento.id ? linhasEventos(ctx).find((e) => e.id === evento.id) : undefined;
    if (evento.id && !anterior) throw new ErroApi('NAO_ENCONTRADO', 'Evento não encontrado.');
    if (anterior) exigirVersao(anterior, evento.atualizadoEm, nomeDe(ctx));
    if (anterior?.status === 'cancelado') throw new ErroApi('EVENTO_CANCELADO', 'Este evento foi cancelado e não pode ser alterado.');

    const id = anterior?.id ?? novoId(ctx.portas, 'e');
    const existentes = linhasSessoes(ctx).filter((s) => s.eventoId === id);
    if (sessoes.some((s) => s.id && !existentes.some((x) => x.id === s.id))) {
      throw new ErroApi('NAO_ENCONTRADO', 'Sessão não encontrada neste evento.');
    }
    const removidas = existentes.filter((x) => !sessoes.some((s) => s.id === x.id));
    const publicada = removidas.find((s) => !vazio(s.publicadaEm));
    if (publicada) throw new ErroApi('SESSAO_PUBLICADA', `A sessão de ${diaMes(publicada.data)} já foi publicada. Cancele-a em vez de remover.`);
    for (const s of removidas) repo.remover('sessoes', s.id);

    const linha = linhaEvento(evento, id, anterior?.status ?? 'ativo');
    if (anterior) repo.atualizar('eventos', linha);
    else repo.inserir('eventos', linha);

    const novas: string[] = [];
    for (const s of sessoes) {
      const antes = existentes.find((x) => x.id === s.id);
      // fase 3: avisar os escalados quando o horário "a definir" for preenchido
      if (antes) repo.atualizar('sessoes', linhaSessao(s, antes.id, id, antes));
      else {
        const novaId = novoId(ctx.portas, 's');
        repo.inserir('sessoes', linhaSessao(s, novaId, id));
        novas.push(novaId);
      }
    }
    incluirEmRodadaAberta(ctx, novas);

    const { atualizadoEm: _a, atualizadoPor: _p, ...antes } = anterior ?? ({} as LinhaEvento);
    registrar(ctx, 'evento', id, anterior ? 'alterou evento' : 'criou evento', anterior ? antes : null, linha);

    removerDaAgenda(ctx.portas, removidas.map((s) => s.googleEventoId));
    sincronizarAgenda(ctx.portas, linhasSessoes(ctx).filter((s) => s.eventoId === id).map((s) => s.id));
    marcarAgendaPendente(ctx.portas.props, [...existentes, ...sessoes].map((s) => s.data.slice(0, 7)));
    return doEvento(ctx, id);
  },

  'eventos.cancelar': ({ eventoId, justificativa }, ctx) => {
    aposCancelar(ctx, cancelarEvento(ctx, eventoId, exigirJustificativa(justificativa)));
    return null;
  },

  'sessoes.cancelar': ({ sessaoId, justificativa }, ctx) => {
    aposCancelar(ctx, cancelarSessao(ctx, sessaoId, exigirJustificativa(justificativa)));
    return null;
  },
};
