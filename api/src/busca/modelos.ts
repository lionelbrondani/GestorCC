/** Modelo do Gemini usado pela busca (GEMINI_MODELO troca) e o reserva, mais leve, para quando ele estiver sobrecarregado. */
export const MODELO_PADRAO = 'gemini-3.8-flash';
export const MODELO_RESERVA = 'gemini-3.5-flash-lite';

/** Respostas em que outro modelo pode dar certo: não existe para esta chave, limite, sobrecarga ou erro do Google. */
const VALE_TENTAR_OUTRO = new Set([404, 429, 500, 503]);

/**
 * Chama o modelo escolhido e, se ele estiver sobrecarregado (comum no plano gratuito), o reserva.
 * Chave inválida ou pedido errado não muda com outro modelo: o erro sobe na hora.
 */
export function chamarComReserva(escolhido: string | null, chamar: (modelo: string) => { codigo: number; corpo: string }): unknown {
  let codigo = 0;
  for (const modelo of new Set([escolhido || MODELO_PADRAO, MODELO_RESERVA])) {
    const r = chamar(modelo);
    codigo = r.codigo;
    if (codigo === 200) return JSON.parse(r.corpo);
    if (!VALE_TENTAR_OUTRO.has(codigo)) break;
  }
  throw new Error(`Gemini respondeu ${codigo}`);
}
