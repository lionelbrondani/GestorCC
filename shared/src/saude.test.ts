import { describe, expect, it } from 'vitest';
import { avaliarSaude, type SaudeSistema } from './saude';

const base: SaudeSistema = {
  versao: '0.15.0',
  agora: '2026-10-28T10:00',
  ultimoBackup: '2026-10-28T03:00',
  ultimaRotina: '2026-10-28T09:57',
  agendaLigada: true,
  agendaPendentes: 0,
  emailsRestantes: 98,
  erros: [],
  tabelas: [{ tabela: 'historico', linhas: 1200 }],
};
const situacao = (s: Partial<SaudeSistema>) => Object.fromEntries(avaliarSaude({ ...base, ...s }).map((i) => [i.chave, i.situacao]));

describe('saúde do sistema', () => {
  it('tudo em dia', () => {
    expect(avaliarSaude(base).every((i) => i.situacao === 'ok')).toBe(true);
    expect(avaliarSaude(base).map((i) => i.texto)).toEqual([
      'Último backup em 28/10/2026 às 03:00.',
      'Rodou em 28/10/2026 às 09:57.',
      'Tudo o que foi agendado está na agenda Google.',
      'Hoje ainda dá para mandar 98 e-mails.',
      'Nenhum erro nas últimas 24 horas.',
    ]);
  });

  it('backup com mais de 36 horas ou rotina parada há mais de 30 minutos é problema', () => {
    expect(situacao({ ultimoBackup: '2026-10-26T03:00' }).backup).toBe('problema');
    expect(situacao({ ultimaRotina: '2026-10-28T09:20' }).rotina).toBe('problema');
  });

  it('sem registro ainda (logo depois de publicar) é atenção, não problema', () => {
    expect(situacao({ ultimoBackup: null, ultimaRotina: null })).toMatchObject({ backup: 'atencao', rotina: 'atencao' });
  });

  it('agenda com pendências, poucos e-mails e erros recentes pedem atenção', () => {
    expect(situacao({ agendaPendentes: 2 }).agenda).toBe('atencao');
    expect(situacao({ agendaLigada: false }).agenda).toBe('atencao');
    expect(situacao({ emailsRestantes: 5 }).email).toBe('atencao');
    expect(situacao({ emailsRestantes: null }).email).toBe('atencao');
    expect(situacao({ erros: [{ quando: '2026-10-28T08:00', acao: 'escalas.publicar', mensagem: 'boom' }] }).erros).toBe('atencao');
    expect(situacao({ erros: [{ quando: '2026-10-25T08:00', acao: 'escalas.publicar', mensagem: 'boom' }] }).erros).toBe('ok');
  });
});
