import type { Avaliacao, DataISO, Disponibilidade, Escala, Id, Pessoa, Sessao } from '../tipos';

/**
 * Score dos bolsistas (só a gestão vê): começa em 70; a disponibilidade marcada pelo próprio bolsista soma até 20
 * (sem rodada no período, conta a metade); a avaliação média soma ou tira até 10; cada falta tira 15 e cada troca
 * pedida pelo bolsista tira 5. Fica entre 0 e 100.
 */
export const PESOS_SCORE = { base: 70, disponibilidade: 20, avaliacao: 5, falta: 15, troca: 5 } as const;
/** Período do score: os últimos 6 meses (a disponibilidade inclui as rodadas dos próximos 90 dias). */
export const DIAS_SCORE = 180;
export const DIAS_SCORE_FUTURO = 90;

export interface ScoreBolsista {
  pessoaId: Id;
  /** Escalas publicadas ou realizadas que já aconteceram. */
  escalas: number;
  faltas: number;
  trocas: number;
  /** Fração das sessões das rodadas em que o bolsista se marcou disponível (null sem rodada no período). */
  disponibilidade: number | null;
  avaliacao: number | null;
  score: number;
}

export function calcularScores(d: {
  pessoas: Pick<Pessoa, 'id' | 'tipo' | 'ativo'>[];
  /** Sessões do período (as passadas e as das rodadas abertas). */
  sessoes: Pick<Sessao, 'id' | 'data'>[];
  escalas: Pick<Escala, 'sessaoId' | 'pessoaId' | 'status'>[];
  /** Sessões oferecidas nas rodadas de disponibilidade do período. */
  oferecidas: Id[];
  disponibilidades: Pick<Disponibilidade, 'pessoaId' | 'sessaoId' | 'disponivel' | 'origem'>[];
  avaliacoes: Pick<Avaliacao, 'pessoaId' | 'nota'>[];
  /** Uma entrada (o id de quem saiu) por troca pedida pelo próprio bolsista. */
  trocasPedidas: Id[];
  de: DataISO;
  hoje: DataISO;
}): ScoreBolsista[] {
  const data = new Map(d.sessoes.map((s) => [s.id, s.data]));
  const passou = (sessaoId: Id) => {
    const dia = data.get(sessaoId);
    return !!dia && dia >= d.de && dia <= d.hoje;
  };
  const oferecidas = new Set(d.oferecidas.filter((id) => data.has(id)));
  const p = PESOS_SCORE;

  return d.pessoas
    .filter((x) => x.ativo && x.tipo === 'bolsista')
    .map((x) => {
      const dela = d.escalas.filter((e) => e.pessoaId === x.id && passou(e.sessaoId));
      const escalas = dela.filter((e) => e.status === 'publicado' || e.status === 'realizado').length;
      const faltas = dela.filter((e) => e.status === 'faltou').length;
      const trocas = d.trocasPedidas.filter((id) => id === x.id).length;
      const marcadas = d.disponibilidades.filter((m) => m.pessoaId === x.id && m.disponivel && m.origem !== 'gestor' && oferecidas.has(m.sessaoId)).length;
      const disponibilidade = oferecidas.size ? marcadas / oferecidas.size : null;
      const notas = d.avaliacoes.filter((a) => a.pessoaId === x.id).map((a) => a.nota);
      const avaliacao = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
      const bruto =
        p.base + p.disponibilidade * (disponibilidade ?? 0.5) + (avaliacao === null ? 0 : (avaliacao - 3) * p.avaliacao) - p.falta * faltas - p.troca * trocas;
      return { pessoaId: x.id, escalas, faltas, trocas, disponibilidade, avaliacao, score: Math.min(100, Math.max(0, Math.round(bruto))) };
    })
    .sort((a, b) => b.score - a.score);
}
