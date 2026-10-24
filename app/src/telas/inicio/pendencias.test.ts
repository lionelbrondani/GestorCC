import { MODELOS, type Escala, type Evento, type Sessao } from '@shared';
import { calcularPendencias } from './pendencias';

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
});
