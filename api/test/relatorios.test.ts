import type { Evento, Sessao } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEscalas } from '../src/acoes/escalas';
import { handlersEventos } from '../src/acoes/eventos';
import { handlersPagamentos } from '../src/acoes/pagamentos';
import { handlersSistema } from '../src/acoes/sistema';
import { gerarRelatoriosPendentes } from '../src/relatorios/pendentes';
import { criarAmbiente } from './apoio';
import { linhaEvento, linhaSessao } from './fabricasApi';

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
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['AGENDA DEZEMBRO 2026', 'ESCALA DEZEMBRO 2026', 'CONSULTA DEZEMBRO 2026']);
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

describe('abas da escala na planilha de Relatórios (fase 3)', () => {
  function comEscala() {
    const amb = criarAmbiente({ handlers: { ...handlersEventos, ...handlersSistema, ...handlersEscalas } });
    const token = amb.token('p01');
    amb.repo.inserir('eventos', linhaEvento('e1'));
    amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-12-05' }));
    amb.repo.inserir('sessoes', linhaSessao({ id: 's3', eventoId: 'e1', data: '2026-12-06' }));
    amb.chamar('escalas.salvarRascunho', { sessaoId: 's1', itens: [{ pessoaId: 'p02', papel: 'bolsista', adicaoDireta: false }, { pessoaId: 'p01', papel: 'servidor', adicaoDireta: false }] }, { token });
    amb.chamar('escalas.salvarRascunho', { sessaoId: 's3', itens: [{ pessoaId: 'p02', papel: 'bolsista', adicaoDireta: false }] }, { token });
    amb.chamar('escalas.publicar', { sessaoIds: ['s1'] }, { token });
    return { ...amb, token };
  }

  it('publicar marca a escala do mês e o gatilho escreve ESCALA e CONSULTA', () => {
    const amb = comEscala();
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['ESCALA DEZEMBRO 2026', 'CONSULTA DEZEMBRO 2026']);
    const escala = amb.repo.abaLivre('relatorios', 'ESCALA DEZEMBRO 2026')!;
    expect(escala[0]).toEqual(['NOME', '05/12 SÁB – Formatura Teste – 08:00 - 12:00', '06/12 DOM – Formatura Teste – 08:00 - 12:00']);
    expect(escala[1]).toEqual(['ESTAR NO CC', '07:30', '07:30']);
    expect(escala[2]).toEqual(['GESTORA', 'X', '']);
    expect(escala[3]).toEqual(['1. BOLSISTA', 'X', '']);
    const consulta = amb.repo.abaLivre('relatorios', 'CONSULTA DEZEMBRO 2026')!;
    expect(consulta[0]).toEqual(['NOME', 'TIPO', 'ESCALAS NO MÊS', 'EVENTOS']);
    expect(consulta).toContainEqual(['Bolsista Teste', 'Bolsista', '1', '05/12 Formatura Teste']);
  });

  it('experiente em negrito e escalarMenos em destaque', () => {
    const amb = comEscala();
    const pessoas = amb.repo.listar<{ id: string }>('pessoas');
    amb.repo.atualizar('pessoas', { ...pessoas.find((p) => p.id === 'p02')!, experiente: true });
    amb.repo.atualizar('pessoas', { ...pessoas.find((p) => p.id === 'p01')!, escalarMenos: true });
    gerarRelatoriosPendentes(amb.portas);
    expect(amb.repo.abaFormato('relatorios', 'ESCALA DEZEMBRO 2026')).toEqual({ negrito: [3], destaque: [2] });
  });

  it('troca entra no HISTÓRICO DE TROCAS com a justificativa', () => {
    const amb = comEscala();
    gerarRelatoriosPendentes(amb.portas);
    amb.chamar('escalas.trocar', { sessaoId: 's1', sai: 'p02', entra: null, justificativa: 'Prova na faculdade' }, { token: amb.token });
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['ESCALA DEZEMBRO 2026', 'CONSULTA DEZEMBRO 2026', 'HISTÓRICO DE TROCAS']);
    expect(amb.repo.abaLivre('relatorios', 'HISTÓRICO DE TROCAS')).toEqual([
      ['DATA/HORA', 'EVENTO/DATA', 'SAIU', 'ENTROU', 'JUSTIFICATIVA'],
      ['24/10/2026 10:00', 'Formatura Teste (05/12)', 'BOLSISTA', '—', 'Prova na faculdade'],
    ]);
  });

  it('marca antiga da fase 2 ainda gera a AGENDA', () => {
    const amb = comEscala();
    gerarRelatoriosPendentes(amb.portas);
    amb.portas.props.definir('RELATORIOS_PENDENTES', '["2026-12"]');
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['AGENDA DEZEMBRO 2026']);
  });
});

describe('aba de pagamentos (fase 4)', () => {
  it('criar lote marca a aba e o gatilho escreve totais sem CPF', () => {
    const amb = criarAmbiente({ handlers: handlersPagamentos });
    amb.repo.inserir('eventos', linhaEvento('e1'));
    amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-10-05' }));
    amb.repo.inserir('sessoes', linhaSessao({ id: 's2', eventoId: 'e1', data: '2026-10-06', diaria: 12000 }));
    amb.repo.inserir('escalas', { id: 'x1', sessaoId: 's1', pessoaId: 'p02', papel: 'bolsista', status: 'realizado', adicaoDireta: false, loteId: '' });
    amb.repo.inserir('escalas', { id: 'x2', sessaoId: 's2', pessoaId: 'p02', papel: 'bolsista', status: 'realizado', adicaoDireta: false, loteId: '' });
    amb.chamar('lotes.criar', { escalaIds: ['x1', 'x2'], titulo: 'Outubro/2026', periodoReferencia: 'OUTUBRO/2026', edital: '', iniciativa: '', incluirZerados: true }, { token: amb.token('p01') });
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['PAGAMENTOS – Outubro-2026']);
    const aba = amb.repo.abaLivre('relatorios', 'PAGAMENTOS – Outubro-2026')!;
    expect(aba).toEqual([
      ['BOLSISTA', 'QUANTIDADE', 'VALOR UNITÁRIO', 'TOTAL'],
      ['Bolsista Teste', '2', 'variado', 'R$ 200,00'],
      ['TOTAL DO LOTE', '2', '', 'R$ 200,00'],
      ['SITUAÇÃO: Enviado', '', '', ''],
    ]);
    expect(JSON.stringify(aba)).not.toMatch(/\d{3}\.\d{3}/);
  });
});
