import type { RegistroHistorico } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersSistema } from '../src/acoes/sistema';
import { criarAmbiente } from './apoio';

type Pagina = { itens: RegistroHistorico[]; total: number };

function ambiente() {
  const amb = criarAmbiente({ handlers: handlersSistema });
  const linha = (id: string, quando: string, quemId: string, acao: string, justificativa = '') =>
    amb.repo.inserir('historico', { id, quando, quemId, entidade: 'evento', entidadeId: 'e1', acao, antes: null, depois: null, justificativa } as never);
  linha('h1', '2026-09-30T10:00', 'p01', 'criou o evento Concerto de Natal');
  linha('h2', '2026-10-10T09:00', 'p01', 'publicou a escala de outubro');
  linha('h3', '2026-10-20T15:30', 'p02', 'marcou disponibilidade', 'pelo celular');
  linha('h4', '2026-10-24T08:00', '', 'recebeu o pedido PD-2026-0001');
  const logs = (dados: object, token = amb.token('p01')) => amb.chamar('logs.listar', dados as never, { token });
  return { ...amb, logs };
}

describe('logs do sistema', () => {
  it('lista o que foi feito no período, do mais recente para o mais antigo, com o total', () => {
    const amb = ambiente();
    const r = amb.logs({ de: '2026-10-01', ate: '2026-10-31' }) as { ok: true; dados: Pagina };
    expect(r.dados.itens.map((h) => h.id)).toEqual(['h4', 'h3', 'h2']);
    expect(r.dados.total).toBe(3);
    expect(r.dados.itens[1]).toMatchObject({ quemId: 'p02', entidade: 'evento', acao: 'marcou disponibilidade', justificativa: 'pelo celular' });
  });

  it('filtra por pessoa e por texto, sem diferença de acento', () => {
    const amb = ambiente();
    expect((amb.logs({ de: '2026-09-01', ate: '2026-10-31', quemId: 'p01' }) as { dados: Pagina }).dados.itens.map((h) => h.id)).toEqual(['h2', 'h1']);
    expect((amb.logs({ de: '2026-09-01', ate: '2026-10-31', texto: 'disponibilidade CELULAR' }) as { dados: Pagina }).dados.itens.map((h) => h.id)).toEqual(['h3']);
    expect((amb.logs({ de: '2026-09-01', ate: '2026-10-31', texto: 'publicacao' }) as { dados: Pagina }).dados.itens).toEqual([]);
    expect((amb.logs({ de: '2026-09-01', ate: '2026-10-31', texto: 'publicou' }) as { dados: Pagina }).dados.itens.map((h) => h.id)).toEqual(['h2']);
  });

  it('pagina de 100 em 100', () => {
    const amb = ambiente();
    for (let i = 0; i < 150; i++) {
      amb.repo.inserir('historico', { id: `x${i}`, quando: `2026-10-15T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, quemId: 'p01', entidade: 'escala', entidadeId: 's', acao: `ação ${i}`, antes: null, depois: null, justificativa: '' } as never);
    }
    const p1 = (amb.logs({ de: '2026-10-15', ate: '2026-10-15' }) as { dados: Pagina }).dados;
    const p2 = (amb.logs({ de: '2026-10-15', ate: '2026-10-15', pagina: 2 }) as { dados: Pagina }).dados;
    expect([p1.itens.length, p2.itens.length, p1.total]).toEqual([100, 50, 150]);
    expect(p1.itens[0].acao).toBe('ação 149');
  });

  it('só quem administra o sistema vê os logs', () => {
    const amb = ambiente();
    expect(amb.logs({ de: '2026-10-01', ate: '2026-10-31' }, amb.token('p02'))).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });
});
