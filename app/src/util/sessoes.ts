import { diaDaSemana, formatarData, type Evento, type Pessoa, type Sessao } from '@shared';

export function tituloSessao(evento: Evento | undefined, sessao: Sessao): string {
  const nome = evento?.nome ?? 'Evento';
  return sessao.rotulo ? `${nome} – ${sessao.rotulo}` : nome;
}

export function dataLonga(d: string): string {
  return `${formatarData(d)} (${diaDaSemana(d)})`;
}

export function horarioTexto(s: Sessao): string {
  if (s.horarioADefinir || !s.chegada) return 'Horário a definir';
  return `Chegada ${s.chegada}${s.inicio ? ` · início ${s.inicio}` : ''}${s.fim ? ` · fim ${s.fim}` : ''}`;
}

export function chegadaTexto(s: Sessao): string {
  return s.horarioADefinir || !s.chegada ? 'a definir' : s.chegada;
}

function compacto(data: string, hora: string): string {
  return `${data.replace(/-/g, '')}T${hora.replace(':', '')}00`;
}

export function linkGoogleAgenda(evento: Evento | undefined, s: Sessao): string {
  const inicio = s.chegada ?? s.inicio ?? '08:00';
  const fim = s.fim ?? s.inicio ?? inicio;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${tituloSessao(evento, s)} (escala CC)`,
    dates: `${compacto(s.data, inicio)}/${compacto(s.data, fim)}`,
    ctz: 'America/Sao_Paulo',
    details: `Escala no Centro de Convenções da UFSM. Chegada: ${chegadaTexto(s)}.`,
    location: 'Centro de Convenções da UFSM, Santa Maria - RS',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function nomesOrdenados(pessoas: Pessoa[]): Pessoa[] {
  return [...pessoas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}
