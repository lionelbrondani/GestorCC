import { describe, expect, it } from 'vitest';
import { alertasContrato, montarEmailFundep, OPCOES_STATUS, valorTotalContrato } from './contratos';
import type { Aditivo, Config, Contratante, Contrato } from './tipos';

function contrato(parcial: Partial<Contrato> = {}): Contrato {
  return {
    id: 'c', numero: '30/2026', eventoId: 'e', contratanteId: 'k', processoPen: '23081.000000/2026-00',
    valorBase: 500000, itemTabela: 'B.7', vencimento: '2026-10-05', areas: ['Palco'], cortesiasQtd: 20,
    ingressoSolidario: 'Não possui', statusContrato: 'Assinado', statusFatura: 'Paga', numeroFatura: '',
    statusEcad: 'Pago', statusIss: 'Pago', statusFundep: 'Ok', statusCortesias: 'Distribuídas',
    fichaTecnicaRecebida: true, canceladoMotivo: '', observacoes: '', ...parcial,
  };
}

const contratante: Contratante = {
  id: 'k', razaoSocial: 'ESCOLA DE DANÇA TESTE', documento: '11.222.333/0001-81', inscricaoMunicipal: 'Isento',
  inscricaoEstadual: 'Isento', endereco: 'Rua Exemplo 100, sala 2, Santa Maria - RS', cep: '97000-000',
  representanteNome: 'Fulano', email: 'contato@exemplo.com', contatoFaturaNome: 'Beltrana',
  contatoFaturaEmail: 'fatura@exemplo.com', contatoFaturaTelefone: '(55) 90000-0000',
};

const config: Config = {
  diariaPadrao: 8000, vagasBolsistasPadrao: 8, vagasServidoresPadrao: 1, minimoExperientesPadrao: 1,
  edital: '', iniciativa: '', projetoFundep: '30055', destinatariosFundep: ['fundep@exemplo.com'],
  assinaturaEmail: 'Centro de Convenções - UFSM', limitePerguntasDia: 30, linksFormularios: [],
};

describe('contratos', () => {
  it('opções de status do spec', () => {
    expect(OPCOES_STATUS.fundep).toEqual(['Não enviado', 'Enviado', 'Ok']);
    expect(OPCOES_STATUS.cortesias).toEqual(['Não recebidas', 'Recebidas', 'Distribuídas']);
  });

  it('valor total soma aditivos', () => {
    const ad: Aditivo = { id: 'a', contratoId: 'c', numero: 1, data: '2026-09-01', descricao: 'Sessão extra', valorDelta: 340000, novaData: null, statusFatura: 'Não enviada p/ emissão' };
    expect(valorTotalContrato(contrato({ valorBase: 680000 }), [ad, { ...ad, contratoId: 'outro' }])).toBe(1020000);
  });

  it('alerta ECAD/ISS pendente a 4 dias do evento', () => {
    expect(alertasContrato(contrato({ statusEcad: 'Não enviado' }), '2026-10-28', '2026-10-24')).toContain('ecadIssPendente');
  });
  it('isento não gera alerta', () => {
    expect(alertasContrato(contrato({ statusEcad: 'Isento', statusIss: 'Isento' }), '2026-10-28', '2026-10-24')).not.toContain('ecadIssPendente');
  });
  it('cancelado não gera alertas', () => {
    expect(alertasContrato(contrato({ statusContrato: 'Cancelado', statusEcad: 'Não enviado' }), '2026-10-25', '2026-10-24')).toEqual([]);
  });
  it('fatura vencendo, vencida, não assinado e cortesias', () => {
    expect(alertasContrato(contrato({ statusFatura: 'Não paga', vencimento: '2026-10-30' }), '2026-12-01', '2026-10-24')).toEqual(['faturaVencendo']);
    expect(alertasContrato(contrato({ statusFatura: 'Não paga', vencimento: '2026-10-20' }), '2026-12-01', '2026-10-24')).toEqual(['faturaVencida']);
    expect(alertasContrato(contrato({ statusContrato: 'Enviado' }), '2026-11-01', '2026-10-24')).toEqual(['naoAssinado']);
    expect(alertasContrato(contrato({ statusCortesias: 'Não recebidas' }), '2026-10-25', '2026-10-24')).toEqual(['cortesiasPendentes']);
  });

  it('e-mail para a FUNDEP', () => {
    const e = montarEmailFundep(
      [
        { contrato: contrato(), contratante },
        { contrato: contrato({ id: 'c2', numero: '31/2026', vencimento: '2026-10-09' }), contratante },
      ],
      config,
    );
    expect(e.assunto).toBe('[30055] Cadastramento dos contratos/clientes para emissão de fatura');
    expect(e.destinatarios).toEqual(['fundep@exemplo.com']);
    expect(e.corpoTexto).toContain('CONTRATO Nº 30/2026:');
    expect(e.corpoTexto).toContain('CNPJ: 11.222.333/0001-81 - ESCOLA DE DANÇA TESTE');
    expect(e.corpoTexto).toContain('Valor: R$ 5.000,00 com vencimento para dia 05/10/2026.');
    expect(e.corpoTexto).toContain('CONTRATO Nº 31/2026:');
    expect(e.corpoTexto).toContain('E-mail: fatura@exemplo.com, com cópia para centrodeconvencoes@ufsm.br');
    expect(e.corpoHtml).toContain('<b><u>CONTRATO Nº 30/2026:</u></b>');
  });

  it('bloco de aditivo usa o valor do aditivo', () => {
    const ad: Aditivo = { id: 'a', contratoId: 'c', numero: 1, data: '2026-09-01', descricao: '', valorDelta: 340000, novaData: '2026-11-10', statusFatura: '' };
    const e = montarEmailFundep([{ contrato: contrato({ numero: '21/2026' }), contratante, aditivo: ad }], config);
    expect(e.corpoTexto).toContain('ADITIVO Nº 1 AO CONTRATO Nº 21/2026:');
    expect(e.corpoTexto).toContain('Valor: R$ 3.400,00 com vencimento para dia 10/11/2026.');
  });
});
