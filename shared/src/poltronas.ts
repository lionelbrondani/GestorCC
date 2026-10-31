/**
 * Planta das poltronas do teatro. A planta vem dos dados do setor (setor.ts); no git, só a do exemplo.
 * Cada fila tem três blocos (esquerda, centro, direita) na ordem em que aparecem no mapa, olhando do palco para o
 * fundo; um bloco pode ter trechos separados por corredor ou pilar. Ímpares ficam à esquerda e pares à direita.
 */

import { SETOR } from './setor';

/** Parte do teatro, ex.: 'baixa', 'alta', 'mezanino'. */
export type SetorId = string;
export type TipoLugar = 'convencional' | 'pne' | 'mobilidade' | 'obeso';

export interface FilaPlanta {
  fila: string;
  /** [esquerda, centro, direita]; cada bloco é uma lista de trechos, cada trecho uma lista de números na ordem do mapa. */
  blocos: number[][][];
}

export interface SetorPlanta {
  id: SetorId;
  nome: string;
  filas: FilaPlanta[];
}

export interface Lugar {
  /** 'setor:FILA00', ex.: 'baixa:A01'. */
  id: string;
  setor: SetorId;
  fila: string;
  numero: number;
  /** Como aparece na poltrona, ex.: 'A01'. */
  nome: string;
  tipo: TipoLugar;
}

export const NOMES_TIPO_LUGAR: Record<TipoLugar, string> = {
  convencional: 'Convencional',
  pne: 'PNE (cadeirante)',
  mobilidade: 'Mobilidade reduzida',
  obeso: 'Pessoa obesa',
};

export const SETORES: SetorPlanta[] = SETOR.planta.setores;

/** Lugares especiais (os demais são convencionais), como na legenda do mapa. */
const ESPECIAIS = SETOR.planta.especiais;

const nomeLugar = (f: string, n: number) => `${f}${String(n).padStart(2, '0')}`;

function tipoDe(setor: SetorId, nome: string): TipoLugar {
  for (const [tipo, nomes] of Object.entries(ESPECIAIS[setor] ?? {})) if (nomes!.includes(nome)) return tipo as TipoLugar;
  return 'convencional';
}

let cache: Lugar[] | null = null;
let porId: Map<string, Lugar> | null = null;

/** Todos os lugares, na ordem dos setores, filas e do mapa. */
export function todosLugares(): Lugar[] {
  if (!cache) {
    cache = SETORES.flatMap((s) =>
      s.filas.flatMap((f) =>
        f.blocos.flat(2).map((n) => {
          const nome = nomeLugar(f.fila, n);
          return { id: `${s.id}:${nome}`, setor: s.id, fila: f.fila, numero: n, nome, tipo: tipoDe(s.id, nome) };
        }),
      ),
    );
    porId = new Map(cache.map((l) => [l.id, l]));
  }
  return cache;
}

export function lugar(id: string): Lugar | null {
  todosLugares();
  return porId!.get(id) ?? null;
}

/** Ids dos lugares de uma fila inteira. */
export function lugaresDaFila(setor: SetorId, f: string): string[] {
  return todosLugares().filter((l) => l.setor === setor && l.fila === f).map((l) => l.id);
}

/** Texto curto: 'Plateia Baixa: C01, C03 · Mezanino: A21'. Ids desconhecidos são ignorados. */
export function descreverLugares(ids: string[]): string {
  const validos = new Set(ids);
  return SETORES.map((s) => {
    const nomes = s.filas.flatMap((f) =>
      todosLugares()
        .filter((l) => l.setor === s.id && l.fila === f.fila && validos.has(l.id))
        .sort((a, b) => a.numero - b.numero)
        .map((l) => l.nome),
    );
    return nomes.length ? `${s.nome}: ${nomes.join(', ')}` : '';
  })
    .filter(Boolean)
    .join(' · ');
}
