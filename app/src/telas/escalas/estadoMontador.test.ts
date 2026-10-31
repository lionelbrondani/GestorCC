import { MODELOS, type ContextoEscala, type Escala, type Pessoa, type Sessao } from '@shared';
import { bloqueioInclusao, reduzirMontador, type EstadoMontador } from './estadoMontador';

const sessao = (id: string, parcial: Partial<Sessao> = {}): Sessao => ({
  id, eventoId: 'e', data: '2026-12-05', chegada: '13:00', inicio: '15:00', fim: '17:30', horarioADefinir: false,
  vagasBolsistas: 8, vagasServidores: 1, diaria: null, minimoExperientes: 0, status: 'ativa', publicadaEm: null, convocacao: null, ...parcial,
});
const pessoa = (id: string, tipo: Pessoa['tipo'] = 'bolsista'): Pessoa => ({
  id, nome: id, nomeCurto: id, emailAcademico: '', matricula: '', tipo, vinculo: 'eventual', experiente: false,
  escalarMenos: false, ativo: true, permissoes: MODELOS.eventual,
});

describe('reduzirMontador', () => {
  it('incluir e depois remover volta às escalas originais e marca alterado', () => {
    const original: Escala[] = [{ id: 'x1', sessaoId: 's1', pessoaId: 'a', papel: 'bolsista', status: 'rascunho', adicaoDireta: false, loteId: null }];
    const inicial: EstadoMontador = { escalas: original, alterado: false, alteradas: [] };
    const depois = reduzirMontador(
      reduzirMontador(inicial, { tipo: 'incluir', sessaoId: 's1', pessoaId: 'b', papel: 'bolsista', adicaoDireta: false }),
      { tipo: 'remover', sessaoId: 's1', pessoaId: 'b' },
    );
    expect(depois.escalas).toEqual(original);
    expect(depois.alterado).toBe(true);
    expect(depois.alteradas).toEqual(['s1']);
  });

  it('não remove escala já publicada', () => {
    const pub: Escala = { id: 'x', sessaoId: 's1', pessoaId: 'a', papel: 'bolsista', status: 'publicado', adicaoDireta: false, loteId: null };
    const r = reduzirMontador({ escalas: [pub], alterado: false, alteradas: [] }, { tipo: 'remover', sessaoId: 's1', pessoaId: 'a' });
    expect(r.escalas).toEqual([pub]);
  });
});

describe('bloqueioInclusao', () => {
  const s1 = sessao('s1');
  const s2 = sessao('s2', { chegada: '17:00', inicio: '19:00', fim: '21:30' });
  const ctx = (escalas: Escala[]): ContextoEscala => ({ pessoas: [pessoa('a'), pessoa('srv', 'servidor')], sessoes: [s1, s2], escalas, disponibilidades: [] });

  it('servidor em vaga de bolsista é bloqueado por papel', () => {
    expect(bloqueioInclusao(s1, pessoa('srv', 'servidor'), 'bolsista', ctx([]))).toBe('papel');
  });

  it('sessão sobreposta é conflito', () => {
    const ja: Escala = { id: 'x', sessaoId: 's2', pessoaId: 'a', papel: 'bolsista', status: 'rascunho', adicaoDireta: false, loteId: null };
    expect(bloqueioInclusao(s1, pessoa('a'), 'bolsista', ctx([ja]))).toBe('conflito');
  });

  it('sem impedimento', () => {
    expect(bloqueioInclusao(s1, pessoa('a'), 'bolsista', ctx([]))).toBeNull();
  });
});
