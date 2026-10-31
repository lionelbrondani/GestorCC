import { describe, expect, it } from 'vitest';
import { descreverLugares, lugar, SETORES, todosLugares, type SetorId, type TipoLugar } from './poltronas';

// a planta dos testes é a do exemplo genérico (setor.ts)
const contar = (setor: SetorId, tipo?: TipoLugar) => todosLugares().filter((l) => l.setor === setor && (!tipo || l.tipo === tipo)).length;

describe('planta das poltronas', () => {
  it('conta os lugares de cada parte: 176 + 144 + 80 = 400', () => {
    expect(contar('baixa')).toBe(176);
    expect(contar('alta')).toBe(144);
    expect(contar('mezanino')).toBe(80);
    expect(todosLugares()).toHaveLength(400);
  });

  it('conta por tipo de lugar', () => {
    expect([contar('alta', 'pne'), contar('baixa', 'pne'), contar('mezanino', 'pne')]).toEqual([4, 0, 0]);
    expect([contar('alta', 'mobilidade'), contar('baixa', 'mobilidade'), contar('mezanino', 'mobilidade')]).toEqual([0, 2, 0]);
    expect([contar('alta', 'obeso'), contar('baixa', 'obeso'), contar('mezanino', 'obeso')]).toEqual([2, 2, 2]);
    expect([contar('alta', 'convencional'), contar('baixa', 'convencional'), contar('mezanino', 'convencional')]).toEqual([138, 172, 78]);
  });

  it('nenhum lugar repetido', () => {
    const ids = todosLugares().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('filas na ordem do palco para o fundo', () => {
    expect(SETORES.map((s) => s.filas.map((f) => f.fila).join(''))).toEqual(['ABCDEFGH', 'IJKLMN', 'ABCD']);
  });

  it('ímpares à esquerda, pares à direita, como no mapa', () => {
    const a = SETORES[0].filas[0];
    expect(a.blocos.map((b) => b.flat())).toEqual([
      [1, 3, 5, 7, 9],
      [11, 13, 15, 17, 19, 21, 22, 20, 18, 16, 14, 12],
      [10, 8, 6, 4, 2],
    ]);
  });

  it('acha um lugar pelo id e diz o tipo', () => {
    expect(lugar('alta:N01')).toMatchObject({ setor: 'alta', fila: 'N', numero: 1, tipo: 'pne', nome: 'N01' });
    expect(lugar('baixa:H11')?.tipo).toBe('mobilidade');
    expect(lugar('mezanino:A07')?.tipo).toBe('obeso');
    expect(lugar('baixa:Z99')).toBeNull();
  });

  it('descreve os lugares por setor, em ordem de fila e número', () => {
    expect(descreverLugares(['baixa:C03', 'baixa:C01', 'baixa:C05', 'baixa:C09', 'mezanino:A07', 'alta:L17'])).toBe(
      'Plateia Baixa: C01, C03, C05, C09 · Plateia Alta: L17 · Mezanino: A07',
    );
    expect(descreverLugares([])).toBe('');
  });
});
