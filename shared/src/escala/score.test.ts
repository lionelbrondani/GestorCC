import { describe, expect, it } from 'vitest';
import { calcularScores } from './score';

const base = {
  pessoas: [
    { id: 'a', tipo: 'bolsista' as const, ativo: true },
    { id: 'b', tipo: 'bolsista' as const, ativo: true },
    { id: 'c', tipo: 'bolsista' as const, ativo: true },
    { id: 's', tipo: 'servidor' as const, ativo: true },
    { id: 'x', tipo: 'bolsista' as const, ativo: false },
  ],
  sessoes: [
    { id: 's1', data: '2026-09-10' },
    { id: 's2', data: '2026-10-10' },
    { id: 's3', data: '2026-10-20' },
    { id: 's4', data: '2026-11-20' },
  ],
  hoje: '2026-10-24',
  de: '2026-04-27',
};

describe('score dos bolsistas', () => {
  it('começa em 70; sobe com a disponibilidade (até 20) e com a avaliação; cai 15 por falta e 5 por troca pedida', () => {
    const r = calcularScores({
      ...base,
      escalas: [
        { sessaoId: 's1', pessoaId: 'a', status: 'realizado' },
        { sessaoId: 's2', pessoaId: 'a', status: 'realizado' },
        { sessaoId: 's3', pessoaId: 'b', status: 'faltou' },
        { sessaoId: 's2', pessoaId: 'b', status: 'publicado' },
        { sessaoId: 's4', pessoaId: 'a', status: 'publicado' },
      ],
      oferecidas: ['s2', 's3', 's4', 'fora'],
      disponibilidades: [
        { pessoaId: 'a', sessaoId: 's2', disponivel: true, origem: 'proprio' },
        { pessoaId: 'a', sessaoId: 's3', disponivel: true, origem: 'proprio' },
        { pessoaId: 'a', sessaoId: 's4', disponivel: true, origem: 'proprio' },
        { pessoaId: 'b', sessaoId: 's2', disponivel: true, origem: 'gestor' },
        { pessoaId: 'b', sessaoId: 's3', disponivel: false, origem: 'proprio' },
      ],
      avaliacoes: [
        { pessoaId: 'a', nota: 5 },
        { pessoaId: 'a', nota: 4 },
        { pessoaId: 'b', nota: 2 },
      ],
      trocasPedidas: ['b', 'b'],
    });
    expect(r.map((x) => x.pessoaId)).toEqual(['a', 'c', 'b']);
    // a: 70 + 20 × 3/3 + (4,5 − 3) × 5 = 97,5 → 98; 2 escalas feitas (a de novembro ainda não aconteceu)
    expect(r[0]).toEqual({ pessoaId: 'a', escalas: 2, faltas: 0, trocas: 0, disponibilidade: 1, avaliacao: 4.5, score: 98 });
    // c: nada marcado nas rodadas → 0% de disponibilidade; sem avaliação, não mexe
    expect(r[1]).toEqual({ pessoaId: 'c', escalas: 0, faltas: 0, trocas: 0, disponibilidade: 0, avaliacao: null, score: 70 });
    // b: 70 + 0 (o que a gestão marcou não conta) − 5 (avaliação 2) − 15 (falta) − 10 (2 trocas) = 40
    expect(r[2]).toEqual({ pessoaId: 'b', escalas: 1, faltas: 1, trocas: 2, disponibilidade: 0, avaliacao: 2, score: 40 });
  });

  it('sem rodada no período, a disponibilidade fica neutra (metade) e o score não passa de 0 a 100', () => {
    const r = calcularScores({ ...base, escalas: Array.from({ length: 8 }, (_, i) => ({ sessaoId: 's1', pessoaId: 'a', status: i < 7 ? 'faltou' : 'realizado' })), oferecidas: [], disponibilidades: [], avaliacoes: [], trocasPedidas: [] });
    expect(r.find((x) => x.pessoaId === 'a')).toMatchObject({ disponibilidade: null, faltas: 7, score: 0 });
    expect(r.find((x) => x.pessoaId === 'c')).toMatchObject({ disponibilidade: null, score: 80 });
  });
});
