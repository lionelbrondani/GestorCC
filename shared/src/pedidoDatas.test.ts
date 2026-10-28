import { describe, expect, it } from 'vitest';
import { conflitosDoPedido, errosDoPedido, eventoDoPedido, limparPedido, type PedidoDatas, type PedidoDatasDados } from './pedidoDatas';
import type { Evento, Sessao } from './tipos';
import { cnpjValido } from './validacoes';

const dados: PedidoDatasDados = {
  evento: 'Festival de Dança Exemplo',
  categoria: 'Show musical',
  categoriaOutra: '',
  dias: [
    { data: '2026-12-04', atividade: 'montagem', inicio: '08:00', fim: '18:00' },
    { data: '2026-12-05', atividade: 'evento', inicio: '20:00', fim: '22:30' },
  ],
  observacoesHorarios: '',
  programacao: 'Abertura, apresentações das escolas e encerramento.',
  indicacao: 'Livre',
  pessoasEnvolvidas: 40,
  espacos: ['Palco', 'Plateia'],
  espacoOutro: '',
  publico: 800,
  informacoes: '',
  solicitante: { razaoSocial: 'Produtora Exemplo Ltda', documento: '11.222.333/0001-81', endereco: 'Rua do Teste, 10', cep: '97010-000', inscricaoEstadual: 'Isento', inscricaoMunicipal: '123' },
  responsavel: { nome: 'Pessoa Responsável', cpf: '529.982.247-25', email: 'responsavel@exemplo.com', telefone: '(55) 99999-0000' },
};

describe('CNPJ', () => {
  it('confere os dígitos, inclusive no CNPJ alfanumérico (a partir de 2026)', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('95.591.764/0001-05')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('11.111.111/1111-11')).toBe(false);
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(cnpjValido('12.ABC.345/01DE-36')).toBe(false);
  });
});

describe('pedido de datas', () => {
  it('pedido completo não tem erros', () => {
    expect(errosDoPedido(dados, '2026-10-28')).toEqual([]);
  });

  it('aponta o que falta ou está errado, campo a campo', () => {
    const erros = errosDoPedido(
      {
        ...dados,
        evento: ' ',
        categoria: 'Outro',
        dias: [{ data: '2026-10-01', atividade: 'montagem', inicio: '18:00', fim: '08:00' }],
        espacos: [],
        solicitante: { ...dados.solicitante, documento: '123' },
        responsavel: { ...dados.responsavel, cpf: '111.111.111-11', email: 'sem-arroba' },
      },
      '2026-10-28',
    ).map((e) => e.campo);
    expect(erros).toEqual(['evento', 'categoriaOutra', 'dias.0.data', 'dias.0.fim', 'dias', 'espacos', 'solicitante.documento', 'responsavel.cpf', 'responsavel.email']);
  });

  it('limpa o que vem da página pública: corta textos longos, descarta opções que não existem', () => {
    const limpo = limparPedido({ ...dados, evento: 'x'.repeat(500), categoria: 'Rave', espacos: ['Palco', 'Cozinha'], indicacao: '99 anos', dias: 'nada' });
    expect(limpo.evento).toHaveLength(150);
    expect(limpo.categoria).toBe('');
    expect(limpo.espacos).toEqual(['Palco']);
    expect(limpo.indicacao).toBe('');
    expect(limpo.dias).toEqual([]);
  });

  it('aprovado, vira evento com uma sessão por dia (o apoio sem diária) e o tipo pela categoria', () => {
    const pedido = { ...dados, id: 'p1', protocolo: 'PD-2026-0001' } as PedidoDatas;
    const { evento, sessoes } = eventoDoPedido(pedido, { vagasBolsistas: 8, vagasServidores: 1, minimoExperientes: 1 });
    expect(evento).toMatchObject({ nome: 'Festival de Dança Exemplo', tipo: 'Show/Concerto', organizador: 'Produtora Exemplo Ltda', contatoOrganizador: 'Pessoa Responsável', publicoEstimado: 800, instrumento: 'contrato', status: 'ativo' });
    expect(evento.observacoes).toContain('PD-2026-0001');
    expect(sessoes).toEqual([
      expect.objectContaining({ data: '2026-12-04', atividade: 'montagem', chegada: '08:00', inicio: '08:00', fim: '18:00', vagasBolsistas: 1, vagasServidores: 0 }),
      expect.objectContaining({ data: '2026-12-05', atividade: 'evento', chegada: '18:30', inicio: '20:00', fim: '22:30', vagasBolsistas: 8, vagasServidores: 1 }),
    ]);
  });

  it('conflitos: sessão no mesmo horário, sessão no mesmo dia e outro pedido em análise', () => {
    const show: Evento = { id: 'e1', nome: 'Concerto de Natal', tipo: 'Show/Concerto', organizador: '', contatoOrganizador: '', pagamento: 'interno', instrumento: 'nenhum', status: 'ativo' };
    const sessao = (p: Partial<Sessao>): Sessao => ({
      id: 's', eventoId: 'e1', data: '2026-12-05', chegada: '18:00', inicio: '19:00', fim: '21:00', horarioADefinir: false, vagasBolsistas: 8, vagasServidores: 1,
      diaria: null, minimoExperientes: 1, status: 'ativa', publicadaEm: null, convocacao: null, ...p,
    });
    const pedido = { ...dados, id: 'p1', status: 'novo' } as PedidoDatas;
    const outro = { ...dados, id: 'p2', evento: 'Outro Pedido', status: 'novo', dias: [{ data: '2026-12-04', atividade: 'evento', inicio: '10:00', fim: '12:00' }] } as PedidoDatas;
    const c = conflitosDoPedido(pedido, [sessao({ id: 's1' }), sessao({ id: 's2', inicio: '09:00', fim: '11:00', chegada: '08:30' }), sessao({ id: 's3', status: 'cancelada' })], [show], [pedido, outro]);
    expect(c).toEqual([
      { data: '2026-12-04', grave: true, texto: 'Outro pedido em análise: Outro Pedido, das 10:00 às 12:00' },
      { data: '2026-12-05', grave: true, texto: 'Concerto de Natal, das 18:00 às 21:00' },
      { data: '2026-12-05', grave: false, texto: 'Mesmo dia: Concerto de Natal, das 08:30 às 11:00' },
    ]);
  });
});
