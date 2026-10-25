import { diaDaSemanaCurto, somarDias, type Consulta, type DataISO } from '@shared';
import { semAcento } from './buscaComum';

export type { Consulta };

const DIAS: Record<string, string> = { domingo: 'DOM', segunda: 'SEG', terca: 'TER', quarta: 'QUA', quinta: 'QUI', sexta: 'SEX', sabado: 'SÁB' };

function dataMencionada(t: string, hoje: DataISO): DataISO | null {
  if (/\bhoje\b/.test(t)) return hoje;
  if (/\bamanha\b/.test(t)) return somarDias(hoje, 1);
  const dm = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (dm) return `${hoje.slice(0, 4)}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
  for (const [palavra, curto] of Object.entries(DIAS)) {
    if (new RegExp(`\\b${palavra}\\b`).test(t)) {
      for (let i = 0; i < 7; i++) if (diaDaSemanaCurto(somarDias(hoje, i)) === curto) return somarDias(hoje, i);
    }
  }
  return null;
}

/**
 * Substitui o Gemini nesta fase: transforma a pergunta numa consulta por palavras-chave.
 * Na fase 7 o Gemini recebe só a pergunta e devolve a mesma estrutura (chamada de função).
 */
export function interpretarSimulado(pergunta: string, hoje: DataISO): Consulta | null {
  const t = semAcento(pergunta).replace(/[?!.]+/g, ' ').replace(/\s+/g, ' ').trim();

  const saldo = t.match(/^(?:quanto|quantos|quantas|qual o saldo|saldo)\b.*?\b(?:de|do|da|dos|das)\s+(.+)$/);
  if (saldo) return { nome: 'saldoItem', termo: saldo[1].trim() };
  const TERMOS_INFRA: [RegExp, string][] = [
    [/vazament/, 'vazamento'], [/lampada|lampadas/, 'lampada'], [/torneira/, 'torneira'], [/infiltra/, 'infiltracao'],
    [/ar.condicionado/, 'ar-condicionado'], [/poltrona/, 'poltrona'],
  ];
  if (/infraestrutura|ocorrencia|manutencao|chamados? (da|na) ufsm|chamados?.*(abert|atrasad)/.test(t) || TERMOS_INFRA.some(([r]) => r.test(t))) {
    const achado = TERMOS_INFRA.find(([r]) => r.test(t));
    return { nome: 'ocorrenciasAbertas', termo: achado ? achado[1] : '' };
  }
  if (/estoque (critico|minimo|baixo)|precisa comprar|falta comprar|lista de compras/.test(t)) return { nome: 'estoqueCritico' };
  if (/contrato/.test(t) && /(pendent|atras|ecad|iss|fatura|vencid)/.test(t)) return { nome: 'contratosPendentes' };
  if (/\blotes?\b|pagamentos? (em aberto|pendentes?)/.test(t)) return { nome: 'lotesEmAberto' };
  if (/(nao|ainda nao) respond|falta(m)? responder/.test(t)) return { nome: 'naoResponderam' };
  if (/\bvagas?\b|falta(m)? (gente|bolsista)/.test(t)) return { nome: 'vagasFaltando' };
  if (/proximos? eventos?|o que (tem|temos) (na agenda|essa semana|esta semana)|agenda da semana/.test(t)) return { nome: 'proximosEventos' };

  const data = dataMencionada(t, hoje);
  if (/\b(quem|escalad[oa]s?|trabalha|equipe|escala)\b/.test(t) && data) return { nome: 'escalaDoDia', data };
  const pessoa = t.match(/\bescalas? (?:do|da|de) ([a-z ]+)$/) ?? t.match(/^quando (?:o |a )?([a-z]+) trabalha/);
  if (pessoa) return { nome: 'escalasDaPessoa', termo: pessoa[1].trim() };
  if (/\b(quem|escalad)/.test(t)) return { nome: 'escalaDoDia', data: hoje };
  return null;
}
