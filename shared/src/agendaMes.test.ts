import { describe, expect, it } from 'vitest';
import { agendaDoMes, horarioSessao, rotuloDiaAgenda } from './agendaMes';
import { evento, sessao } from './teste/fabricas';

const nomes: Record<string, string> = { p9: 'Servidora Teste da Silva' };
const dados = () => ({
  eventos: [
    evento({ id: 'e1', nome: 'Formatura Teste', organizador: 'Comissão', contatoOrganizador: '(55) 90000-0001', servidorResponsavelId: 'p9' }),
    evento({ id: 'e2', nome: 'Show Teste', organizador: 'Produtora', contatoOrganizador: '' }),
    evento({ id: 'e3', nome: 'Evento Cancelado', status: 'cancelado' }),
  ],
  sessoes: [
    sessao({ id: 's1', eventoId: 'e1', data: '2026-12-05', rotulo: 'Manhã', inicio: '08:00', fim: '12:00' }),
    sessao({ id: 's2', eventoId: 'e2', data: '2026-12-05', rotulo: '', inicio: '20:00', fim: null }),
    sessao({ id: 's3', eventoId: 'e1', data: '2026-12-06', status: 'cancelada' }),
    sessao({ id: 's4', eventoId: 'e3', data: '2026-12-07' }),
  ],
  feriados: [{ data: '2026-12-25', nome: 'Natal' }],
  nomeServidor: (id: string) => nomes[id] ?? '',
});

describe('agendaDoMes', () => {
  it('uma linha por dia do mês, com feriado e vários eventos no mesmo dia', () => {
    const linhas = agendaDoMes(2026, 12, dados());
    expect(linhas).toHaveLength(31);
    expect(linhas[4]).toEqual({
      dia: '2026-12-05',
      feriado: null,
      eventos: [
        { nome: 'Formatura Teste', responsavel: 'Comissão / (55) 90000-0001', respNugac: 'Servidora' },
        { nome: 'Show Teste', responsavel: 'Produtora', respNugac: '' },
      ],
      horarios: ['Manhã: 08:00 - 12:00', '20:00'],
    });
    expect(linhas[24]).toMatchObject({ dia: '2026-12-25', feriado: 'Natal', eventos: [] });
  });

  it('sessão cancelada e evento cancelado ficam de fora', () => {
    const linhas = agendaDoMes(2026, 12, dados());
    expect(linhas[5]).toMatchObject({ eventos: [], horarios: [] });
    expect(linhas[6]).toMatchObject({ eventos: [], horarios: [] });
  });

  it('horário e rótulo do dia', () => {
    expect(horarioSessao(sessao({ rotulo: 'Noite', horarioADefinir: true, inicio: null }))).toBe('Noite: a definir');
    expect(horarioSessao(sessao({ rotulo: '', inicio: '19:00', fim: '21:00' }))).toBe('19:00 - 21:00');
    expect(rotuloDiaAgenda('2026-12-05')).toBe('Sábado, 05');
  });
});
