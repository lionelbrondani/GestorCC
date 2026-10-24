import { describe, expect, it } from 'vitest';
import { MODELOS, MODULOS, ehGestor, pode } from './permissoes';

describe('pode', () => {
  it('operação não vê pagamentos', () => {
    expect(pode(MODELOS.operacao, 'pagamentos', 'ver')).toBe(false);
  });
  it('gestor edita contratos', () => {
    expect(pode(MODELOS.gestor, 'contratos', 'editar')).toBe(true);
  });
  it('eventual vê o mural mas não edita', () => {
    expect(pode(MODELOS.eventual, 'mural', 'ver')).toBe(true);
    expect(pode(MODELOS.eventual, 'mural', 'editar')).toBe(false);
  });
});

describe('ehGestor', () => {
  it('eventual não é gestor e operação é', () => {
    expect(ehGestor(MODELOS.eventual)).toBe(false);
    expect(ehGestor(MODELOS.operacao)).toBe(true);
  });
});

describe('MODULOS', () => {
  it('lista os 12 módulos do spec com nome', () => {
    expect(MODULOS).toHaveLength(12);
    expect(MODULOS.every((m) => m.nome.length > 0)).toBe(true);
  });
});
