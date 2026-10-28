import { validarAnalise, type ConsultaAnalise } from '@shared';
import { describe, expect, it } from 'vitest';
import type { ApiCliente } from '../api/cliente';
import { executarAnalise } from './analise';
import { executarConsulta } from './executar';

const HOJE = '2026-10-28';

const EVENTOS = [
  { id: 'e1', nome: 'Concerto de Natal', tipo: 'Show/Concerto', publicoEstimado: 800, status: 'ativo' },
  { id: 'e2', nome: 'Formatura Exemplo', tipo: 'Formatura', publicoEstimado: 1000, status: 'ativo' },
];
const sessao = (id: string, eventoId: string, data: string, extra: object = {}) => ({ id, eventoId, data, status: 'ativa', ...extra });
const SESSOES = [
  sessao('s1', 'e1', '2026-11-10'),
  sessao('s2', 'e1', '2026-11-11'),
  sessao('s3', 'e2', '2026-12-05'),
  sessao('s4', 'e2', '2026-12-04', { atividade: 'montagem' }),
  sessao('s5', 'e2', '2026-12-06', { status: 'cancelada' }),
];
const PESSOAS = [
  { id: 'p1', nome: 'Camila Freitas', nomeCurto: 'Camila' },
  { id: 'p2', nome: 'Diego Souza', nomeCurto: 'Diego' },
  { id: 'p3', nome: 'Bruno Lemos', nomeCurto: 'Bruno' },
];
const escala = (sessaoId: string, pessoaId: string, status: string) => ({ id: `${sessaoId}-${pessoaId}`, sessaoId, pessoaId, status, papel: 'bolsista' });
const DADOS: Record<string, unknown> = {
  'eventos.listar': { eventos: EVENTOS, sessoes: SESSOES },
  'pessoas.listar': PESSOAS,
  'escalas.listar': [
    escala('s1', 'p1', 'publicado'),
    escala('s2', 'p1', 'realizado'),
    escala('s3', 'p2', 'publicado'),
    escala('s3', 'p1', 'rascunho'),
    escala('s2', 'p3', 'faltou'),
    escala('s1', 'p3', 'cancelado'),
  ],
  'lotes.listar': {
    lotes: [
      { id: 'L1', status: 'pago', pagoEm: '2026-10-10', criadoEm: '2026-10-01T10:00' },
      { id: 'L2', status: 'enviado', pagoEm: null, criadoEm: '2026-10-20T09:00' },
      { id: 'L3', status: 'cancelado', pagoEm: null, criadoEm: '2026-10-05T10:00' },
      { id: 'L4', status: 'pago', pagoEm: '2025-01-10', criadoEm: '2025-01-02T10:00' },
    ],
    itens: [
      { loteId: 'L1', pessoaId: 'p1', valor: 10000 },
      { loteId: 'L1', pessoaId: 'p2', valor: 10000 },
      { loteId: 'L2', pessoaId: 'p1', valor: 5000 },
      { loteId: 'L3', pessoaId: 'p1', valor: 99900 },
      { loteId: 'L4', pessoaId: 'p2', valor: 7000 },
    ],
  },
  'contratos.listar': {
    contratos: [
      { id: 'c1', numero: '001/2026', eventoId: 'e1', contratanteId: 'k1', statusContrato: 'Assinado', valorBase: 100000, vencimento: '2026-11-15' },
      { id: 'c2', numero: '002/2026', eventoId: 'e2', contratanteId: 'k1', statusContrato: 'Enviado', valorBase: 50000, vencimento: '2026-11-20' },
      { id: 'c3', numero: '003/2026', eventoId: 'e2', contratanteId: 'k1', statusContrato: 'Cancelado', valorBase: 70000, vencimento: '2026-11-25' },
      { id: 'c4', numero: '004/2026', eventoId: 'e2', contratanteId: 'k1', statusContrato: 'Assinado', valorBase: 20000, vencimento: '2027-08-01' },
    ],
    aditivos: [{ id: 'a1', contratoId: 'c1', valorDelta: 25000 }],
    contratantes: [{ id: 'k1', razaoSocial: 'Produtora Exemplo Ltda' }],
  },
  'cortesias.resumo': [
    { eventoId: 'e1', destinos: [{ nome: 'Reitoria', quantidade: 10, lancados: 2 }, { nome: 'Imprensa', quantidade: 4, lancados: 0 }] },
    { eventoId: 'e2', destinos: [{ nome: 'Reitoria', quantidade: 6, lancados: 0 }] },
  ],
  'infra.listar': [
    { id: 'o1', status: 'nova', categoria: 'Hidráulica', titulo: 'Vazamento', descricao: '', local: 'Banheiros', criadaEm: '2026-10-02T16:10' },
    { id: 'o2', status: 'resolvida', categoria: 'Iluminação', titulo: 'Lâmpada', descricao: '', local: 'Palco', criadaEm: '2026-10-07T09:30' },
    { id: 'o3', status: 'nova', categoria: 'Hidráulica', titulo: 'Torneira', descricao: '', local: 'Camarins', criadaEm: '2026-10-12T19:40' },
    { id: 'o4', status: 'resolvida', categoria: 'Elétrica', titulo: 'Tomada', descricao: '', local: 'Palco', criadaEm: '2025-01-01T10:00' },
  ],
  'pedidos.listar': [
    { id: 'd1', evento: 'Show A', categoria: 'Show musical', categoriaOutra: '', status: 'novo', recebidoEm: '2026-10-03T10:00' },
    { id: 'd2', evento: 'Feira B', categoria: 'Outro', categoriaOutra: 'Feira de livros', status: 'aprovado', recebidoEm: '2026-10-04T10:00' },
    { id: 'd3', evento: 'Show C', categoria: 'Show musical', categoriaOutra: '', status: 'recusado', recebidoEm: '2026-10-05T10:00' },
  ],
};

function apiFalsa() {
  const chamadas: [string, unknown][] = [];
  const api = {
    chamar: async (acao: string, dados: unknown) => {
      chamadas.push([acao, dados]);
      return DADOS[acao];
    },
    definirToken: () => {},
  } as unknown as ApiCliente;
  return { api, chamadas };
}

const analise = (args: Record<string, unknown>) => validarAnalise(args) as ConsultaAnalise;

describe('perguntas complexas: a análise roda aqui, com as permissões de quem perguntou', () => {
  it('sessões por mês: sem as canceladas e sem montagem/ensaio, na ordem do tempo, no período padrão', async () => {
    const { api, chamadas } = apiFalsa();
    const r = await executarAnalise(analise({ assunto: 'sessoes', agrupar: 'mes' }), api, HOJE);
    expect(r.titulo).toBe('Sessões por mês · 28/10/2025 a 26/04/2027');
    expect(r.tabela).toEqual({ colunas: ['Mês', 'Quantidade'], linhas: [['nov/2026', '2'], ['dez/2026', '1']], total: '3' });
    expect(chamadas).toContainEqual(['eventos.listar', { de: '2025-10-28', ate: '2027-04-26' }]);
  });

  it('público estimado por evento conta cada evento uma vez; sem agrupar, só o total', async () => {
    const { api } = apiFalsa();
    expect((await executarAnalise(analise({ assunto: 'sessoes', agrupar: 'evento', medida: 'publico' }), api, HOJE)).tabela).toEqual({
      colunas: ['Evento', 'Público estimado'],
      linhas: [['Formatura Exemplo', '1.000'], ['Concerto de Natal', '800']],
      total: '1.800',
    });
    expect((await executarAnalise(analise({ assunto: 'sessoes', agrupar: 'nenhum' }), api, HOJE)).tabela).toEqual({ colunas: ['', 'Quantidade'], linhas: [], total: '3' });
  });

  it('escalas por pessoa: só publicadas e realizadas; filtro pelo nome; o padrão termina hoje; o limite avisa quantos ficaram de fora', async () => {
    const { api, chamadas } = apiFalsa();
    const periodo = { de: '2026-11-01', ate: '2026-12-31' };
    expect((await executarAnalise(analise({ assunto: 'escalas', agrupar: 'pessoa', ...periodo }), api, HOJE)).tabela).toEqual({
      colunas: ['Pessoa', 'Quantidade'],
      linhas: [['Camila Freitas', '2'], ['Diego Souza', '1']],
      total: '3',
    });
    const filtrado = await executarAnalise(analise({ assunto: 'escalas', agrupar: 'mes', filtro: 'Camila Freitas', ...periodo }), api, HOJE);
    expect(filtrado.titulo).toBe('Escalas por mês · 01/11/2026 a 31/12/2026 · Camila Freitas');
    expect(filtrado.tabela?.linhas).toEqual([['nov/2026', '2']]);
    const cortado = await executarAnalise(analise({ assunto: 'escalas', agrupar: 'pessoa', limite: 1, ...periodo }), api, HOJE);
    expect(cortado.tabela).toMatchObject({ linhas: [['Camila Freitas', '2']], total: '3', observacao: '1 outro fora da lista; o total conta todos.' });
    await executarAnalise(analise({ assunto: 'escalas' }), api, HOJE);
    expect(chamadas).toContainEqual(['escalas.listar', { de: '2025-10-28', ate: HOJE }]);
  });

  it('pagamentos em reais: sem lotes cancelados, pela data do pagamento ou do envio', async () => {
    const { api } = apiFalsa();
    const outubro = { de: '2026-10-01', ate: '2026-10-31' };
    expect((await executarAnalise(analise({ assunto: 'pagamentos', agrupar: 'pessoa', ...outubro }), api, HOJE)).tabela).toEqual({
      colunas: ['Pessoa', 'Valor'],
      linhas: [['Camila Freitas', 'R$ 150,00'], ['Diego Souza', 'R$ 100,00']],
      total: 'R$ 250,00',
    });
    expect((await executarAnalise(analise({ assunto: 'pagamentos', agrupar: 'status', medida: 'contar', ...outubro }), api, HOJE)).tabela?.linhas).toEqual([
      ['Pago', '2'],
      ['Aguardando pagamento', '1'],
    ]);
  });

  it('contratos: valor com aditivos; os cancelados só aparecem na divisão por situação', async () => {
    const { api } = apiFalsa();
    expect((await executarAnalise(analise({ assunto: 'contratos', agrupar: 'status', medida: 'valor' }), api, HOJE)).tabela).toEqual({
      colunas: ['Situação', 'Valor'],
      linhas: [['Assinado', 'R$ 1.250,00'], ['Cancelado', 'R$ 700,00'], ['Enviado', 'R$ 500,00']],
      total: 'R$ 2.450,00',
    });
    expect((await executarAnalise(analise({ assunto: 'contratos', agrupar: 'mes' }), api, HOJE)).tabela).toEqual({
      colunas: ['Mês', 'Quantidade'],
      linhas: [['nov/2026', '2']],
      total: '2',
      observacao: 'Contratos cancelados ficam de fora.',
    });
  });

  it('cortesias por destino e por evento', async () => {
    const { api, chamadas } = apiFalsa();
    expect((await executarAnalise(analise({ assunto: 'cortesias', agrupar: 'destino' }), api, HOJE)).tabela?.linhas).toEqual([
      ['Reitoria', '16'],
      ['Imprensa', '4'],
    ]);
    expect(chamadas).toContainEqual(['cortesias.resumo', { eventoIds: ['e1', 'e2'] }]);
    expect((await executarAnalise(analise({ assunto: 'cortesias', agrupar: 'evento' }), api, HOJE)).tabela?.linhas).toEqual([
      ['Concerto de Natal', '14'],
      ['Formatura Exemplo', '6'],
    ]);
  });

  it('ocorrências por situação e pedidos por categoria, pela data em que chegaram', async () => {
    const { api } = apiFalsa();
    const outubro = { de: '2026-10-01', ate: '2026-10-31' };
    expect((await executarAnalise(analise({ assunto: 'ocorrencias', agrupar: 'status', ...outubro }), api, HOJE)).tabela?.linhas).toEqual([
      ['Nova', '2'],
      ['Resolvida', '1'],
    ]);
    expect((await executarAnalise(analise({ assunto: 'pedidos', agrupar: 'categoria', ...outubro }), api, HOJE)).tabela?.linhas).toEqual([
      ['Show musical', '2'],
      ['Feira de livros', '1'],
    ]);
  });

  it('sem nada no período, avisa; sem permissão, a busca responde sem acesso', async () => {
    const { api } = apiFalsa();
    const vazio = await executarAnalise(analise({ assunto: 'ocorrencias', de: '2024-01-01', ate: '2024-01-31' }), api, HOJE);
    expect(vazio).toMatchObject({ itens: [], vazio: 'Nada encontrado nesse período.' });
    expect(vazio.tabela).toBeUndefined();
    const negada = { chamar: async () => Promise.reject(new Error('SEM_PERMISSAO')), definirToken: () => {} } as unknown as ApiCliente;
    expect(await executarConsulta(analise({ assunto: 'pagamentos' }), negada, HOJE)).toMatchObject({ titulo: 'Sem acesso' });
  });
});
