import type { Centavos, DataISO, Id, LoteItem } from '../tipos';
import { emLoteAtivo, sessaoPagavel, valorDaSessao, type BasePagamentos } from './lotes';

export interface ResumoLoteGanhos {
  loteId: Id;
  titulo: string;
  data: string;
  valor: Centavos;
  eventos: { nome: string; data: DataISO }[];
}

export interface MeusGanhos {
  previsto: { qtd: number; valor: Centavos };
  enviados: ResumoLoteGanhos[];
  pagos: ResumoLoteGanhos[];
  externos: { eventoNome: string; data: DataISO; pagador: string }[];
}

type Base = BasePagamentos & { itens: LoteItem[] };

function nomeEventoDaSessao(sessaoId: Id, b: Base): { nome: string; data: DataISO } | null {
  const s = b.sessoes.find((x) => x.id === sessaoId);
  const ev = s && b.eventos.find((x) => x.id === s.eventoId);
  return s && ev ? { nome: s.rotulo ? `${ev.nome} – ${s.rotulo}` : ev.nome, data: s.data } : null;
}

export function meusGanhos(pessoaId: Id, b: Base, diariaPadrao: Centavos): MeusGanhos {
  const minhas = b.escalas.filter((e) => e.pessoaId === pessoaId && e.papel === 'bolsista');
  const ativas = minhas.filter((e) => e.status === 'publicado' || e.status === 'realizado');

  const previsto = { qtd: 0, valor: 0 };
  for (const e of ativas) {
    if (emLoteAtivo(e, b.lotes)) continue;
    const s = sessaoPagavel(e.sessaoId, b, 'interno');
    if (!s) continue;
    previsto.qtd += 1;
    previsto.valor += valorDaSessao(s, diariaPadrao);
  }

  const resumos = (status: 'enviado' | 'pago'): ResumoLoteGanhos[] =>
    b.lotes
      .filter((l) => l.status === status)
      .map((l) => {
        const itens = b.itens.filter((i) => i.loteId === l.id && i.pessoaId === pessoaId);
        const eventos = itens
          .map((i) => b.escalas.find((e) => e.id === i.escalaId))
          .map((e) => (e ? nomeEventoDaSessao(e.sessaoId, b) : null))
          .filter((x): x is { nome: string; data: DataISO } => x !== null)
          .sort((x, y) => x.data.localeCompare(y.data));
        return {
          loteId: l.id,
          titulo: l.titulo,
          data: (status === 'pago' ? l.pagoEm : null) ?? l.criadoEm.slice(0, 10),
          valor: itens.reduce((acc, i) => acc + i.valor, 0),
          eventos,
        };
      })
      .filter((r) => r.eventos.length > 0);

  const externos = ativas
    .map((e) => {
      const s = sessaoPagavel(e.sessaoId, b, 'externo');
      const ev = s && b.eventos.find((x) => x.id === s.eventoId);
      return s && ev ? { eventoNome: ev.nome, data: s.data, pagador: ev.pagadorExterno ?? 'Organização do evento' } : null;
    })
    .filter((x): x is MeusGanhos['externos'][number] => x !== null)
    .sort((x, y) => x.data.localeCompare(y.data));

  return { previsto, enviados: resumos('enviado'), pagos: resumos('pago'), externos };
}
