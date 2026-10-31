import { describe, expect, it } from 'vitest';
import { diasBloqueados, diasOcupados, erroDoBloqueio, situacaoDoDia } from './calendarioPedido';

describe('calendário do pedido de data', () => {
  it('ocupado = dia com sessão ativa de evento ativo (montagem e ensaio contam), sem repetir, em ordem', () => {
    const eventos = [
      { id: 'a', status: 'ativo' as const },
      { id: 'b', status: 'cancelado' as const },
    ];
    const sessoes = [
      { eventoId: 'a', data: '2026-12-12', status: 'ativa' as const },
      { eventoId: 'a', data: '2026-12-11', status: 'ativa' as const, atividade: 'montagem' as const },
      { eventoId: 'a', data: '2026-12-12', status: 'ativa' as const },
      { eventoId: 'a', data: '2026-12-13', status: 'cancelada' as const },
      { eventoId: 'b', data: '2026-12-14', status: 'ativa' as const },
      { eventoId: 'a', data: '2027-01-05', status: 'ativa' as const },
    ];
    expect(diasOcupados(sessoes, eventos, '2026-12-01', '2026-12-31')).toEqual(['2026-12-11', '2026-12-12']);
  });

  it('os períodos bloqueados viram dias, cortados na janela pedida', () => {
    const bloqueios = [{ de: '2026-12-24', ate: '2027-01-02' }, { de: '2026-12-08', ate: '2026-12-08' }];
    expect(diasBloqueados(bloqueios, '2026-12-01', '2026-12-31')).toEqual([
      '2026-12-08', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
    ]);
  });

  it('ocupado vale mais que bloqueado', () => {
    const ocupados = new Set(['2026-12-12']);
    const bloqueados = new Set(['2026-12-12', '2026-12-24']);
    expect(['2026-12-12', '2026-12-24', '2026-12-25'].map((d) => situacaoDoDia(d, ocupados, bloqueados))).toEqual(['ocupado', 'bloqueado', 'livre']);
  });

  it('o bloqueio precisa de datas em ordem e de no máximo um ano', () => {
    expect(erroDoBloqueio({ de: '2026-12-24', ate: '2027-01-02', motivo: 'Recesso' })).toBeNull();
    expect(erroDoBloqueio({ de: '', ate: '2027-01-02', motivo: '' })).toBe('Informe as datas do bloqueio.');
    expect(erroDoBloqueio({ de: '2026-12-24', ate: '2026-12-20', motivo: '' })).toBe('A data final precisa vir depois da inicial.');
    expect(erroDoBloqueio({ de: '2026-01-01', ate: '2027-06-01', motivo: '' })).toBe('Bloqueie no máximo um ano de cada vez.');
  });
});
