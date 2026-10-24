import { diaAbsoluto, diferencaDias, horaParaMinutos } from '../datas';
import type { Sessao } from '../tipos';

export type TipoAlerta = 'conflito' | 'diasSeguidos' | 'mesmoDia';

const DURACAO_PADRAO_MIN = 180;

/** Intervalo ocupado pela sessão em minutos absolutos (dia × 1440 + hora). */
export function intervaloSessao(s: Sessao): { inicio: number; fim: number } | null {
  if (s.horarioADefinir) return null;
  const comeco = s.chegada ?? s.inicio;
  if (!comeco) return null;
  const base = diaAbsoluto(s.data) * 1440;
  const inicio = base + horaParaMinutos(comeco);
  const referenciaFim = s.inicio ?? s.chegada!;
  const fim = s.fim ? base + horaParaMinutos(s.fim) : base + horaParaMinutos(referenciaFim) + DURACAO_PADRAO_MIN;
  return { inicio, fim: Math.max(fim, inicio) };
}

function sobrepoem(a: Sessao, b: Sessao): boolean {
  const ia = intervaloSessao(a);
  const ib = intervaloSessao(b);
  if (!ia || !ib) return false;
  return ia.inicio < ib.fim && ib.inicio < ia.fim;
}

export function alertasDaEscala(alvo: Sessao, outrasDaPessoa: Sessao[]): TipoAlerta[] {
  const alertas = new Set<TipoAlerta>();
  for (const outra of outrasDaPessoa) {
    if (outra.id === alvo.id) continue;
    const dias = Math.abs(diferencaDias(alvo.data, outra.data));
    if (dias === 0) alertas.add(sobrepoem(alvo, outra) ? 'conflito' : 'mesmoDia');
    else if (dias === 1) alertas.add('diasSeguidos');
  }
  return (['conflito', 'diasSeguidos', 'mesmoDia'] as TipoAlerta[]).filter((a) => alertas.has(a));
}
