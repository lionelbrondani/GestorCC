import { describe, expect, it } from 'vitest';
import { validarEvento } from './eventos';
import { evento, sessao } from './teste/fabricas';
import type { Evento, Sessao } from './tipos';

const ev = (p: Partial<Evento> = {}) => evento({ nome: 'Formatura', tipo: 'Formatura', pagamento: 'interno', ...p });
const ses = (p: Partial<Sessao> = {}) => sessao({ data: '2026-12-05', chegada: '07:30', inicio: '08:00', fim: '12:00', ...p });

describe('validarEvento', () => {
  it('aceita evento completo', () => expect(validarEvento(ev(), [ses()])).toBeNull());

  it('as mensagens, na ordem das regras', () => {
    expect(validarEvento(ev({ nome: '  ' }), [ses()])).toBe('Informe o nome do evento.');
    expect(validarEvento(ev({ tipo: 'Festa' as never }), [ses()])).toBe('Escolha o tipo do evento.');
    expect(validarEvento(ev(), [])).toBe('O evento precisa de ao menos uma sessão.');
    expect(validarEvento(ev(), [ses({ data: '' })])).toBe('Todas as sessões precisam de data.');
    expect(validarEvento(ev({ pagamento: 'externo', pagadorExterno: ' ' }), [ses()])).toBe('Informe quem paga os bolsistas neste evento externo.');
  });

  it.each(['8:00', '25:00', '12h', '12:60'])('horário %s é recusado com a data da sessão', (h) => {
    expect(validarEvento(ev(), [ses({ data: '2026-12-05', inicio: h })])).toBe('Horário inválido na sessão de 05/12. Use HH:MM.');
  });

  it('horário vazio (null) é aceito; vagas negativas ou quebradas não', () => {
    expect(validarEvento(ev(), [ses({ chegada: null, inicio: null, fim: null, horarioADefinir: true })])).toBeNull();
    expect(validarEvento(ev(), [ses({ data: '2026-12-05', vagasBolsistas: -1 })])).toBe('Número de vagas inválido na sessão de 05/12.');
    expect(validarEvento(ev(), [ses({ data: '2026-12-05', minimoExperientes: 1.5 })])).toBe('Número de vagas inválido na sessão de 05/12.');
  });
});
