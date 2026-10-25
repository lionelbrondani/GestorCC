import { elegiveisParaLote, ErroApi, meusGanhos, valorDaSessao, type BasePagamentos, type Lote, type LoteItem } from '@shared';
import { linhasEscalas, paraEscala } from '../escalas/comum';
import { notificar, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { marcarRelatorios } from '../relatorios/pendentes';
import { linhasEventos, linhasSessoes, paraEvento, paraSessao } from './eventos';
import { configAtual } from './sistema';

export interface LinhaLote {
  id: string;
  titulo: string;
  periodoReferencia: string;
  edital: string;
  iniciativa: string;
  incluirZerados: boolean;
  status: Lote['status'];
  pagoEm: string;
  criadoEm?: string;
}
export interface LinhaLoteItem extends LoteItem {
  id: string;
}

export const linhasLotes = (ctx: Contexto) => ctx.portas.repo.listar<LinhaLote>('lotes');
export const linhasItens = (ctx: Contexto) => ctx.portas.repo.listar<LinhaLoteItem>('loteItens');

export function paraLote(l: LinhaLote): Lote {
  return {
    id: l.id, titulo: l.titulo, periodoReferencia: l.periodoReferencia, edital: l.edital, iniciativa: l.iniciativa,
    incluirZerados: !!l.incluirZerados, status: l.status, criadoEm: l.criadoEm ?? '', pagoEm: l.pagoEm ? l.pagoEm : null,
  };
}
const paraItem = ({ loteId, escalaId, pessoaId, valor }: LinhaLoteItem): LoteItem => ({ loteId, escalaId, pessoaId, valor: Number(valor) });

export function basePagamentos(ctx: Contexto): BasePagamentos & { itens: LoteItem[] } {
  return {
    eventos: linhasEventos(ctx).map(paraEvento),
    sessoes: linhasSessoes(ctx).map(paraSessao),
    escalas: linhasEscalas(ctx).map(paraEscala),
    lotes: linhasLotes(ctx).map(paraLote),
    itens: linhasItens(ctx).map(paraItem),
  };
}

/** Correções só enquanto o lote espera pagamento (spec 8.2.6). */
function loteAberto(ctx: Contexto, loteId: string, mensagem: string): LinhaLote {
  const lote = linhasLotes(ctx).find((l) => l.id === loteId);
  if (!lote || lote.status !== 'enviado') throw new ErroApi('LOTE_FECHADO', mensagem);
  return lote;
}

/** Tira a escala do lote: ela volta a poder entrar em outro. */
function liberarEscala(ctx: Contexto, escalaId: string): void {
  const e = linhasEscalas(ctx).find((x) => x.id === escalaId);
  if (e) ctx.portas.repo.atualizar('escalas', { ...e, loteId: '' });
}

const relerLote = (ctx: Contexto, id: string) => paraLote(linhasLotes(ctx).find((l) => l.id === id)!);
const marcarLote = (ctx: Contexto, id: string) => marcarRelatorios(ctx.portas.props, [`lote:${id}`]);

export const handlersPagamentos: Handlers = {
  'lotes.listar': (_d, ctx) => ({ lotes: linhasLotes(ctx).map(paraLote), itens: linhasItens(ctx).map(paraItem) }),

  'lotes.criar': (d, ctx) => {
    if (!d.escalaIds?.length) throw new ErroApi('LOTE_VAZIO', 'Selecione ao menos uma sessão.');
    if (!d.titulo?.trim()) throw new ErroApi('VALIDACAO', 'Informe o título do lote.');
    const base = basePagamentos(ctx);
    const elegiveis = new Map(elegiveisParaLote(base).map((e) => [e.id, e]));
    if (new Set(d.escalaIds).size !== d.escalaIds.length || d.escalaIds.some((id) => !elegiveis.has(id))) {
      throw new ErroApi('NAO_ELEGIVEL', 'Alguma sessão selecionada não pode ser paga.');
    }
    const { diariaPadrao } = configAtual(ctx);
    const id = novoId(ctx.portas, 'L');
    const linha: LinhaLote = {
      id, titulo: d.titulo.trim(), periodoReferencia: d.periodoReferencia ?? '', edital: d.edital ?? '', iniciativa: d.iniciativa ?? '',
      incluirZerados: !!d.incluirZerados, status: 'enviado', pagoEm: '',
    };
    ctx.portas.repo.inserir('lotes', linha);
    for (const escalaId of d.escalaIds) {
      const e = elegiveis.get(escalaId)!;
      const sessao = base.sessoes.find((s) => s.id === e.sessaoId)!;
      ctx.portas.repo.inserir('loteItens', { id: `${id}:${escalaId}`, loteId: id, escalaId, pessoaId: e.pessoaId, valor: valorDaSessao(sessao, diariaPadrao) });
      const linhaEscala = linhasEscalas(ctx).find((x) => x.id === escalaId)!;
      ctx.portas.repo.atualizar('escalas', { ...linhaEscala, loteId: id });
    }
    registrar(ctx, 'lote', id, `criou lote com ${d.escalaIds.length} escala(s)`, null, linha);
    marcarLote(ctx, id);
    return relerLote(ctx, id);
  },

  'lotes.retirarItem': ({ loteId, escalaId }, ctx) => {
    loteAberto(ctx, loteId, 'Só é possível alterar lotes ainda não pagos.');
    const item = linhasItens(ctx).find((i) => i.loteId === loteId && i.escalaId === escalaId);
    if (!item) throw new ErroApi('NAO_ENCONTRADO', 'Esta sessão não está no lote.');
    ctx.portas.repo.remover('loteItens', item.id);
    liberarEscala(ctx, escalaId);
    registrar(ctx, 'lote', loteId, 'retirou uma sessão do lote', { escalaId }, null);
    marcarLote(ctx, loteId);
    return relerLote(ctx, loteId);
  },

  'lotes.marcarPago': ({ loteId, data }, ctx) => {
    const lote = loteAberto(ctx, loteId, 'Este lote não está aguardando pagamento.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? '')) throw new ErroApi('VALIDACAO', 'Informe a data do pagamento.');
    ctx.portas.repo.atualizar('lotes', { ...lote, status: 'pago', pagoEm: data });
    const pessoas = linhasItens(ctx).filter((i) => i.loteId === loteId).map((i) => i.pessoaId);
    notificar(ctx, pessoas, `Pagamento do ${lote.titulo} realizado.`, '/ganhos');
    registrar(ctx, 'lote', loteId, 'marcou como pago', { status: 'enviado' }, { status: 'pago', pagoEm: data });
    marcarLote(ctx, loteId);
    return relerLote(ctx, loteId);
  },

  'lotes.cancelar': ({ loteId, justificativa }, ctx) => {
    const motivo = (justificativa ?? '').trim();
    if (!motivo) throw new ErroApi('JUSTIFICATIVA', 'Informe o motivo do cancelamento do lote.');
    const lote = loteAberto(ctx, loteId, 'Só é possível cancelar lotes ainda não pagos.');
    ctx.portas.repo.atualizar('lotes', { ...lote, status: 'cancelado' });
    for (const e of linhasEscalas(ctx).filter((x) => x.loteId === loteId)) liberarEscala(ctx, e.id);
    registrar(ctx, 'lote', loteId, 'cancelou o lote', { status: 'enviado' }, { status: 'cancelado' }, motivo);
    marcarLote(ctx, loteId);
    return relerLote(ctx, loteId);
  },

  'ganhos.meus': (_d, ctx) => meusGanhos(ctx.eu!.id, basePagamentos(ctx), configAtual(ctx).diariaPadrao),

  'externos.registrarEnvio': ({ eventoId, campos }, ctx) => {
    const evento = linhasEventos(ctx).find((e) => e.id === eventoId);
    if (!evento) throw new ErroApi('NAO_ENCONTRADO', 'Evento não encontrado.');
    if (evento.pagamento !== 'externo') throw new ErroApi('VALIDACAO', 'Este evento não tem pagamento externo.');
    ctx.portas.repo.inserir('envioExterno', {
      id: novoId(ctx.portas, 'v'), eventoId, enviadoEm: ctx.portas.relogio.agora(), enviadoPor: ctx.eu!.id, campos: campos ?? [],
    });
    registrar(ctx, 'evento', eventoId, 'registrou envio de dados ao pagador externo', null, { campos });
    return null;
  },
};
