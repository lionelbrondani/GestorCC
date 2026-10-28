import { ehApoio, NOMES_ATIVIDADE } from './atividades';
import { diaDaSemana, diasDoMes } from './datas';
import type { DataISO, Evento, Feriado, Sessao } from './tipos';

/** Um dia da agenda do mês (spec 7.8): a mesma regra vale para a impressão e para a aba da planilha. */
export interface LinhaAgendaMes {
  dia: DataISO;
  feriado: string | null;
  eventos: { nome: string; responsavel: string; respNugac: string }[];
  horarios: string[];
}

/** 'Manhã: 08:00 - 12:00', '20:00' ou 'a definir'. */
export function horarioSessao(s: Sessao): string {
  const h = s.horarioADefinir || !s.inicio ? 'a definir' : s.fim ? `${s.inicio} - ${s.fim}` : s.inicio;
  return s.rotulo ? `${s.rotulo}: ${h}` : h;
}

/** 'Sábado, 05'. */
export function rotuloDiaAgenda(d: DataISO): string {
  const dia = diaDaSemana(d);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${d.slice(8, 10)}`;
}

/** No dia só de apoio, o nome leva as atividades (ex.: 'Montagem · Formatura'). */
function nomeNoDia(e: Evento, sessoes: Sessao[]): string {
  if (sessoes.some((s) => !ehApoio(s))) return e.nome;
  return `${[...new Set(sessoes.map((s) => NOMES_ATIVIDADE[s.atividade!]))].join(' e ')} · ${e.nome}`;
}

/** Todos os dias do mês, só com sessões ativas de eventos ativos. Resp. NUGAC é o primeiro nome do servidor. */
export function agendaDoMes(
  ano: number,
  mes: number,
  d: { eventos: Evento[]; sessoes: Sessao[]; feriados: Feriado[]; nomeServidor: (id: string) => string },
): LinhaAgendaMes[] {
  const evento = new Map(d.eventos.map((e) => [e.id, e]));
  const feriado = new Map(d.feriados.map((f) => [f.data, f.nome]));
  return diasDoMes(ano, mes).map((dia) => {
    const sessoes = d.sessoes.filter((s) => s.data === dia && s.status === 'ativa' && evento.get(s.eventoId)?.status === 'ativo');
    const eventos = [...new Set(sessoes.map((s) => s.eventoId))].map((id) => evento.get(id)!);
    return {
      dia,
      feriado: feriado.get(dia) ?? null,
      eventos: eventos.map((e) => ({
        nome: nomeNoDia(e, sessoes.filter((s) => s.eventoId === e.id)),
        responsavel: `${e.organizador}${e.contatoOrganizador ? ` / ${e.contatoOrganizador}` : ''}`,
        respNugac: (e.servidorResponsavelId && d.nomeServidor(e.servidorResponsavelId).split(' ')[0]) || '',
      })),
      horarios: sessoes.map(horarioSessao),
    };
  });
}
