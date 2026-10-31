import type { ScoreBolsista } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEscalas } from '../src/acoes/escalas';
import { criarAmbiente } from './apoio';
import { linhaEscala, linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };

function ambiente() {
  const amb = criarAmbiente({ handlers: handlersEscalas });
  amb.repo.inserir('eventos', linhaEvento('e1'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-10-10', publicadaEm: '2026-10-01T10:00' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's2', eventoId: 'e1', data: '2026-10-20', publicadaEm: '2026-10-01T10:00' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's3', eventoId: 'e1', data: '2026-11-20' }));
  amb.repo.inserir('escalas', linhaEscala({ id: 'x1', sessaoId: 's1', pessoaId: 'p02', status: 'realizado' }));
  amb.repo.inserir('escalas', linhaEscala({ id: 'x2', sessaoId: 's2', pessoaId: 'p02', status: 'publicado' }));
  amb.repo.inserir('rodadaSessoes', { id: 'r1:s3', rodadaId: 'r1', sessaoId: 's3', nova: false } as never);
  amb.repo.inserir('disponibilidades', { id: 'p02:s3', pessoaId: 'p02', sessaoId: 's3', disponivel: true, origem: 'proprio', respondidoEm: '2026-10-05T10:00' } as never);
  amb.repo.inserir('avaliacoes', { id: 'p02:2026-10', pessoaId: 'p02', mes: '2026-10', nota: 4, observacao: '', autorId: 'p01' } as never);
  const gestor = amb.token('p01');
  return { ...amb, gestor };
}

describe('score dos bolsistas', () => {
  it('a troca pedida pelo bolsista desce o score; a que a gestão faz por outro motivo, não', () => {
    const amb = ambiente();
    const score = () => (amb.chamar('bolsistas.score', null, { token: amb.gestor }) as Ok<ScoreBolsista[]>).dados.find((s) => s.pessoaId === 'p02');
    // 70 + 20 (marcou a única sessão da rodada) + 5 (avaliação 4)
    expect(score()).toEqual({ pessoaId: 'p02', escalas: 2, faltas: 0, trocas: 0, disponibilidade: 1, avaliacao: 4, score: 95 });
    expect(amb.chamar('escalas.trocar', { sessaoId: 's2', sai: 'p02', entra: null, justificativa: 'Prova na universidade', aPedido: true }, { token: amb.gestor })).toMatchObject({ ok: true });
    expect(score()).toMatchObject({ escalas: 1, trocas: 1, score: 90 });
    amb.repo.inserir('escalas', linhaEscala({ id: 'x3', sessaoId: 's2', pessoaId: 'p02', status: 'publicado' }));
    amb.chamar('escalas.trocar', { sessaoId: 's2', sai: 'p02', entra: null, justificativa: 'Remanejamento da equipe', aPedido: false }, { token: amb.gestor });
    expect(score()).toMatchObject({ trocas: 1 });
  });

  it('só quem vê Pessoas (a gestão) vê o score', () => {
    const amb = ambiente();
    expect(amb.chamar('bolsistas.score', null, { token: amb.token('p02') })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });
});
