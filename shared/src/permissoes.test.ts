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
  it('lista os 14 módulos com nome', () => {
    expect(MODULOS).toHaveLength(14);
    expect(MODULOS.every((m) => m.nome.length > 0)).toBe(true);
  });
});

describe('achados e perdidos', () => {
  it('gestão e operação editam; eventual não acessa', () => {
    expect(pode(MODELOS.gestor, 'achados', 'editar')).toBe(true);
    expect(pode(MODELOS.operacao, 'achados', 'editar')).toBe(true);
    expect(pode(MODELOS.eventual, 'achados', 'ver')).toBe(false);
  });
});

describe('infraestrutura', () => {
  it('gestor edita, operação vê e eventual não acessa', () => {
    expect(pode(MODELOS.gestor, 'infraestrutura', 'editar')).toBe(true);
    expect(pode(MODELOS.operacao, 'infraestrutura', 'ver')).toBe(true);
    expect(pode(MODELOS.operacao, 'infraestrutura', 'editar')).toBe(false);
    expect(pode(MODELOS.eventual, 'infraestrutura', 'ver')).toBe(false);
  });
});
