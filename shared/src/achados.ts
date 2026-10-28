import { diferencaDias, somarDias } from './datas';
import type { DataISO, Id } from './tipos';

/** Padrões de Configurações: dias até poder descartar e, depois da saída, até apagar a foto e quem retirou. */
export const DIAS_ACHADOS = 90;
export const DIAS_GUARDAR_ACHADOS = 90;

export type StatusAchado = 'guardado' | 'devolvido' | 'descartado';

export const ROTULO_STATUS_ACHADO: Record<StatusAchado, string> = { guardado: 'Guardado', devolvido: 'Devolvido', descartado: 'Descartado' };

/** O que se registra ao guardar um item achado. */
export interface AchadoDados {
  descricao: string;
  achadoEm: DataISO;
  local: string;
  eventoId: Id | null;
  /** Onde o item está guardado no setor (ex.: armário da secretaria). */
  guardadoEm: string;
  observacoes: string;
}

export interface Achado extends AchadoDados {
  id: Id;
  /** Número para a etiqueta do item (ex.: #7). */
  numero: number;
  status: StatusAchado;
  /** A foto fica no Drive; o app busca por achados.foto. */
  temFoto: boolean;
  registradoPorId: Id;
  /** Dia da devolução ou do descarte. */
  saidaEm: DataISO | null;
  /** Devolução: quem retirou e um documento ou telefone (planilha Sigiloso; só para quem edita). */
  retiradoPor: string;
  contatoRetirada: string;
  /** Descarte: para onde foi (lixo, doação…). */
  destino: string;
  /** Quando a limpeza da LGPD apagou a foto e os dados de quem retirou. */
  dadosApagadosEm: string;
}

/** Saída do item; 'guardado' desfaz uma devolução ou um descarte marcado por engano. */
export interface SaidaAchado {
  status: StatusAchado;
  data: DataISO;
  retiradoPor?: string;
  contatoRetirada?: string;
  destino?: string;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export function limparAchado(d: unknown): AchadoDados {
  const a = (d ?? {}) as Record<string, unknown>;
  return {
    descricao: texto(a.descricao, 200),
    achadoEm: texto(a.achadoEm, 10),
    local: texto(a.local, 80),
    eventoId: texto(a.eventoId, 40) || null,
    guardadoEm: texto(a.guardadoEm, 120),
    observacoes: texto(a.observacoes, 500),
  };
}

export function erroDoAchado(d: AchadoDados, hoje: DataISO): string | null {
  if (!d.descricao) return 'Descreva o item (ex.: guarda-chuva preto).';
  if (!DATA.test(d.achadoEm)) return 'Informe a data em que o item foi achado.';
  if (d.achadoEm > hoje) return 'A data em que foi achado não pode ser no futuro.';
  return null;
}

export function erroDaSaida(s: SaidaAchado, a: Pick<AchadoDados, 'achadoEm'>, hoje: DataISO): string | null {
  if (s.status === 'guardado') return null;
  if (!DATA.test(s.data)) return 'Informe a data.';
  if (s.data > hoje) return 'A data não pode ser no futuro.';
  if (s.data < a.achadoEm) return 'A data não pode ser antes de o item ser achado.';
  if (s.status === 'devolvido' && !s.retiradoPor?.trim()) return 'Informe quem retirou o item.';
  return null;
}

/** Dias guardado no setor e o prazo para descartar, que vence no dia em que o item completa o prazo. */
export function prazoDoAchado(achadoEm: DataISO, hoje: DataISO, prazo: number): { dias: number; faltam: number; vencido: boolean; descartarEm: DataISO } {
  const descartarEm = somarDias(achadoEm, prazo);
  return { dias: Math.max(0, diferencaDias(achadoEm, hoje)), faltam: Math.max(0, diferencaDias(hoje, descartarEm)), vencido: hoje >= descartarEm, descartarEm };
}

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** Ex.: "guardado há 16 dias · pode descartar em 74 dias". */
export function textoPrazoAchado(achadoEm: DataISO, hoje: DataISO, prazo: number): string {
  const p = prazoDoAchado(achadoEm, hoje, prazo);
  return `${p.dias ? `guardado há ${dias(p.dias)}` : 'guardado desde hoje'} · ${p.vencido ? 'prazo vencido, pode descartar' : `pode descartar em ${dias(p.faltam)}`}`;
}
