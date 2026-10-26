/**
 * Planta das poltronas do teatro do Centro de Convenções, transcrita do mapa de assentos (referência do setor).
 * Cada fila tem três blocos (esquerda, centro, direita) na ordem em que aparecem no mapa, olhando do palco para o
 * fundo; um bloco pode ter trechos separados por corredor ou pilar. Ímpares ficam à esquerda e pares à direita.
 */

export type SetorId = 'baixa' | 'alta' | 'mezanino';
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

/** Ímpares de `de` até `ate`, em ordem crescente. */
const imp = (de: number, ate: number) => Array.from({ length: (ate - de) / 2 + 1 }, (_, i) => de + 2 * i);
/** Pares de `de` até `ate`, em ordem decrescente (como ficam no mapa, da esquerda para a direita). */
const par = (de: number, ate: number) => Array.from({ length: (de - ate) / 2 + 1 }, (_, i) => de - 2 * i);

/** Fila comum: esquerda ímpares 1..e, centro ímpares c1..c2 e pares p1..p2, direita pares d..2. */
function fila(f: string, esq: number, centro: [number, number, number, number], dir: number): FilaPlanta {
  return { fila: f, blocos: [[imp(1, esq)], [[...imp(centro[0], centro[1]), ...par(centro[2], centro[3])]], [par(dir, 2)]] };
}

export const SETORES: SetorPlanta[] = [
  {
    id: 'baixa',
    nome: 'Plateia Baixa',
    filas: [
      fila('A', 13, [15, 27, 28, 16], 14),
      fila('B', 13, [15, 29, 28, 16], 14),
      fila('C', 15, [17, 31, 30, 18], 16),
      fila('D', 15, [17, 31, 30, 18], 16),
      fila('E', 15, [17, 31, 32, 18], 16),
      fila('F', 13, [15, 29, 30, 16], 14),
      fila('G', 15, [17, 31, 32, 18], 16),
      fila('H', 17, [19, 35, 34, 20], 18),
      fila('I', 17, [19, 35, 34, 20], 18),
      fila('J', 17, [19, 35, 34, 20], 18),
      { fila: 'K', blocos: [[[1, 3], [11, 13]], [imp(15, 23), par(24, 16)], [[14, 12], [4, 2]]] },
    ],
  },
  {
    id: 'alta',
    nome: 'Plateia Alta',
    filas: [
      fila('L', 15, [17, 31, 32, 18], 16),
      fila('M', 19, [21, 37, 38, 22], 20),
      fila('N', 19, [21, 37, 38, 22], 20),
      fila('O', 19, [21, 39, 38, 22], 20),
      fila('P', 21, [23, 41, 40, 24], 22),
      fila('Q', 21, [23, 41, 40, 24], 22),
      fila('R', 19, [21, 39, 40, 22], 20),
      fila('S', 21, [23, 41, 42, 24], 22),
      // a partir da fila T o centro é dividido pela cabine de som (house mix)
      { fila: 'T', blocos: [[imp(1, 23)], [imp(25, 37), par(36, 26)], [par(24, 2)]] },
      { fila: 'U', blocos: [[imp(1, 23)], [imp(25, 37), par(36, 26)], [par(24, 2)]] },
      { fila: 'V', blocos: [[imp(1, 15), [17, 19]], [imp(21, 33), par(32, 22)], [[20, 18], par(16, 2)]] },
      { fila: 'W', blocos: [[imp(1, 15), [17, 19]], [imp(21, 33), par(32, 22)], [[20, 18], par(16, 2)]] },
      { fila: 'X', blocos: [[imp(1, 15)], [imp(17, 31), par(32, 18)], [par(16, 2)]] },
    ],
  },
  {
    id: 'mezanino',
    nome: 'Mezanino',
    filas: [
      fila('A', 21, [23, 37, 36, 24], 22),
      fila('B', 23, [25, 39, 38, 26], 24),
      fila('C', 23, [25, 39, 40, 26], 24),
      fila('D', 23, [25, 41, 40, 26], 24),
      fila('E', 23, [25, 49, 48, 26], 24),
      fila('F', 23, [25, 51, 50, 28], 26),
      fila('G', 23, [25, 49, 50, 28], 26),
      { fila: 'H', blocos: [[imp(1, 19)], [], [par(26, 2)]] },
      { fila: 'I', blocos: [[imp(1, 21)], [], []] },
      { fila: 'J', blocos: [[imp(1, 21)], [], []] },
    ],
  },
];

/** Lugares especiais (os demais são convencionais), como na legenda do mapa. */
const ESPECIAIS: Record<SetorId, Partial<Record<TipoLugar, string[]>>> = {
  baixa: { obeso: ['F13', 'F14'], mobilidade: ['K15', 'K16'] },
  alta: {
    pne: ['X01', 'X07', 'X09', 'X15', 'X17', 'X29', 'X31', 'X32', 'X30', 'X18', 'X16', 'X10', 'X08', 'X02'],
    mobilidade: ['M01', 'M19', 'W01', 'W19', 'W21', 'W22', 'M02', 'M20', 'W02', 'W20'],
    obeso: ['L01', 'L15', 'R19', 'L17', 'L18', 'L02', 'L16', 'R20'],
  },
  mezanino: { obeso: ['A21', 'A22'] },
};

const nomeLugar = (f: string, n: number) => `${f}${String(n).padStart(2, '0')}`;

function tipoDe(setor: SetorId, nome: string): TipoLugar {
  for (const [tipo, nomes] of Object.entries(ESPECIAIS[setor])) if (nomes!.includes(nome)) return tipo as TipoLugar;
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
