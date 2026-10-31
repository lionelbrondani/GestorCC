/**
 * Calendário da página pública de pedido de data: cada dia está livre, ocupado (já tem sessão: só lista de espera)
 * ou bloqueado pela gestão (dá para pedir, com aviso). A página pública não fica sabendo o evento nem o motivo.
 */
import { diferencaDias, somarDias } from './datas';
import type { DataISO, Evento, Id, Sessao } from './tipos';

export interface BloqueioData {
  id: Id;
  de: DataISO;
  ate: DataISO;
  /** Só a gestão vê (manutenção, recesso, reservado para a instituição…). */
  motivo: string;
}

export type SituacaoDia = 'livre' | 'ocupado' | 'bloqueado';

/** Quantos dias a página pública consulta de uma vez (um mês, com folga). */
export const MAX_DIAS_CALENDARIO = 62;
export const MAX_DIAS_BLOQUEIO = 366;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Dias com sessão ativa de evento não cancelado (montagem, ensaio e desmontagem contam), entre de e ate. */
export function diasOcupados(
  sessoes: Pick<Sessao, 'eventoId' | 'data' | 'status'>[],
  eventos: Pick<Evento, 'id' | 'status'>[],
  de: DataISO,
  ate: DataISO,
): DataISO[] {
  const cancelados = new Set(eventos.filter((e) => e.status === 'cancelado').map((e) => e.id));
  const dias = sessoes.filter((s) => s.status === 'ativa' && !cancelados.has(s.eventoId) && s.data >= de && s.data <= ate).map((s) => s.data);
  return [...new Set(dias)].sort();
}

/** Os períodos bloqueados viram dias, cortados na janela de e ate. */
export function diasBloqueados(bloqueios: Pick<BloqueioData, 'de' | 'ate'>[], de: DataISO, ate: DataISO): DataISO[] {
  const dias = new Set<DataISO>();
  for (const b of bloqueios) {
    for (let d = b.de > de ? b.de : de; d <= b.ate && d <= ate; d = somarDias(d, 1)) dias.add(d);
  }
  return [...dias].sort();
}

export function situacaoDoDia(data: DataISO, ocupados: Set<DataISO>, bloqueados: Set<DataISO>): SituacaoDia {
  return ocupados.has(data) ? 'ocupado' : bloqueados.has(data) ? 'bloqueado' : 'livre';
}

export function erroDoBloqueio(b: { de: string; ate: string; motivo: string }): string | null {
  if (!DATA.test(b.de) || !DATA.test(b.ate)) return 'Informe as datas do bloqueio.';
  if (b.ate < b.de) return 'A data final precisa vir depois da inicial.';
  if (diferencaDias(b.de, b.ate) >= MAX_DIAS_BLOQUEIO) return 'Bloqueie no máximo um ano de cada vez.';
  return null;
}
