import { describe, expect, it } from 'vitest';
import { formatarReais, valorPorExtenso } from './dinheiro';

describe('formatarReais', () => {
  it('diária', () => expect(formatarReais(8000)).toBe('R$ 80,00'));
  it('milhar', () => expect(formatarReais(608000)).toBe('R$ 6.080,00'));
  it('zero', () => expect(formatarReais(0)).toBe('R$ 0,00'));
});

describe('valorPorExtenso', () => {
  it.each([
    [0, 'zero reais'],
    [1, 'um centavo'],
    [100, 'um real'],
    [150, 'um real e cinquenta centavos'],
    [1001, 'dez reais e um centavo'],
    [10000, 'cem reais'],
    [10100, 'cento e um reais'],
    [21100, 'duzentos e onze reais'],
    [100000, 'mil reais'],
    [150000, 'mil e quinhentos reais'],
    [152000, 'mil quinhentos e vinte reais'],
    [102000, 'mil e vinte reais'],
    [500000, 'cinco mil reais'],
    [630000, 'seis mil e trezentos reais'],
    [123456, 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'],
    [1414000, 'catorze mil cento e quarenta reais'],
    [100000000, 'um milhão de reais'],
    [250000000, 'dois milhões e quinhentos mil reais'],
    [123456789, 'um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos'],
    [100000100, 'um milhão e um reais'],
  ])('%i centavos = %s', (centavos, texto) => expect(valorPorExtenso(centavos)).toBe(texto));
});
