import type { Evento, Sessao } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEventos } from '../src/acoes/eventos';
import { handlersSistema } from '../src/acoes/sistema';
import { gerarRelatoriosPendentes } from '../src/relatorios/agenda';
import { criarAmbiente } from './apoio';

const evNovo = (): Evento => ({
  id: '', nome: 'Formatura Teste', tipo: 'Formatura', organizador: 'Comissão Teste', contatoOrganizador: '',
  pagamento: 'interno', instrumento: 'contrato', status: 'ativo',
});
const sesNova = (data: string): Sessao => ({
  id: '', eventoId: '', data, rotulo: 'Manhã', chegada: '07:30', inicio: '08:00', fim: '12:00', horarioADefinir: false,
  vagasBolsistas: 8, vagasServidores: 1, diaria: null, minimoExperientes: 1, status: 'ativa', publicadaEm: null, convocacao: null,
});

function ambiente() {
  const amb = criarAmbiente({ handlers: { ...handlersEventos, ...handlersSistema } });
  return { ...amb, token: amb.token('p01') };
}

describe('aba AGENDA na planilha de Relatórios', () => {
  it('salvar evento marca o mês e o gatilho escreve a aba', () => {
    const amb = ambiente();
    amb.chamar('eventos.salvar', { evento: evNovo(), sessoes: [sesNova('2026-12-05')] }, { token: amb.token });
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['AGENDA DEZEMBRO 2026']);
    const aba = amb.repo.abaLivre('relatorios', 'AGENDA DEZEMBRO 2026')!;
    expect(aba).toHaveLength(32);
    expect(aba[0]).toEqual(['DIA', 'EVENTO', 'RESPONSÁVEL', 'RESP NUGAC', 'HORÁRIO']);
    expect(aba[5]).toEqual(['Sábado, 05', 'Formatura Teste', 'Comissão Teste', '', 'Manhã: 08:00 - 12:00']);
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual([]);
  });

  it('mudar feriado marca o mês do feriado', () => {
    const amb = ambiente();
    amb.chamar('feriados.salvar', { ano: 2026, feriados: [{ data: '2026-11-02', nome: 'Finados' }] }, { token: amb.token });
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['AGENDA NOVEMBRO 2026']);
    expect(amb.repo.abaLivre('relatorios', 'AGENDA NOVEMBRO 2026')![2]).toEqual(['Segunda-feira, 02', 'FERIADO – Finados', '', '', '']);
  });

  it('sem pendências não escreve nada', () => {
    const amb = ambiente();
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual([]);
  });
});
