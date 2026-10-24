import { paginarColunas } from './paginarColunas';

describe('paginarColunas', () => {
  it('quebra 25 colunas em páginas de 12', () => {
    const paginas = paginarColunas(Array.from({ length: 25 }, (_, i) => i), 12);
    expect(paginas.map((p) => p.length)).toEqual([12, 12, 1]);
  });
  it('lista vazia gera uma página vazia', () => {
    expect(paginarColunas([], 12)).toEqual([[]]);
  });
});
