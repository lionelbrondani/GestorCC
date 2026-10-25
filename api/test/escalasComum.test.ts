import { describe, expect, it } from 'vitest';
import type { LinhaEvento, LinhaSessao } from '../src/acoes/eventos';
import { exigirSemConflito, nomeSessao, type LinhaEscala } from '../src/escalas/comum';
import type { Contexto } from '../src/nucleo/roteador';
import { evento, sessao } from '../../shared/src/teste/fabricas';
import { criarAmbiente } from './apoio';

export function linhaSessao(p: Partial<LinhaSessao> & Pick<LinhaSessao, 'id' | 'eventoId' | 'data'>): LinhaSessao {
  return {
    rotulo: '', chegada: '07:30', inicio: '08:00', fim: '12:00', horarioADefinir: false, vagasBolsistas: 8, vagasServidores: 1, diaria: null,
    minimoExperientes: 1, status: 'ativa', publicadaEm: '', convocacaoAbertaAte: '', convocacaoVagas: 0, googleEventoId: '', agendaPendente: false, ...p,
  };
}
export function linhaEvento(id: string, nome = 'Formatura Teste'): LinhaEvento {
  return {
    id, nome, tipo: 'Formatura', organizador: 'Comissão', contatoOrganizador: '', servidorResponsavelId: '', publicoEstimado: null, publicoReal: null,
    pagamento: 'interno', pagadorExterno: '', instrumento: 'contrato', status: 'ativo', observacoes: '',
  };
}
export const linhaEscala = (p: Partial<LinhaEscala> & Pick<LinhaEscala, 'id' | 'sessaoId' | 'pessoaId'>): LinhaEscala => ({
  papel: 'bolsista', status: 'publicado', adicaoDireta: false, loteId: '', ...p,
});

describe('regras comuns da escala', () => {
  it('nome da sessão para avisos', () => {
    expect(nomeSessao(evento({ nome: 'Formatura Teste' }), sessao({ data: '2026-12-05' }))).toBe('Formatura Teste (05/12)');
  });

  function ambiente(status: LinhaEscala['status'] = 'publicado') {
    const amb = criarAmbiente();
    amb.repo.inserir('eventos', linhaEvento('e1'));
    amb.repo.inserir('eventos', linhaEvento('e2', 'Outro Evento'));
    amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-12-05', inicio: '10:00', fim: '14:00' }));
    amb.repo.inserir('escalas', linhaEscala({ id: 'x1', sessaoId: 's1', pessoaId: 'p02', status }));
    const ctx: Contexto = { portas: amb.portas, eu: null, idRequisicao: '' };
    return { amb, ctx };
  }

  it('conflito com sessão de outro evento bloqueia', () => {
    const { ctx } = ambiente();
    const alvo = sessao({ id: 's2', eventoId: 'e2', data: '2026-12-05', chegada: '07:30', inicio: '08:00', fim: '12:00' });
    expect(() => exigirSemConflito(ctx, 'p02', alvo)).toThrow('BOLSISTA já está escalado(a) em outra sessão no mesmo horário (05/12).');
  });

  it('escala cancelada não conta como conflito', () => {
    const { ctx } = ambiente('cancelado');
    expect(() => exigirSemConflito(ctx, 'p02', sessao({ id: 's2', eventoId: 'e2', data: '2026-12-05', chegada: '07:30', inicio: '08:00', fim: '12:00' }))).not.toThrow();
  });

  it('sessões que só encostam não conflitam', () => {
    const { ctx } = ambiente();
    expect(() => exigirSemConflito(ctx, 'p02', sessao({ id: 's2', eventoId: 'e2', data: '2026-12-05', chegada: '14:00', inicio: '14:00', fim: '16:00' }))).not.toThrow();
  });
});
