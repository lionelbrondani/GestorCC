import { describe, expect, it } from 'vitest';
import { disponivel, escala, pessoa, sessao } from '../teste/fabricas';
import { autoPreencherPeriodo, autoPreencherSessao, candidatos, type ContextoEscala } from './autoPreencher';

describe('candidatos', () => {
  const s = sessao({ id: 'alvo', data: '2026-11-10' });
  const outra = sessao({ id: 'outra', data: '2026-11-10', chegada: '19:00', inicio: '19:30', fim: '21:00' });

  it('filtra e ordena conforme as regras', () => {
    const ok = pessoa({ id: 'ok', nome: 'Ana' });
    const indisp = pessoa({ id: 'indisp', nome: 'Bia' });
    const ja = pessoa({ id: 'ja', nome: 'Caio' });
    const serv = pessoa({ id: 'serv', nome: 'Dora', tipo: 'servidor' });
    const inativo = pessoa({ id: 'inativo', nome: 'Edu', ativo: false });
    const conflito = pessoa({ id: 'conflito', nome: 'Fábio' });
    const menos = pessoa({ id: 'menos', nome: 'Aaron', escalarMenos: true });
    const ctx: ContextoEscala = {
      pessoas: [ok, indisp, ja, serv, inativo, conflito, menos],
      sessoes: [s, outra],
      escalas: [escala({ sessaoId: 'alvo', pessoaId: 'ja' }), escala({ sessaoId: 'outra', pessoaId: 'conflito' })],
      disponibilidades: ['ok', 'ja', 'serv', 'inativo', 'conflito', 'menos']
        .map((p) => disponivel(p, 'alvo'))
        .concat(disponivel('indisp', 'alvo', false)),
    };
    expect(candidatos(s, ctx).map((p) => p.id)).toEqual(['ok', 'menos']);
  });

  it('desempata por nome em pt-BR e não confunde nomes curtos iguais', () => {
    const heloisa = pessoa({ id: 'h1', nome: 'Heloísa', nomeCurto: 'HELOÍSA' });
    const helena = pessoa({ id: 'h2', nome: 'Helena', nomeCurto: 'HELENA' });
    const isa1 = pessoa({ id: 'i1', nome: 'Isabela Alves', nomeCurto: 'ISABELA' });
    const isa2 = pessoa({ id: 'i2', nome: 'Isabela Vieira', nomeCurto: 'ISABELA' });
    const ctx: ContextoEscala = {
      pessoas: [heloisa, helena, isa1, isa2],
      sessoes: [s],
      escalas: [],
      disponibilidades: ['h1', 'h2', 'i1', 'i2'].map((p) => disponivel(p, 'alvo')),
    };
    expect(candidatos(s, ctx).map((p) => p.id)).toEqual(['h2', 'h1', 'i1', 'i2']);
  });
});

describe('autoPreencherSessao', () => {
  it('preenche até onde há candidatos', () => {
    const s = sessao({ id: 's', vagasBolsistas: 8 });
    const ps = ['a', 'b', 'c'].map((id) => pessoa({ id, nome: id }));
    const ctx: ContextoEscala = { pessoas: ps, sessoes: [s], escalas: [], disponibilidades: ps.map((p) => disponivel(p.id, 's')) };
    expect(autoPreencherSessao(s, ctx)).toHaveLength(3);
  });

  it('garante o mínimo de experientes mesmo com uma vaga', () => {
    const s = sessao({ id: 's', vagasBolsistas: 1, minimoExperientes: 1 });
    const ps = [pessoa({ id: 'a', nome: 'A' }), pessoa({ id: 'b', nome: 'B' }), pessoa({ id: 'c', nome: 'C', experiente: true })];
    const ctx: ContextoEscala = { pessoas: ps, sessoes: [s], escalas: [], disponibilidades: ps.map((p) => disponivel(p.id, 's')) };
    expect(autoPreencherSessao(s, ctx)).toEqual(['c']);
  });

  it('não preenche sessão já completa', () => {
    const s = sessao({ id: 's', vagasBolsistas: 1 });
    const ps = [pessoa({ id: 'a' }), pessoa({ id: 'b' })];
    const ctx: ContextoEscala = {
      pessoas: ps,
      sessoes: [s],
      escalas: [escala({ sessaoId: 's', pessoaId: 'a' })],
      disponibilidades: ps.map((p) => disponivel(p.id, 's')),
    };
    expect(autoPreencherSessao(s, ctx)).toEqual([]);
  });
});

describe('autoPreencherPeriodo', () => {
  it('considera as escolhas anteriores para evitar conflito', () => {
    const s1 = sessao({ id: 's1', data: '2026-10-29', chegada: '08:00', inicio: '09:00', fim: '13:00', vagasBolsistas: 1 });
    const s2 = sessao({ id: 's2', data: '2026-10-29', chegada: '12:45', inicio: '14:00', fim: '18:00', vagasBolsistas: 1 });
    const unica = pessoa({ id: 'u' });
    const ctx: ContextoEscala = {
      pessoas: [unica],
      sessoes: [s2, s1],
      escalas: [],
      disponibilidades: [disponivel('u', 's1'), disponivel('u', 's2')],
    };
    expect(autoPreencherPeriodo(['s2', 's1'], ctx)).toEqual([{ sessaoId: 's1', pessoaId: 'u' }]);
  });
});
