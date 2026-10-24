import type { DataISO, Hora } from './tipos';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
const DIA_MS = 86_400_000;

function partes(d: DataISO): [number, number, number] {
  const [a, m, dia] = d.split('-').map(Number);
  return [a, m, dia];
}

function emUtc(d: DataISO): number {
  const [a, m, dia] = partes(d);
  return Date.UTC(a, m - 1, dia);
}

function deUtc(ms: number): DataISO {
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatarData(d: DataISO): string {
  const [a, m, dia] = partes(d);
  return `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

export function diaDaSemana(d: DataISO): string {
  return DIAS[new Date(emUtc(d)).getUTCDay()];
}

export function diaDaSemanaCurto(d: DataISO): string {
  return DIAS_CURTOS[new Date(emUtc(d)).getUTCDay()];
}

export function somarDias(d: DataISO, n: number): DataISO {
  return deUtc(emUtc(d) + n * DIA_MS);
}

export function diferencaDias(a: DataISO, b: DataISO): number {
  return Math.round((emUtc(b) - emUtc(a)) / DIA_MS);
}

export function mesExtenso(mes: number): string {
  return MESES[mes - 1];
}

export function diasDoMes(ano: number, mes: number): DataISO[] {
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => deUtc(Date.UTC(ano, mes - 1, i + 1)));
}

export function horaParaMinutos(h: Hora): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}

export function mesDe(d: DataISO): string {
  return d.slice(0, 7);
}

/** Dias desde 1970-01-01 (UTC), usado para comparar intervalos de sessões. */
export function diaAbsoluto(d: DataISO): number {
  return Math.round(emUtc(d) / DIA_MS);
}
