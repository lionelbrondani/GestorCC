import { describe, expect, it } from 'vitest';
import { agruparValores, validarConsulta } from './busca';

describe('análise montável (perguntas complexas)', () => {
  it('aceita o que o Gemini pede quando faz sentido para o assunto', () => {
    expect(validarConsulta('analise', { assunto: 'escalas', de: '2026-10-01', ate: '2026-10-31', agrupar: 'pessoa', medida: 'contar', ordem: 'maior', limite: 5 })).toEqual({
      nome: 'analise', assunto: 'escalas', de: '2026-10-01', ate: '2026-10-31', agrupar: 'pessoa', medida: 'contar', filtro: '', ordem: 'maior', limite: 5,
    });
  });

  it('o que não serve para o assunto vira o padrão dele; assunto desconhecido é recusado', () => {
    expect(validarConsulta('analise', { assunto: 'sessoes', agrupar: 'pessoa', medida: 'valor', de: 'ontem', limite: 999 })).toEqual({
      nome: 'analise', assunto: 'sessoes', de: null, ate: null, agrupar: 'mes', medida: 'contar', filtro: '', ordem: 'cronologica', limite: 50,
    });
    expect(validarConsulta('analise', { assunto: 'salarios' })).toBeNull();
  });

  it('agrupa e soma, ordena (do maior, do menor ou pela ordem do tempo) e corta no limite, com o total', () => {
    const valores = [
      { grupo: 'Ana', ordem: 'Ana', valor: 1 },
      { grupo: 'Bia', ordem: 'Bia', valor: 1 },
      { grupo: 'Ana', ordem: 'Ana', valor: 1 },
      { grupo: 'Caio', ordem: 'Caio', valor: 1 },
      { grupo: 'Ana', ordem: 'Ana', valor: 1 },
      { grupo: 'Bia', ordem: 'Bia', valor: 1 },
    ];
    expect(agruparValores(valores, 'maior', 2)).toEqual({ linhas: [['Ana', 3], ['Bia', 2]], total: 6, restantes: 1 });
    expect(agruparValores(valores, 'menor', 10).linhas).toEqual([['Caio', 1], ['Bia', 2], ['Ana', 3]]);
    const meses = [
      { grupo: 'nov/2026', ordem: '2026-11', valor: 2 },
      { grupo: 'out/2026', ordem: '2026-10', valor: 5 },
    ];
    expect(agruparValores(meses, 'cronologica', 10).linhas).toEqual([['out/2026', 5], ['nov/2026', 2]]);
  });
});
