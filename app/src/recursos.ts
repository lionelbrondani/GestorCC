import { MODULOS, type Modulo } from '@shared';

/** Áreas do app que podem ser ligadas por fase. */
export type Recurso = Modulo | 'escalasPessoais' | 'relatar';

export const TODOS_RECURSOS: Recurso[] = [...MODULOS.map((m) => m.id), 'escalasPessoais', 'relatar'];

/** Lê a lista separada por vírgula (VITE_RECURSOS). Vazia = tudo ativo (protótipo). */
export function lerRecursos(texto: string | undefined): Set<Recurso> {
  const itens = (texto ?? '').split(',').map((s) => s.trim()).filter(Boolean) as Recurso[];
  return new Set(itens.length ? itens : TODOS_RECURSOS);
}

let ativos = lerRecursos(import.meta.env.VITE_RECURSOS);

/** Usado nos testes para simular uma fase. `null` volta ao valor do ambiente. */
export function definirRecursos(texto: string | null) {
  ativos = lerRecursos(texto ?? import.meta.env.VITE_RECURSOS);
}

export function recursosAtivos(): Set<Recurso> {
  return ativos;
}

export function recursoAtivo(r: Recurso): boolean {
  return ativos.has(r);
}
