/// <reference types="google-apps-script" />
import { somarDias } from '@shared';
import type { EventoAgenda } from '../nucleo/portas';

const FUSO = 'America/Sao_Paulo';

/**
 * Evento no formato da API do Google Agenda. `status: 'confirmed'` traz de volta um evento que alguém
 * apagou à mão no Google (lá ele só fica oculto como "cancelado").
 */
export function recursoDoEvento(e: EventoAgenda): GoogleAppsScript.Calendar.Schema.Event {
  const q = e.quando;
  return {
    summary: e.titulo,
    description: e.descricao,
    start: q.diaInteiro ? { date: q.dia } : { dateTime: `${q.inicio}:00`, timeZone: FUSO },
    end: q.diaInteiro ? { date: somarDias(q.dia, 1) } : { dateTime: `${q.fim}:00`, timeZone: FUSO },
    attendees: e.convidados.map((email) => ({ email })),
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
    status: 'confirmed',
  };
}

/** Só recria o evento quando o Google diz que ele não existe mais; falha passageira vira pendência, não duplicata. */
export function eventoSumiuNoGoogle(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return /not found|has been deleted|\b404\b|\b410\b/i.test(msg);
}
