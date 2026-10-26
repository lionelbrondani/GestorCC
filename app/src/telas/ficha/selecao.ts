import { lugar, lugaresDaFila, type GrupoPoltronas, type SetorId } from '@shared';

/**
 * Marca ou desmarca lugares no grupo ativo. Se todos já estão no grupo, desmarca; senão marca os que faltam,
 * tirando-os de outro grupo (um lugar só pertence a um grupo).
 */
export function alternar(grupos: GrupoPoltronas[], ativo: number, ids: string[]): GrupoPoltronas[] {
  const doAtivo = new Set(grupos[ativo]?.lugares ?? []);
  const desmarcar = ids.every((id) => doAtivo.has(id));
  const alvo = new Set(ids);
  return grupos.map((g, i) => {
    if (i !== ativo) return { ...g, lugares: desmarcar ? g.lugares : g.lugares.filter((id) => !alvo.has(id)) };
    return { ...g, lugares: desmarcar ? g.lugares.filter((id) => !alvo.has(id)) : [...g.lugares, ...ids.filter((id) => !doAtivo.has(id))] };
  });
}

/** Lugares entre dois da mesma fila, na ordem do mapa (Shift+clique). De filas diferentes, só o segundo. */
export function intervaloNaFila(de: string, ate: string): string[] {
  const a = lugar(de);
  const b = lugar(ate);
  if (!a || !b || a.setor !== b.setor || a.fila !== b.fila) return [ate];
  const fila = lugaresDaFila(a.setor, a.fila);
  const [i, j] = [fila.indexOf(de), fila.indexOf(ate)].sort((x, y) => x - y);
  return fila.slice(i, j + 1);
}

export function contarPorSetor(grupos: GrupoPoltronas[]): Record<SetorId, number> {
  const r: Record<SetorId, number> = { baixa: 0, alta: 0, mezanino: 0 };
  for (const g of grupos) for (const id of g.lugares) {
    const l = lugar(id);
    if (l) r[l.setor]++;
  }
  return r;
}
