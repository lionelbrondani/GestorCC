import type { Avaliacao } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersAvaliacoes } from '../src/acoes/avaliacoes';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };

describe('avaliações', () => {
  const ambiente = () => {
    const amb = criarAmbiente({ handlers: handlersAvaliacoes });
    const gestor = amb.token('p01');
    const salvar = (a: Partial<Avaliacao>, token = gestor) =>
      amb.chamar('avaliacoes.salvar', { pessoaId: 'p02', mes: '2026-12', nota: 4, observacao: 'Pontual', ...a } as Avaliacao, { token });
    const listar = () => (amb.chamar('avaliacoes.listar', { mes: '2026-12' }, { token: gestor }) as Ok<Avaliacao[]>).dados;
    return { ...amb, salvar, listar };
  };

  it('salva e lista; a segunda avaliação do mês substitui a primeira', () => {
    const amb = ambiente();
    expect(amb.salvar({}).ok).toBe(true);
    amb.salvar({ nota: 5, observacao: 'Excelente' });
    expect(amb.listar()).toEqual([{ pessoaId: 'p02', mes: '2026-12', nota: 5, observacao: 'Excelente' }]);
  });

  it('nota fora de 1 a 5, mês inválido e pessoa inexistente são recusados', () => {
    const amb = ambiente();
    expect(amb.salvar({ nota: 0 as never })).toEqual({ ok: false, erro: { codigo: 'NOTA', mensagem: 'A nota vai de 1 a 5.' } });
    expect(amb.salvar({ nota: 6 as never })).toMatchObject({ erro: { codigo: 'NOTA' } });
    expect(amb.salvar({ mes: 'dez/2026' })).toEqual({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Mês inválido.' } });
    expect(amb.salvar({ pessoaId: 'p-nada' })).toEqual({ ok: false, erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pessoa não encontrada.' } });
  });

  it('bolsista não avalia nem lista avaliações', () => {
    const amb = ambiente();
    const bolsista = amb.token('p02');
    expect(amb.salvar({}, bolsista)).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
    expect(amb.chamar('avaliacoes.listar', { mes: '2026-12' }, { token: bolsista })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });
});
