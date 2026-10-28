import { AGRUPAMENTOS, ANALISE, ASSUNTOS_ANALISE, CONSULTAS, MEDIDAS, ORDENS, validarConsulta, type Consulta, type DataISO } from '@shared';

const MAX_PERGUNTA = 500;
/** As informações do setor, escritas em Configurações. */
const MAX_INFORMACOES = 2000;
/** Uma pergunta com várias partes pode virar até 3 consultas. */
const MAX_CONSULTAS = 3;

/** A função das perguntas complexas: contagens, somas, comparações e rankings, montadas por assunto. */
const DECLARACAO_ANALISE = {
  name: 'analise',
  description:
    'Contagens, somas, comparações e rankings sobre os dados do setor (ex.: quantas sessões por mês, quem mais trabalhou, quanto foi pago, ' +
    'contratos por situação). Assuntos: ' +
    ASSUNTOS_ANALISE.map((a) => `${a} = ${ANALISE[a].descricao} (agrupa por ${ANALISE[a].agrupar.join(', ')}; mede ${ANALISE[a].medidas.join(', ')})`).join('; ') +
    '.',
  parameters: {
    type: 'OBJECT',
    properties: {
      assunto: { type: 'STRING', enum: [...ASSUNTOS_ANALISE] },
      de: { type: 'STRING', description: 'Início do período, AAAA-MM-DD (vazio = sem limite)' },
      ate: { type: 'STRING', description: 'Fim do período, AAAA-MM-DD (vazio = sem limite)' },
      agrupar: { type: 'STRING', enum: [...AGRUPAMENTOS], description: 'Como separar os resultados; nenhum = só o total' },
      medida: { type: 'STRING', enum: [...MEDIDAS], description: 'contar = quantos; valor = soma em reais; publico = público estimado; quantidade = cortesias' },
      filtro: { type: 'STRING', description: 'Pessoa (ex.: PESSOA_1), evento ou destino para filtrar; vazio = todos' },
      ordem: { type: 'STRING', enum: [...ORDENS], description: 'maior/menor primeiro, ou cronologica (por mês)' },
      limite: { type: 'INTEGER', description: 'Quantos grupos mostrar (padrão 20)' },
    },
    required: ['assunto'],
  },
};

/**
 * Corpo enviado ao Gemini (spec 10.3): só a pergunta digitada (com os nomes de pessoas trocados por códigos), a lista
 * de consultas como funções, o manual de uso, as informações do setor escritas pela gestão e a data de hoje.
 * Nenhum dado das planilhas.
 */
export function montarPedido(pergunta: string, hoje: DataISO, manual: string, informacoes = ''): object {
  return {
    systemInstruction: {
      parts: [
        {
          text:
            `Você interpreta perguntas sobre o GestorCC, sistema do Centro de Convenções da UFSM. Hoje é ${hoje}. ` +
            'Se a pergunta pede dados (escalas, eventos, estoque, contratos, pagamentos, ocorrências, pedidos), chame uma função, com datas no formato AAAA-MM-DD: ' +
            'para listas simples, as funções específicas; para contagens, somas, comparações e rankings, a função analise. ' +
            `Uma pergunta com várias partes pode chamar até ${MAX_CONSULTAS} funções. Nomes de pessoas vêm como PESSOA_1, PESSOA_2: repita-os como estão. ` +
            'Se a pergunta é sobre como usar o sistema ou sobre o Centro de Convenções, responda em português, em até 3 frases, ' +
            `usando só o manual e as informações do setor abaixo. Se não souber, responda "Não sei".\n\n${manual}` +
            (informacoes.trim() ? `\n\nInformações do setor (escritas pela gestão):\n${informacoes.trim().slice(0, MAX_INFORMACOES)}` : ''),
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: pergunta.trim().slice(0, MAX_PERGUNTA) }] }],
    tools: [
      {
        functionDeclarations: [
          ...CONSULTAS.map((c) => ({
            name: c.nome,
            description: c.descricao,
            ...(c.parametro
              ? { parameters: { type: 'OBJECT', properties: { [c.parametro.nome]: { type: 'STRING', description: c.parametro.descricao } }, required: c.parametro.obrigatorio ? [c.parametro.nome] : [] } }
              : {}),
          })),
          DECLARACAO_ANALISE,
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };
}

/** Resposta do Gemini → consultas validadas (até 3), ou texto de ajuda; qualquer outra coisa vira nada. */
export function lerResposta(r: unknown): { consulta: Consulta | null; consultas: Consulta[]; ajuda: string | null } {
  const partes = (r as { candidates?: { content?: { parts?: { functionCall?: { name?: string; args?: unknown }; text?: string }[] } }[] })?.candidates?.[0]?.content?.parts ?? [];
  const chamadas = partes.filter((p) => p.functionCall).map((p) => p.functionCall!);
  if (chamadas.length) {
    const consultas = chamadas
      .map((c) => validarConsulta(c.name, c.args))
      .filter((c): c is Consulta => c !== null)
      .slice(0, MAX_CONSULTAS);
    return { consulta: consultas[0] ?? null, consultas, ajuda: null };
  }
  const texto = partes.map((p) => p.text ?? '').join('').trim();
  return { consulta: null, consultas: [], ajuda: texto && !/^não sei\.?$/i.test(texto) ? texto.slice(0, 600) : null };
}
