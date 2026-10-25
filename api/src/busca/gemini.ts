import { CONSULTAS, validarConsulta, type Consulta, type DataISO } from '@shared';

const MAX_PERGUNTA = 500;

/**
 * Corpo enviado ao Gemini (spec 10.3): só a pergunta digitada, a lista de consultas como funções,
 * o manual de uso (sem dados reais) e a data de hoje. Nenhum dado das planilhas.
 */
export function montarPedido(pergunta: string, hoje: DataISO, manual: string): object {
  return {
    systemInstruction: {
      parts: [{
        text:
          `Você interpreta perguntas sobre o GestorCC, sistema do Centro de Convenções da UFSM. Hoje é ${hoje}. ` +
          'Se a pergunta pede dados (escalas, eventos, estoque, contratos, pagamentos, ocorrências), chame exatamente uma das funções, ' +
          'com datas no formato AAAA-MM-DD. Se a pergunta é sobre como usar o sistema, responda em português, em até 3 frases, ' +
          `usando só o manual abaixo. Se não souber, responda "Não sei".\n\n${manual}`,
      }],
    },
    contents: [{ role: 'user', parts: [{ text: pergunta.trim().slice(0, MAX_PERGUNTA) }] }],
    tools: [{
      functionDeclarations: CONSULTAS.map((c) => ({
        name: c.nome,
        description: c.descricao,
        ...(c.parametro
          ? { parameters: { type: 'OBJECT', properties: { [c.parametro.nome]: { type: 'STRING', description: c.parametro.descricao } }, required: c.parametro.obrigatorio ? [c.parametro.nome] : [] } }
          : {}),
      })),
    }],
    generationConfig: { temperature: 0 },
  };
}

/** Resposta do Gemini → consulta validada, ou texto de ajuda; qualquer outra coisa vira nada. */
export function lerResposta(r: unknown): { consulta: Consulta | null; ajuda: string | null } {
  const partes = (r as { candidates?: { content?: { parts?: { functionCall?: { name?: string; args?: unknown }; text?: string }[] } }[] })?.candidates?.[0]?.content?.parts ?? [];
  const chamada = partes.find((p) => p.functionCall)?.functionCall;
  if (chamada) return { consulta: validarConsulta(chamada.name, chamada.args), ajuda: null };
  const texto = partes.map((p) => p.text ?? '').join('').trim();
  return { consulta: null, ajuda: texto && !/^não sei\.?$/i.test(texto) ? texto.slice(0, 600) : null };
}
