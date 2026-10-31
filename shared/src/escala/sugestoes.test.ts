import { describe, expect, it } from 'vitest';
import { disponivel, escala, pessoa, sessao } from '../teste/fabricas';
import type { ContextoEscala } from './autoPreencher';
import { sugestoesEquilibrio } from './sugestoes';

describe('sugestoesEquilibrio', () => {
  it('sugere tirar quem deve ser escalado menos', () => {
    const s = sessao({ id: 's', data: '2026-11-10' });
    const outra = sessao({ id: 'o', data: '2026-11-20' });
    const menos = pessoa({ id: 'm', nome: 'M', escalarMenos: true });
    const livre = pessoa({ id: 'l', nome: 'L' });
    const ctx: ContextoEscala = {
      pessoas: [menos, livre],
      sessoes: [s, outra],
      escalas: [escala({ sessaoId: 's', pessoaId: 'm' }), escala({ sessaoId: 'o', pessoaId: 'l' })],
      disponibilidades: [disponivel('m', 's'), disponivel('l', 's')],
    };
    expect(sugestoesEquilibrio(['s'], ctx)).toEqual([
      { sessaoId: 's', tirar: 'm', colocar: 'l', motivo: 'escalarMenos', diferenca: 0 },
    ]);
  });

  it('não sugere troca que deixe a sessão sem experiente', () => {
    const datas = ['2026-11-01', '2026-11-03', '2026-11-05', '2026-11-07'];
    const sessoes = datas.map((data, i) => sessao({ id: `s${i}`, data, minimoExperientes: 1 }));
    const exp = pessoa({ id: 'x', nome: 'X', experiente: true });
    const novato = pessoa({ id: 'n', nome: 'N' });
    const ctx: ContextoEscala = {
      pessoas: [exp, novato],
      sessoes,
      escalas: sessoes.map((s) => escala({ sessaoId: s.id, pessoaId: 'x' })),
      disponibilidades: [disponivel('n', 's0')],
    };
    expect(sugestoesEquilibrio(['s0'], ctx)).toEqual([]);
  });

  it('sugere equilibrar quando a diferença passa de 1', () => {
    const datas = ['2026-11-01', '2026-11-03', '2026-11-05'];
    const sessoes = datas.map((data, i) => sessao({ id: `s${i}`, data }));
    const muito = pessoa({ id: 'a', nome: 'A' });
    const pouco = pessoa({ id: 'b', nome: 'B' });
    const ctx: ContextoEscala = {
      pessoas: [muito, pouco],
      sessoes,
      escalas: sessoes.map((s) => escala({ sessaoId: s.id, pessoaId: 'a' })),
      disponibilidades: [disponivel('b', 's0')],
    };
    expect(sugestoesEquilibrio(['s0'], ctx)).toEqual([
      { sessaoId: 's0', tirar: 'a', colocar: 'b', motivo: 'equilibrio', diferenca: 3 },
    ]);
  });
});
