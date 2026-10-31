import { describe, expect, it } from 'vitest';
import { agendaDoMes } from './agendaMes';
import { ehApoio, tituloComAtividade } from './atividades';
import { elegiveisParaLote } from './pagamentos/lotes';
import type { Escala, Evento, Sessao } from './tipos';

const ev = { id: 'e1', nome: 'Formatura', tipo: 'Formatura', organizador: 'Comissão', contatoOrganizador: '', pagamento: 'interno', instrumento: 'nenhum', status: 'ativo' } as Evento;
const sessao = (id: string, data: string, atividade?: Sessao['atividade']): Sessao =>
  ({ id, eventoId: 'e1', data, chegada: '18:00', inicio: '19:00', fim: '22:00', horarioADefinir: false, vagasBolsistas: 4, vagasServidores: 1, diaria: null, minimoExperientes: 0, status: 'ativa', publicadaEm: 'x', convocacao: null, atividade }) as Sessao;

describe('atividades de apoio', () => {
  it('o título leva a atividade; sessão comum fica como era', () => {
    expect(tituloComAtividade('Formatura', sessao('s1', '2026-11-10'))).toBe('Formatura');
    expect(tituloComAtividade('Formatura', { ...sessao('s2', '2026-11-10', 'montagem'), rotulo: 'Palco' })).toBe('Montagem · Formatura – Palco');
    expect(ehApoio(sessao('s3', '2026-11-10', 'passagemSom'))).toBe(true);
    expect(ehApoio(sessao('s4', '2026-11-10', 'evento'))).toBe(false);
  });

  it('apoio não entra no lote de diárias', () => {
    const sessoes = [sessao('s1', '2026-11-10'), sessao('m1', '2026-11-10', 'montagem')];
    const escalas: Escala[] = ['s1', 'm1'].map((s) => ({ id: `x-${s}`, sessaoId: s, pessoaId: 'p1', papel: 'bolsista', status: 'realizado', adicaoDireta: false, loteId: null }));
    expect(elegiveisParaLote({ eventos: [ev], sessoes, escalas, lotes: [] }).map((e) => e.id)).toEqual(['x-s1']);
  });

  it('na agenda do mês, o dia só de montagem mostra a atividade', () => {
    const linhas = agendaDoMes(2026, 11, { eventos: [ev], sessoes: [sessao('m1', '2026-11-09', 'montagem'), sessao('s1', '2026-11-10')], feriados: [], nomeServidor: () => '' });
    expect(linhas.find((l) => l.dia === '2026-11-09')!.eventos[0].nome).toBe('Montagem · Formatura');
    expect(linhas.find((l) => l.dia === '2026-11-10')!.eventos[0].nome).toBe('Formatura');
  });
});
