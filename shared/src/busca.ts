import type { DataISO } from './tipos';

/** Assuntos da análise montável (perguntas com contagens, somas e rankings). */
export const ASSUNTOS_ANALISE = ['sessoes', 'escalas', 'pagamentos', 'contratos', 'cortesias', 'ocorrencias', 'pedidos'] as const;
export const AGRUPAMENTOS = ['mes', 'tipo', 'evento', 'pessoa', 'status', 'categoria', 'destino', 'nenhum'] as const;
export const MEDIDAS = ['contar', 'valor', 'publico', 'quantidade'] as const;
export const ORDENS = ['maior', 'menor', 'cronologica'] as const;

export type AssuntoAnalise = (typeof ASSUNTOS_ANALISE)[number];
export type Agrupamento = (typeof AGRUPAMENTOS)[number];
export type Medida = (typeof MEDIDAS)[number];
export type OrdemAnalise = (typeof ORDENS)[number];

/** O que cada assunto aceita: o primeiro agrupamento e a primeira medida são o padrão. */
export const ANALISE: Record<AssuntoAnalise, { descricao: string; agrupar: Agrupamento[]; medidas: Medida[] }> = {
  sessoes: { descricao: 'sessões e eventos da agenda (público = público estimado dos eventos)', agrupar: ['mes', 'tipo', 'evento', 'nenhum'], medidas: ['contar', 'publico'] },
  escalas: { descricao: 'quem trabalhou: escalas publicadas e realizadas', agrupar: ['pessoa', 'mes', 'evento', 'nenhum'], medidas: ['contar'] },
  pagamentos: { descricao: 'diárias dos lotes de pagamento, pela data do pagamento (valor em reais)', agrupar: ['pessoa', 'mes', 'status', 'nenhum'], medidas: ['valor', 'contar'] },
  contratos: { descricao: 'contratos, pela data de vencimento (valor total com aditivos)', agrupar: ['status', 'mes', 'nenhum'], medidas: ['contar', 'valor'] },
  cortesias: { descricao: 'cortesias reservadas por evento e destino', agrupar: ['evento', 'destino', 'nenhum'], medidas: ['quantidade'] },
  ocorrencias: { descricao: 'problemas do prédio (ocorrências), pela data do relato', agrupar: ['status', 'categoria', 'mes', 'nenhum'], medidas: ['contar'] },
  pedidos: { descricao: 'pedidos de data recebidos pela página pública, pela data em que chegaram', agrupar: ['status', 'categoria', 'mes', 'nenhum'], medidas: ['contar'] },
};

export interface ConsultaAnalise {
  nome: 'analise';
  assunto: AssuntoAnalise;
  /** Período; null = o padrão do assunto (o último ano e os próximos meses). */
  de: DataISO | null;
  ate: DataISO | null;
  agrupar: Agrupamento;
  medida: Medida;
  /** Nome de pessoa, evento ou destino para filtrar (vazio = todos). */
  filtro: string;
  ordem: OrdemAnalise;
  limite: number;
}

/** Consultas que a busca sabe responder (spec 10.3). A pergunta vira uma delas; a consulta roda com as permissões de quem perguntou. */
export type Consulta =
  | { nome: 'escalaDoDia'; data: DataISO }
  | { nome: 'escalasDaPessoa'; termo: string }
  | { nome: 'proximosEventos' }
  | { nome: 'vagasFaltando' }
  | { nome: 'naoResponderam' }
  | { nome: 'saldoItem'; termo: string }
  | { nome: 'estoqueCritico' }
  | { nome: 'contratosPendentes' }
  | { nome: 'lotesEmAberto' }
  | { nome: 'ocorrenciasAbertas'; termo: string }
  | ConsultaAnalise;

/** Descrição de cada consulta e do parâmetro que ela pede (vira a lista de funções para o Gemini). */
export const CONSULTAS: { nome: Exclude<Consulta['nome'], 'analise'>; descricao: string; parametro?: { nome: 'data' | 'termo'; descricao: string; obrigatorio: boolean } }[] = [
  { nome: 'escalaDoDia', descricao: 'Quem está escalado num dia (equipe de um dia ou de uma sessão).', parametro: { nome: 'data', descricao: 'Data no formato AAAA-MM-DD', obrigatorio: true } },
  { nome: 'escalasDaPessoa', descricao: 'Próximas escalas de uma pessoa.', parametro: { nome: 'termo', descricao: 'Nome ou parte do nome da pessoa', obrigatorio: true } },
  { nome: 'proximosEventos', descricao: 'Próximos eventos da agenda.' },
  { nome: 'vagasFaltando', descricao: 'Sessões com vagas de bolsista ainda faltando.' },
  { nome: 'naoResponderam', descricao: 'Quem ainda não respondeu a rodada de disponibilidade aberta.' },
  { nome: 'saldoItem', descricao: 'Saldo de um item do almoxarifado.', parametro: { nome: 'termo', descricao: 'Nome ou código do item', obrigatorio: true } },
  { nome: 'estoqueCritico', descricao: 'Itens do almoxarifado com estoque no mínimo ou abaixo.' },
  { nome: 'contratosPendentes', descricao: 'Contratos com pendência (fatura, ECAD, ISS, assinatura, cortesias).' },
  { nome: 'lotesEmAberto', descricao: 'Lotes de pagamento enviados e ainda não pagos.' },
  { nome: 'ocorrenciasAbertas', descricao: 'Ocorrências de infraestrutura do prédio em aberto.', parametro: { nome: 'termo', descricao: 'Palavra para filtrar, ex.: vazamento, lâmpada (vazio = todas)', obrigatorio: false } },
];

const umDe = <T extends string>(v: unknown, opcoes: readonly T[]): T | null => (opcoes.includes(v as T) ? (v as T) : null);

/** Confere a análise pedida pelo Gemini: o que não serve para o assunto vira o padrão dele. */
export function validarAnalise(args: unknown): ConsultaAnalise | null {
  const a = (args ?? {}) as Record<string, unknown>;
  const assunto = umDe(a.assunto, ASSUNTOS_ANALISE);
  if (!assunto) return null;
  const def = ANALISE[assunto];
  const agrupar = umDe(a.agrupar, def.agrupar) ?? def.agrupar[0];
  const data = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    nome: 'analise',
    assunto,
    de: data(a.de),
    ate: data(a.ate),
    agrupar,
    medida: umDe(a.medida, def.medidas) ?? def.medidas[0],
    filtro: String(a.filtro ?? '').trim().slice(0, 80),
    ordem: umDe(a.ordem, ORDENS) ?? (agrupar === 'mes' ? 'cronologica' : 'maior'),
    limite: Math.min(50, Math.max(1, Math.round(Number(a.limite) || 20))),
  };
}

/** Confere nome e parâmetros vindos de fora (Gemini); devolve a consulta ou null. */
export function validarConsulta(nome: unknown, args: unknown): Consulta | null {
  if (nome === 'analise') return validarAnalise(args);
  const def = CONSULTAS.find((c) => c.nome === nome);
  if (!def) return null;
  if (!def.parametro) return { nome: def.nome } as Consulta;
  const valor = String((args as Record<string, unknown> | null)?.[def.parametro.nome] ?? '').trim();
  if (def.parametro.nome === 'data') return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? ({ nome: def.nome, data: valor } as Consulta) : null;
  if (def.parametro.obrigatorio && !valor) return null;
  return { nome: def.nome, termo: valor.slice(0, 80) } as Consulta;
}

/**
 * Soma os valores de cada grupo e ordena: do maior, do menor ou pela ordem do tempo (a chave `ordem`, ex.: '2026-10').
 * Corta no limite e devolve o total de tudo e quantos grupos ficaram de fora.
 */
export function agruparValores(
  valores: { grupo: string; ordem: string; valor: number }[],
  ordem: OrdemAnalise,
  limite: number,
): { linhas: [string, number][]; total: number; restantes: number } {
  const grupos = new Map<string, { ordem: string; valor: number }>();
  for (const v of valores) {
    const g = grupos.get(v.grupo) ?? { ordem: v.ordem, valor: 0 };
    g.valor += v.valor;
    grupos.set(v.grupo, g);
  }
  const lista = [...grupos].sort(([, a], [, b]) => (ordem === 'cronologica' ? a.ordem.localeCompare(b.ordem) : ordem === 'maior' ? b.valor - a.valor : a.valor - b.valor));
  return {
    linhas: lista.slice(0, limite).map(([grupo, g]) => [grupo, g.valor]),
    total: valores.reduce((n, v) => n + v.valor, 0),
    restantes: Math.max(0, lista.length - limite),
  };
}
