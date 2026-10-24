import { describe, expect, it } from 'vitest';
import { estoqueCritico, formatarCod, quantidadeSugerida, saldoDosMovimentos, validarRetirada } from './almox';
import type { AlmoxItem, AlmoxMovimento } from './tipos';

function item(parcial: Partial<AlmoxItem>): AlmoxItem {
  return {
    cod: '0041', nomeAlmox: 'FITA CREPE', nomeComum: 'Fita crepe', unidade: 'Rolo', valor: 500,
    categoria: 'Expediente', qtdMinima: 4, sala: '308', status: 'Ativo', saldo: 3, ...parcial,
  };
}

function mov(tipo: AlmoxMovimento['tipo'], qtd: number, cod = '0041'): AlmoxMovimento {
  return { id: `${tipo}${qtd}`, quando: '2026-10-01T10:00', tipo, cod, qtd, valorUnitario: 500 };
}

describe('almoxarifado', () => {
  it('saldo vem dos movimentos do item', () => {
    expect(saldoDosMovimentos([mov('ajuste', 10), mov('saida', -3), mov('recebimento', 5), mov('ajuste', 99, '0001')], '0041')).toBe(12);
  });
  it('crítico quando saldo ≤ mínimo e ativo', () => {
    expect(estoqueCritico(item({ saldo: 4 }))).toBe(true);
    expect(estoqueCritico(item({ saldo: 5 }))).toBe(false);
    expect(estoqueCritico(item({ saldo: 0, status: 'Inativo' }))).toBe(false);
  });
  it('quantidade sugerida', () => {
    expect(quantidadeSugerida(item({ qtdMinima: 4, saldo: 1 }))).toBe(7);
    expect(quantidadeSugerida(item({ qtdMinima: 0, saldo: 0 }))).toBe(1);
  });
  it('retirada acima do saldo é recusada', () => {
    expect(validarRetirada([{ cod: '0041', qtd: 5 }], [item({ saldo: 3 })])).toEqual([
      { cod: '0041', erro: 'Saldo insuficiente (disponível: 3)' },
    ]);
  });
  it('outros erros de retirada', () => {
    expect(validarRetirada([{ cod: '0041', qtd: 0 }], [item({})])[0].erro).toBe('Quantidade deve ser maior que zero');
    expect(validarRetirada([{ cod: '0041', qtd: 1 }], [item({ status: 'Inativo' })])[0].erro).toBe('Item inativo');
    expect(validarRetirada([{ cod: '9999', qtd: 1 }], [item({})])[0].erro).toBe('Item não encontrado');
  });
  it('soma linhas repetidas do mesmo item ao validar', () => {
    expect(validarRetirada([{ cod: '0041', qtd: 2 }, { cod: '0041', qtd: 2 }], [item({ saldo: 3 })])).toHaveLength(1);
  });
  it('formata código com 4 dígitos', () => {
    expect(formatarCod('41')).toBe('0041');
    expect(formatarCod(4119)).toBe('4119');
  });
});
