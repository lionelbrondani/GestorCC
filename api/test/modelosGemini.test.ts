import { describe, expect, it } from 'vitest';
import { chamarComReserva } from '../src/busca/modelos';

/** Gemini de mentira: responde, por modelo, o código da lista (na ordem das chamadas) e anota quem foi chamado. */
function gemini(respostas: Record<string, number>) {
  const chamados: string[] = [];
  const chamar = (modelo: string) => {
    chamados.push(modelo);
    const codigo = respostas[modelo] ?? 404;
    return { codigo, corpo: codigo === 200 ? JSON.stringify({ modelo }) : '{}' };
  };
  return { chamar, chamados };
}

describe('modelo do Gemini com reserva', () => {
  it('usa o modelo escolhido quando ele responde', () => {
    const g = gemini({ 'gemini-3.8-flash': 200 });
    expect(chamarComReserva(null, g.chamar)).toEqual({ modelo: 'gemini-3.8-flash' });
    expect(g.chamados).toEqual(['gemini-3.8-flash']);
  });

  it('sobrecarregado ou fora do ar: tenta o modelo leve', () => {
    for (const codigo of [503, 429, 500, 404]) {
      const g = gemini({ 'gemini-3.8-flash': codigo, 'gemini-3.5-flash-lite': 200 });
      expect(chamarComReserva(null, g.chamar)).toEqual({ modelo: 'gemini-3.5-flash-lite' });
    }
  });

  it('chave inválida não adianta trocar de modelo; os dois falhando, o erro diz o código', () => {
    const invalida = gemini({ 'gemini-3.8-flash': 400, 'gemini-3.5-flash-lite': 200 });
    expect(() => chamarComReserva(null, invalida.chamar)).toThrow('Gemini respondeu 400');
    expect(invalida.chamados).toEqual(['gemini-3.8-flash']);
    expect(() => chamarComReserva(null, gemini({ 'gemini-3.8-flash': 503, 'gemini-3.5-flash-lite': 503 }).chamar)).toThrow('Gemini respondeu 503');
  });

  it('GEMINI_MODELO escolhe o primeiro; se for o leve, ele é o único', () => {
    const g = gemini({ 'gemini-3.5-flash-lite': 200 });
    expect(chamarComReserva('gemini-3.5-flash-lite', g.chamar)).toEqual({ modelo: 'gemini-3.5-flash-lite' });
    expect(g.chamados).toEqual(['gemini-3.5-flash-lite']);
  });
});
