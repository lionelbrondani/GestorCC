import type { Consulta, DataISO } from '@shared';
import type { QueryClient } from '@tanstack/react-query';
import type { ApiCliente } from '../api/cliente';
import { executarConsulta, type RespostaBusca } from './executar';
import { interpretarSimulado } from './interpretarSimulado';
import { devolverNaConsulta, protegerNomes } from './nomes';

export type TrocaConversa = { pergunta: string; resposta: string };

export interface ResultadoPergunta {
  /** Os cartões de resposta; vazio quando nada foi entendido. */
  respostas: RespostaBusca[];
  motivo: 'limite' | 'indisponivel' | null;
  /** Resposta curta para a conversa do Urubu (o texto de ajuda ou os títulos), sem os dados. */
  resumo: string;
}

/** Separa as mensagens da conversa na hora de trocar os nomes por códigos (ninguém digita esse símbolo). */
const SEPARADOR = '\n␞\n';

/**
 * Pergunta da barra de busca e do Urubu. Os nomes das pessoas viram códigos antes de ir ao Gemini, e a conversa
 * inteira é protegida junta, para o mesmo código valer em todas as mensagens; sem a lista de pessoas, nada vai.
 * As consultas (até 3) rodam aqui, com as permissões de quem perguntou. Sem resposta da API, vale a interpretação
 * por palavras-chave.
 */
export async function responderPergunta(
  api: ApiCliente,
  qc: QueryClient,
  termo: string,
  hoje: DataISO,
  extra: { historico?: TrocaConversa[]; persona?: 'urubu' } = {},
): Promise<ResultadoPergunta> {
  const pessoas = await qc
    .fetchQuery({ queryKey: ['pessoas.listar', null], queryFn: () => api.chamar('pessoas.listar', null), staleTime: 5 * 60_000 })
    .catch(() => null);
  const historico = extra.historico ?? [];
  let devolver = (s: string) => s;
  let r: Awaited<ReturnType<typeof api.chamar<'busca.interpretar'>>> | null = null;
  if (pessoas) {
    const protegida = protegerNomes([...historico.flatMap((t) => [t.pergunta, t.resposta]), termo].join(SEPARADOR), pessoas);
    const partes = protegida.texto.split(SEPARADOR);
    const anteriores = historico.map((_, i) => ({ pergunta: partes[2 * i], resposta: partes[2 * i + 1] }));
    devolver = protegida.devolver;
    r = await api
      .chamar('busca.interpretar', {
        pergunta: partes[partes.length - 1],
        ...(anteriores.length ? { historico: anteriores } : {}),
        ...(extra.persona ? { persona: extra.persona } : {}),
      })
      .catch(() => null);
  }
  if (r?.ajuda) {
    const texto = devolver(r.ajuda);
    return { respostas: [{ titulo: texto, itens: [] }], motivo: null, resumo: texto };
  }
  const doGemini = r?.consultas?.length ? r.consultas : r?.consulta ? [r.consulta] : [];
  const consultas = doGemini.length
    ? doGemini.map((c) => devolverNaConsulta(c, devolver))
    : [interpretarSimulado(termo, hoje)].filter((c): c is Consulta => c !== null);
  if (!consultas.length) return { respostas: [], motivo: r?.motivo ?? null, resumo: 'Não entendi a pergunta.' };
  const respostas = await Promise.all(consultas.map((c) => executarConsulta(c, api, hoje)));
  return { respostas, motivo: r?.motivo ?? null, resumo: respostas.map((x) => x.titulo).join('; ') };
}
