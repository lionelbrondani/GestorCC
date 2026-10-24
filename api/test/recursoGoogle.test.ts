import { describe, expect, it } from 'vitest';
import { eventoSumiuNoGoogle, recursoDoEvento } from '../src/agenda/recursoGoogle';

describe('evento enviado ao Google Agenda', () => {
  it('com horário: fuso de Brasília, convidados sem ver uns aos outros e sempre confirmado', () => {
    const r = recursoDoEvento({
      titulo: 'Formatura', descricao: 'Organizador: X', convidados: ['a@exemplo.com'],
      quando: { diaInteiro: false, inicio: '2026-12-05T22:00', fim: '2026-12-06T01:00' },
    });
    expect(r).toEqual({
      summary: 'Formatura',
      description: 'Organizador: X',
      start: { dateTime: '2026-12-05T22:00:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-12-06T01:00:00', timeZone: 'America/Sao_Paulo' },
      attendees: [{ email: 'a@exemplo.com' }],
      guestsCanSeeOtherGuests: false,
      guestsCanInviteOthers: false,
      status: 'confirmed',
    });
  });

  it('dia inteiro termina no dia seguinte (o Google conta o fim como exclusivo)', () => {
    const r = recursoDoEvento({ titulo: 'T', descricao: '', convidados: [], quando: { diaInteiro: true, dia: '2026-12-31' } });
    expect(r.start).toEqual({ date: '2026-12-31' });
    expect(r.end).toEqual({ date: '2027-01-01' });
  });
});

describe('quando recriar o evento', () => {
  it.each([
    'API call to calendar.events.patch failed with error: Not Found',
    'API call to calendar.events.patch failed with error: Resource has been deleted',
    'Request failed with status 410',
  ])('evento sumido (%s) → recriar', (msg) => expect(eventoSumiuNoGoogle(new Error(msg))).toBe(true));

  it.each(['API call to calendar.events.patch failed with error: Backend Error', 'Rate Limit Exceeded', 'Service unavailable'])(
    'falha passageira (%s) → não recriar, para não duplicar',
    (msg) => expect(eventoSumiuNoGoogle(new Error(msg))).toBe(false),
  );
});
