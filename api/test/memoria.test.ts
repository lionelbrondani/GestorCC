import { describe, expect, it } from 'vitest';
import { criarRepositorioMemoria, relogioFixo } from '../src/adaptadores/memoria';

describe('repositório em memória', () => {
  it('inserir, atualizar (com carimbo) e remover', () => {
    const relogio = relogioFixo('2026-10-24T10:00');
    const repo = criarRepositorioMemoria({}, relogio);
    repo.inserir('feriados', { id: '2026-11-02', data: '2026-11-02', nome: 'Finados' });
    relogio.avancarMinutos(30);
    repo.atualizar('feriados', { id: '2026-11-02', data: '2026-11-02', nome: 'Dia de Finados' });
    const [f] = repo.listar<{ id: string; nome: string; atualizadoEm: string; criadoEm: string }>('feriados');
    expect(f.nome).toBe('Dia de Finados');
    expect(f.criadoEm).toBe('2026-10-24T10:00');
    expect(f.atualizadoEm).toBe('2026-10-24T10:30');
    repo.remover('feriados', '2026-11-02');
    expect(repo.listar('feriados')).toEqual([]);
  });

  it('atualizar id inexistente é erro', () => {
    const repo = criarRepositorioMemoria();
    expect(() => repo.atualizar('feriados', { id: 'x' })).toThrow();
  });

  it('inserir id repetido é erro', () => {
    const repo = criarRepositorioMemoria();
    repo.inserir('feriados', { id: 'x' });
    expect(() => repo.inserir('feriados', { id: 'x' })).toThrow();
  });

  it('lista devolve cópias (alterar o objeto não muda o repositório)', () => {
    const repo = criarRepositorioMemoria();
    repo.inserir('feriados', { id: 'x', nome: 'A' });
    repo.listar<{ id: string; nome: string }>('feriados')[0].nome = 'B';
    expect(repo.listar<{ id: string; nome: string }>('feriados')[0].nome).toBe('A');
  });
});
