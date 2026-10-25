import type { Aditivo, Contratante, Contrato } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersContratos } from '../src/acoes/contratos';
import { ESQUEMA } from '../src/tabelas/esquema';
import { gerarRelatoriosPendentes } from '../src/relatorios/pendentes';
import { criarAmbiente } from './apoio';
import { linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };

const contratante = (p: Partial<Contratante> = {}): Contratante => ({
  id: '', razaoSocial: 'Produtora Teste Ltda', documento: '00.000.000/0001-00', inscricaoMunicipal: '', inscricaoEstadual: '', endereco: 'Rua Fictícia, 1',
  cep: '97000-000', representanteNome: 'Representante Teste', email: 'contato@exemplo.com', contatoFaturaNome: 'Financeiro', contatoFaturaEmail: 'fatura@exemplo.com',
  contatoFaturaTelefone: '(55) 90000-0000', ...p,
});
const contrato = (p: Partial<Contrato> = {}): Contrato => ({
  id: '', numero: '', eventoId: 'e1', contratanteId: '', processoPen: '23081.000000/2026-00', valorBase: 500000, itemTabela: '1.1', vencimento: '2026-11-30',
  areas: ['Plateia', 'Palco'], cortesiasQtd: 10, ingressoSolidario: 'Não possui', statusContrato: 'Não enviado', statusFatura: 'Não enviada p/ emissão',
  numeroFatura: '', statusEcad: 'Não enviado', statusIss: 'Não enviado', statusFundep: 'Não enviado', statusCortesias: 'Não recebidas',
  fichaTecnicaRecebida: false, canceladoMotivo: '', observacoes: '', ...p,
});

function ambiente() {
  const amb = criarAmbiente({ handlers: handlersContratos });
  amb.repo.inserir('eventos', linhaEvento('e1', 'Show Teste'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-12-05' }));
  const gestor = amb.token('p01');
  const k = (amb.chamar('contratantes.salvar', contratante(), { token: gestor }) as Ok<Contratante>).dados;
  const salvar = (c: Partial<Contrato> = {}) => amb.chamar('contratos.salvar', contrato({ contratanteId: k.id, ...c }), { token: gestor });
  const aditivo = (contratoId: string, p: Partial<Aditivo> = {}) =>
    amb.chamar('contratos.salvarAditivo', { id: '', contratoId, numero: 0, data: '2026-11-10', descricao: 'Mais um dia', valorDelta: 100000, novaData: null, statusFatura: 'Não enviada p/ emissão', ...p }, { token: gestor });
  return { ...amb, gestor, k, salvar, aditivo };
}

describe('contratos', () => {
  it('cria contrato com número sugerido do ano do evento', () => {
    const amb = ambiente();
    expect((amb.salvar() as Ok<Contrato>).dados.numero).toBe('1/2026');
    expect((amb.salvar() as Ok<Contrato>).dados.numero).toBe('2/2026');
    expect((amb.salvar({ numero: '7/2026' }) as Ok<Contrato>).dados.numero).toBe('7/2026');
    expect((amb.salvar() as Ok<Contrato>).dados.numero).toBe('8/2026');
  });

  it('número repetido é recusado; evento e contratante precisam existir', () => {
    const amb = ambiente();
    amb.salvar({ numero: '3/2026' });
    expect(amb.salvar({ numero: '3/2026' })).toEqual({ ok: false, erro: { codigo: 'NUMERO_REPETIDO', mensagem: 'Já existe o contrato 3/2026.' } });
    expect(amb.salvar({ eventoId: 'e-nada' })).toMatchObject({ erro: { codigo: 'NAO_ENCONTRADO' } });
    expect(amb.salvar({ contratanteId: 'k-nada' })).toMatchObject({ erro: { codigo: 'NAO_ENCONTRADO' } });
  });

  it('cancelar exige motivo; editar mantém o número', () => {
    const amb = ambiente();
    const c = (amb.salvar() as Ok<Contrato>).dados;
    expect(amb.salvar({ ...c, statusContrato: 'Cancelado' })).toMatchObject({ erro: { codigo: 'MOTIVO', mensagem: 'Informe o motivo do cancelamento.' } });
    expect((amb.salvar({ ...c, statusContrato: 'Cancelado', canceladoMotivo: 'Evento desmarcado' }) as Ok<Contrato>).dados).toMatchObject({ numero: '1/2026', statusContrato: 'Cancelado' });
  });

  it('aditivo numerado por contrato; contrato cancelado não recebe aditivo', () => {
    const amb = ambiente();
    const c = (amb.salvar() as Ok<Contrato>).dados;
    expect((amb.aditivo(c.id) as Ok<Aditivo>).dados.numero).toBe(1);
    expect((amb.aditivo(c.id) as Ok<Aditivo>).dados.numero).toBe(2);
    amb.salvar({ ...c, statusContrato: 'Cancelado', canceladoMotivo: 'x' });
    expect(amb.aditivo(c.id)).toMatchObject({ erro: { codigo: 'CONTRATO_CANCELADO' } });
  });

  it('contratante fica na planilha Sigiloso e exige razão social', () => {
    const amb = ambiente();
    expect(ESQUEMA.contratantes.planilha).toBe('sigiloso');
    expect(amb.chamar('contratantes.salvar', contratante({ razaoSocial: ' ' }), { token: amb.gestor })).toEqual({
      ok: false, erro: { codigo: 'RAZAO_SOCIAL', mensagem: 'Informe a razão social ou o nome do contratante.' },
    });
    const lista = (amb.chamar('contratos.listar', null, { token: amb.gestor }) as Ok<{ contratantes: Contratante[] }>).dados;
    expect(lista.contratantes.map((x) => x.razaoSocial)).toEqual(['Produtora Teste Ltda']);
  });

  it('bolsista não vê contratos', () => {
    const amb = ambiente();
    expect(amb.chamar('contratos.listar', null, { token: amb.token('p02') })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('aba CONTRATOS sem dados pessoais do contratante', () => {
    const amb = ambiente();
    const c = (amb.salvar() as Ok<Contrato>).dados;
    amb.aditivo(c.id);
    expect(gerarRelatoriosPendentes(amb.portas)).toEqual(['CONTRATOS']);
    const aba = amb.repo.abaLivre('relatorios', 'CONTRATOS')!;
    expect(aba[0]).toEqual(['Nº', 'EVENTO', 'DATA', 'CONTRATANTE', 'VALOR TOTAL', 'VENCIMENTO', 'CONTRATO', 'FATURA', 'Nº FATURA', 'ECAD', 'ISS', 'FUNDEP', 'CORTESIAS', 'FICHA TÉCNICA']);
    expect(aba[1]).toEqual(['1/2026', 'Show Teste', '05/12/2026', 'Produtora Teste Ltda', 'R$ 6.000,00', '30/11/2026', 'Não enviado', 'Não enviada p/ emissão', '', 'Não enviado', 'Não enviado', 'Não enviado', 'Não recebidas', 'Não recebida']);
    expect(JSON.stringify(aba)).not.toMatch(/0001-00|Rua Fictícia|fatura@/);
  });
});
