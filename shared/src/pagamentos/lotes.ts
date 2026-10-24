import { formatarData, mesExtenso } from '../datas';
import type { Centavos, DataISO, Escala, Evento, Id, Lote, Sessao } from '../tipos';

export interface BasePagamentos {
  eventos: Evento[];
  sessoes: Sessao[];
  escalas: Escala[];
  lotes: Lote[];
}

export function valorDaSessao(s: Sessao, diariaPadrao: Centavos): Centavos {
  return s.diaria ?? diariaPadrao;
}

export function emLoteAtivo(e: Escala, lotes: Lote[]): boolean {
  if (!e.loteId) return false;
  const lote = lotes.find((l) => l.id === e.loteId);
  return !!lote && lote.status !== 'cancelado';
}

/** Sessão ativa de evento ativo com o tipo de pagamento pedido. */
export function sessaoPagavel(sessaoId: Id, b: BasePagamentos, pagamento: Evento['pagamento']): Sessao | null {
  const s = b.sessoes.find((x) => x.id === sessaoId);
  if (!s || s.status !== 'ativa') return null;
  const ev = b.eventos.find((x) => x.id === s.eventoId);
  if (!ev || ev.status !== 'ativo' || ev.pagamento !== pagamento) return null;
  return s;
}

export function elegiveisParaLote(b: BasePagamentos): Escala[] {
  return b.escalas.filter(
    (e) =>
      e.status === 'realizado' &&
      e.papel === 'bolsista' &&
      !emLoteAtivo(e, b.lotes) &&
      sessaoPagavel(e.sessaoId, b, 'interno') !== null,
  );
}

export interface PreviaLote {
  porPessoa: { pessoaId: Id; escalaIds: Id[]; qtd: number; valor: Centavos }[];
  total: Centavos;
}

export function previaLote(escalaIds: Id[], b: BasePagamentos, diariaPadrao: Centavos): PreviaLote {
  const porPessoa = new Map<Id, PreviaLote['porPessoa'][number]>();
  for (const id of escalaIds) {
    const e = b.escalas.find((x) => x.id === id);
    const s = e && b.sessoes.find((x) => x.id === e.sessaoId);
    if (!e || !s) continue;
    const atual = porPessoa.get(e.pessoaId) ?? { pessoaId: e.pessoaId, escalaIds: [], qtd: 0, valor: 0 };
    atual.escalaIds.push(e.id);
    atual.qtd += 1;
    atual.valor += valorDaSessao(s, diariaPadrao);
    porPessoa.set(e.pessoaId, atual);
  }
  const lista = [...porPessoa.values()];
  return { porPessoa: lista, total: lista.reduce((acc, p) => acc + p.valor, 0) };
}

export function periodoReferencia(datas: DataISO[]): string {
  if (!datas.length) return '';
  const ordenadas = [...datas].sort();
  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  const [ano, mes] = ultima.split('-').map(Number);
  return `${mesExtenso(mes)}/${ano} – eventos de ${formatarData(primeira)} até ${formatarData(ultima)}`;
}
