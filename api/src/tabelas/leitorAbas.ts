import type { Cache, NomeTabela, Planilha, Propriedades } from '../nucleo/portas';
import { cabecalhos, colunas, ESQUEMA } from './esquema';
import { linhaParaObjeto, objetoParaLinha } from './serializacao';

/** Lê de uma vez várias abas da mesma planilha: valores crus, primeira linha = cabeçalho. Aba inexistente fica de fora. */
export type LerPlanilha = (planilha: Planilha, abas: NomeTabela[]) => Partial<Record<NomeTabela, unknown[][]>>;

export interface AbaLida {
  cab: string[];
  linhas: Record<string, unknown>[];
}

export interface LeitorAbas {
  /** Memória da requisição → cache → planilha. O objeto devolvido é o da memória: o repositório o altera ao gravar. */
  aba(t: NomeTabela): AbaLida;
  /** Chame antes de gravar na aba: enquanto a escrita não termina, ninguém guarda leituras no cache. */
  antesDeEscrever(t: NomeTabela): void;
  /** Ao fim da escrita (ainda com a trava): muda a versão das abas gravadas e guarda o estado novo no cache. */
  concluirEscrita(): void;
  /** Esquece o que já leu (ao pegar a trava, para gravar sobre o estado mais recente). */
  descartar(): void;
}

/**
 * Propriedade com a época e a versão de cada aba. A chave no cache leva as duas: gravar muda a versão, uma época nova
 * (instalar, edição direto na planilha) muda tudo, e o dado velho simplesmente deixa de ser achado.
 */
const PROP = 'CACHE_ABAS';
/** O CacheService guarda no máximo 6 horas. */
const VALIDADE_S = 6 * 60 * 60;
/** Marca de escrita mais velha que isso é de uma execução que caiu (o Apps Script para em 6 minutos). */
const ESCRITA_MAX_MS = 6 * 60_000;
/** Caracteres por chave: com acentos (2 bytes) fica abaixo dos 100 KB que o cache aceita. */
const PEDACO = 40_000;
const MAX_PEDACOS = 25;
/** Dados sigilosos nunca vão para o cache. */
const SEM_CACHE = new Set<NomeTabela>(['dadosPessoais', 'contratantes', 'fichasSigilo', 'cortesiasSigilo', 'pedidosSigilo', 'achadosSigilo']);
/** Cresce a cada gravação e quase não é lido: só vem quando pedido. */
const SO_QUANDO_PEDIDA = new Set<NomeTabela>(['historico']);

interface Estado {
  epoca: string;
  v: Partial<Record<NomeTabela, number>>;
  escrevendo?: number;
}

function lerEstado(props: Propriedades): Estado | null {
  const bruto = props.obter(PROP);
  if (!bruto) return null;
  try {
    const e = JSON.parse(bruto);
    return e && typeof e.epoca === 'string' && e.v && typeof e.v === 'object' ? e : null;
  } catch {
    return null;
  }
}

/** Invalida o cache inteiro. Sem época, nada vai para o cache. */
export function novaEpocaCache(props: Propriedades, agoraMs: () => number): void {
  const epoca = `${agoraMs().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  props.definir(PROP, JSON.stringify({ epoca, v: {} } satisfies Estado));
}

/** Cria a época se ainda não existe (gatilho de minutos, depois de publicar a versão nova). */
export function garantirEpocaCache(props: Propriedades, agoraMs: () => number): void {
  if (!lerEstado(props)) novaEpocaCache(props, agoraMs);
}

function montar(t: NomeTabela, valores: unknown[][]): AbaLida {
  const cab = (valores[0]?.length ? valores[0] : cabecalhos(t)).map((c) => String(c).trim());
  const linhas = valores
    .slice(1)
    .filter((l) => l.some((v) => v !== '' && v !== null && v !== undefined))
    .map((l) => linhaParaObjeto(t, cab, l));
  return { cab, linhas };
}

/** Como a linha voltaria da planilha depois de gravada (texto, número, json, colunas fora do esquema somem). */
function comoNaPlanilha(t: NomeTabela, obj: Record<string, unknown>): Record<string, unknown> {
  const nomes = cabecalhos(t);
  return linhaParaObjeto(t, nomes, objetoParaLinha(t, nomes, obj));
}

export function criarLeitorAbas(o: { cache: Cache; props: Propriedades; agoraMs: () => number; ler: LerPlanilha; versaoApi: string }): LeitorAbas {
  const memoria = new Map<NomeTabela, AbaLida>();
  const planilhasVistas = new Set<Planilha>();
  const escritas = new Set<NomeTabela>();
  let estado: Estado | null | undefined;

  const atual = () => (estado === undefined ? (estado = lerEstado(o.props)) : estado);
  const chave = (e: Estado, t: NomeTabela, i: number) => `aba:${o.versaoApi}:${e.epoca}:${t}:${e.v[t] ?? 0}:${i}`;
  const escrevendo = (e: Estado) => !!e.escrevendo && o.agoraMs() - e.escrevendo < ESCRITA_MAX_MS;

  function pedacos(e: Estado, t: NomeTabela, a: AbaLida): Record<string, string> {
    const nomes = colunas(t).map((c) => c.nome);
    const texto = JSON.stringify({ cab: a.cab, l: a.linhas.map((x) => nomes.map((n) => x[n] ?? null)) });
    const n = Math.max(1, Math.ceil(texto.length / PEDACO));
    if (n > MAX_PEDACOS) return {};
    const r: Record<string, string> = {};
    for (let i = 0; i < n; i++) r[chave(e, t, i)] = (i === 0 ? `${n}|` : '') + texto.slice(i * PEDACO, (i + 1) * PEDACO);
    return r;
  }

  function doCache(e: Estado, tabelas: NomeTabela[]): void {
    const primeiros = o.cache.obterVarios(tabelas.map((t) => chave(e, t, 0)));
    const partes = new Map<NomeTabela, { n: number; inicio: string }>();
    const resto: string[] = [];
    for (const t of tabelas) {
      const v = primeiros[chave(e, t, 0)];
      const barra = v?.indexOf('|') ?? -1;
      if (!v || barra < 0) continue;
      const n = Number(v.slice(0, barra));
      partes.set(t, { n, inicio: v.slice(barra + 1) });
      for (let i = 1; i < n; i++) resto.push(chave(e, t, i));
    }
    const demais = resto.length ? o.cache.obterVarios(resto) : {};
    for (const [t, { n, inicio }] of partes) {
      const textos = [inicio];
      for (let i = 1; i < n; i++) textos.push(demais[chave(e, t, i)]);
      if (textos.some((x) => x === undefined)) continue; // pedaço expulso do cache: lê da planilha
      try {
        const { cab, l } = JSON.parse(textos.join('')) as { cab: string[]; l: unknown[][] };
        const nomes = colunas(t).map((c) => c.nome);
        memoria.set(t, { cab, linhas: l.map((r) => Object.fromEntries(nomes.map((nome, i) => [nome, r[i]]))) });
      } catch {
        // pedaço corrompido: lê da planilha
      }
    }
  }

  return {
    aba(t) {
      const pronta = memoria.get(t);
      if (pronta) return pronta;
      const p = ESQUEMA[t].planilha;
      const e = atual();
      const primeira = !planilhasVistas.has(p);
      planilhasVistas.add(p);
      // primeira vez na planilha: aproveita a ida e traz as abas dela (menos histórico e sigilosas), do cache ou numa leitura só
      const candidatas =
        e && primeira
          ? (Object.keys(ESQUEMA) as NomeTabela[]).filter((x) => ESQUEMA[x].planilha === p && !memoria.has(x) && (x === t || (!SO_QUANDO_PEDIDA.has(x) && !SEM_CACHE.has(x))))
          : [t];
      if (e) doCache(e, candidatas.filter((x) => !SEM_CACHE.has(x)));
      const faltam = candidatas.filter((x) => !memoria.has(x));
      if (faltam.length) {
        const lidas = o.ler(p, faltam);
        const guardar: Record<string, string> = {};
        for (const x of faltam) {
          const valores = lidas[x];
          if (!valores) continue;
          const a = montar(x, valores);
          memoria.set(x, a);
          if (e && !escrevendo(e) && !SEM_CACHE.has(x)) Object.assign(guardar, pedacos(e, x, a));
        }
        if (Object.keys(guardar).length) o.cache.guardarVarios(guardar, VALIDADE_S);
      }
      const a = memoria.get(t);
      if (!a) throw new Error(`Aba "${t}" não encontrada (rode instalar()).`);
      return a;
    },

    antesDeEscrever(t) {
      const primeira = !escritas.size;
      escritas.add(t);
      if (!primeira) return;
      const e = lerEstado(o.props);
      if (!e) return;
      e.escrevendo = o.agoraMs();
      o.props.definir(PROP, JSON.stringify(e));
      estado = e;
    },

    concluirEscrita() {
      if (!escritas.size) return;
      const e = lerEstado(o.props);
      if (e) {
        for (const t of escritas) e.v[t] = (e.v[t] ?? 0) + 1;
        delete e.escrevendo;
        const guardar: Record<string, string> = {};
        for (const t of escritas) {
          const a = memoria.get(t);
          if (a && !SEM_CACHE.has(t)) Object.assign(guardar, pedacos(e, t, { cab: a.cab, linhas: a.linhas.map((x) => comoNaPlanilha(t, x)) }));
        }
        if (Object.keys(guardar).length) o.cache.guardarVarios(guardar, VALIDADE_S);
        o.props.definir(PROP, JSON.stringify(e));
        estado = e;
      }
      escritas.clear();
    },

    descartar() {
      memoria.clear();
      planilhasVistas.clear();
      estado = undefined;
    },
  };
}
