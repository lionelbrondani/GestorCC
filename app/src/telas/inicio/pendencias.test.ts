import { MODELOS, type Escala, type Evento, type FichaResumo, type Rodada, type Sessao } from '@shared';
import { calcularPendencias, prazoRelativo } from './pendencias';

const evento: Evento = {
  id: 'e', nome: 'Concerto', tipo: 'Show/Concerto', organizador: '', contatoOrganizador: '',
  pagamento: 'interno', instrumento: 'nenhum', status: 'ativo',
};
const ontem: Sessao = {
  id: 's', eventoId: 'e', data: '2026-10-23', chegada: '18:30', inicio: '20:00', fim: '22:00', horarioADefinir: false,
  vagasBolsistas: 1, vagasServidores: 1, diaria: null, minimoExperientes: 0, status: 'ativa', publicadaEm: '2026-10-01T10:00', convocacao: null,
};
const escala: Escala = { id: 'x', sessaoId: 's', pessoaId: 'p', papel: 'bolsista', status: 'publicado', adicaoDireta: false, loteId: null };

const base = {
  sessoes: [ontem], escalas: [escala], eventos: [evento], rodadas: [], disponibilidades: [], pessoas: [],
  itens: [], contratos: [], hoje: '2026-10-24',
};

describe('calcularPendencias', () => {
  it('sessão de ontem ainda publicada pede confirmação de presença', () => {
    const p = calcularPendencias({ ...base, permissoes: MODELOS.gestor });
    expect(p).toContainEqual(expect.objectContaining({ tipo: 'presenca' }));
  });

  it('quem não gerencia não tem pendências', () => {
    expect(calcularPendencias({ ...base, permissoes: MODELOS.eventual })).toEqual([]);
  });

  it('ficha técnica ainda não enviada, com o evento nos próximos 14 dias', () => {
    const ficha = { eventoId: 'e', evento: 'Concerto', eventoCancelado: false, datas: ['2026-10-30'], status: 'rascunho', prazo: '2026-10-28' } as FichaResumo;
    const p = calcularPendencias({ ...base, fichas: [ficha, { ...ficha, eventoId: 'f', status: 'enviada' }, { ...ficha, eventoId: 'g', datas: ['2026-11-20'] }], permissoes: MODELOS.gestor });
    expect(p.filter((x) => x.tipo === 'ficha')).toEqual([{ tipo: 'ficha', texto: 'Ficha técnica de Concerto ainda não enviada pelo produtor', link: '/agenda/e', quando: '2026-10-28' }]);
  });

  it('escala ainda não publicada e apoio sem equipe nos próximos 14 dias', () => {
    const amanha: Sessao = { ...ontem, id: 'n', data: '2026-10-25', publicadaEm: null };
    const montagem: Sessao = { ...amanha, id: 'm', atividade: 'montagem' };
    const longe: Sessao = { ...amanha, id: 'l', data: '2026-11-20' };
    const p = calcularPendencias({ ...base, sessoes: [amanha, montagem, longe], escalas: [], permissoes: MODELOS.gestor });
    expect(p.filter((x) => x.tipo === 'publicar')).toEqual([{ tipo: 'publicar', texto: 'Publicar a escala: Concerto (25/10)', link: '/escalas?aba=montar&mes=2026-10', quando: '2026-10-25' }]);
    expect(p.filter((x) => x.tipo === 'apoio')).toEqual([{ tipo: 'apoio', texto: 'Escalar o apoio: Montagem · Concerto (25/10)', link: '/escalas?aba=apoio&mes=2026-10', quando: '2026-10-25' }]);
  });

  it('sessões realizadas fora de lote pedem um lote de pagamento', () => {
    const p = calcularPendencias({ ...base, escalas: [{ ...escala, status: 'realizado' }], lotes: [], permissoes: MODELOS.gestor });
    expect(p).toContainEqual({ tipo: 'pagamento', texto: '1 sessão realizada aguardando lote de pagamento', link: '/pagamentos/novo' });
  });

  it('vem primeiro o que venceu ou vence antes', () => {
    const rodada = { id: 'r', nome: 'Novembro', status: 'aberta', prazo: '2026-10-26T23:59', sessaoIds: [] } as unknown as Rodada;
    const p = calcularPendencias({ ...base, rodadas: [rodada], permissoes: MODELOS.gestor });
    expect(p.map((x) => x.quando)).toEqual(['2026-10-23', '2026-10-26']);
  });
});

describe('prazoRelativo', () => {
  it.each([
    ['2026-10-21', { texto: 'há 3 dias', tom: 'erro' }],
    ['2026-10-23', { texto: 'há 1 dia', tom: 'erro' }],
    ['2026-10-24', { texto: 'hoje', tom: 'erro' }],
    ['2026-10-25', { texto: 'amanhã', tom: 'aviso' }],
    ['2026-10-29', { texto: 'em 5 dias', tom: 'aviso' }],
    ['2026-11-10', { texto: 'em 17 dias', tom: undefined }],
  ])('%s', (quando, esperado) => expect(prazoRelativo(quando, '2026-10-24')).toEqual(esperado));
});
