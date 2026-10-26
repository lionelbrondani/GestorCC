import { describe, expect, it } from 'vitest';
import { alternar, contarPorSetor, intervaloNaFila } from './selecao';

const g = (nome: string, lugares: string[]) => ({ nome, lugares });

describe('seleção de poltronas', () => {
  it('toque marca no grupo ativo e toque de novo desmarca', () => {
    const um = alternar([g('Autoridades', [])], 0, ['baixa:A01']);
    expect(um).toEqual([g('Autoridades', ['baixa:A01'])]);
    expect(alternar(um, 0, ['baixa:A01'])).toEqual([g('Autoridades', [])]);
  });

  it('marcar no grupo ativo tira o lugar do outro grupo', () => {
    const r = alternar([g('A', ['baixa:A01']), g('B', [])], 1, ['baixa:A01', 'baixa:A03']);
    expect(r).toEqual([g('A', []), g('B', ['baixa:A01', 'baixa:A03'])]);
  });

  it('fila inteira: se já está toda no grupo, desmarca; senão marca o que falta', () => {
    const fila = ['baixa:K01', 'baixa:K03'];
    const parcial = [g('A', ['baixa:K01'])];
    expect(alternar(parcial, 0, fila)).toEqual([g('A', ['baixa:K01', 'baixa:K03'])]);
    expect(alternar([g('A', fila)], 0, fila)).toEqual([g('A', [])]);
  });

  it('intervalo na mesma fila segue a ordem do mapa, nos dois sentidos', () => {
    expect(intervaloNaFila('baixa:A11', 'baixa:A17')).toEqual(['baixa:A11', 'baixa:A13', 'baixa:A15', 'baixa:A17']);
    expect(intervaloNaFila('baixa:A17', 'baixa:A11')).toEqual(['baixa:A11', 'baixa:A13', 'baixa:A15', 'baixa:A17']);
    expect(intervaloNaFila('baixa:A01', 'baixa:B01')).toEqual(['baixa:B01']);
  });

  it('conta por setor', () => {
    expect(contarPorSetor([g('A', ['baixa:A01', 'alta:L03']), g('B', ['baixa:A03'])])).toEqual({ baixa: 2, alta: 1, mezanino: 0 });
  });
});
