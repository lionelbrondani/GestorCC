import type { Portas, Propriedades } from '../nucleo/portas';
import { escreverAgenda } from './agenda';
import { escreverContratos } from './contratos';
import { escreverConsulta, escreverEscala, escreverTrocas } from './escala';
import { escreverEstoque, escreverInfra } from './estoque';
import { escreverLote } from './pagamentos';

/**
 * Abas da planilha de Relatórios a refazer pelo gatilho de 5 minutos (spec 11):
 * 'agenda:AAAA-MM', 'escala:AAAA-MM' (ESCALA e CONSULTA do mês), 'trocas', 'lote:<id>', 'estoque', 'infra' e 'contratos'.
 */
const CHAVE = 'RELATORIOS_PENDENTES';
const VALIDA = /^(agenda|escala):\d{4}-\d{2}$|^(trocas|estoque|infra|contratos)$|^lote:[\w-]+$/;

function pendentes(props: Propriedades): string[] {
  try {
    const v = JSON.parse(props.obter(CHAVE) ?? '[]');
    if (!Array.isArray(v)) return [];
    // marca da fase 2 era só 'AAAA-MM' e queria dizer a agenda do mês
    return v.map((m) => (/^\d{4}-\d{2}$/.test(m) ? `agenda:${m}` : m)).filter((m) => VALIDA.test(m));
  } catch {
    return [];
  }
}

export function marcarRelatorios(props: Propriedades, chaves: string[]): void {
  const atuais = pendentes(props);
  const todas = [...new Set([...atuais, ...chaves.filter((c) => VALIDA.test(c))])];
  if (todas.length !== atuais.length || props.obter(CHAVE) !== JSON.stringify(todas)) props.definir(CHAVE, JSON.stringify(todas));
}

export const marcarAgendaPendente = (props: Propriedades, meses: string[]) => marcarRelatorios(props, meses.map((m) => `agenda:${m}`));
export const marcarEscalaPendente = (props: Propriedades, meses: string[]) => marcarRelatorios(props, meses.map((m) => `escala:${m}`));
/** Mudança de sessão mexe na agenda e na grade da escala do mês. */
export const marcarMesesPendentes = (props: Propriedades, meses: string[]) =>
  marcarRelatorios(props, meses.flatMap((m) => [`agenda:${m}`, `escala:${m}`]));

/** Escreve as abas marcadas, em ordem (agenda, escala, trocas), e limpa a marca; devolve os nomes das abas escritas. */
export function gerarRelatoriosPendentes(portas: Portas): string[] {
  const chaves = pendentes(portas.props);
  if (!chaves.length) return [];
  const ordem = (c: string) => (c.startsWith('agenda:') ? 0 : c.startsWith('escala:') ? 1 : c === 'trocas' ? 2 : 3);
  const escritas: string[] = [];
  for (const c of [...chaves].sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b))) {
    const [tipo, mesAno] = c.split(':');
    const [ano, mes] = (mesAno ?? '').split('-').map(Number);
    if (tipo === 'agenda') escritas.push(escreverAgenda(portas, ano, mes));
    else if (tipo === 'escala') escritas.push(escreverEscala(portas, ano, mes), escreverConsulta(portas, ano, mes));
    else if (tipo === 'trocas') escritas.push(escreverTrocas(portas));
    else if (tipo === 'estoque') escritas.push(escreverEstoque(portas));
    else if (tipo === 'infra') escritas.push(escreverInfra(portas));
    else if (tipo === 'contratos') escritas.push(escreverContratos(portas));
    else if (tipo === 'lote') {
      const aba = escreverLote(portas, mesAno);
      if (aba) escritas.push(aba);
    }
  }
  portas.props.definir(CHAVE, '[]');
  return escritas;
}
