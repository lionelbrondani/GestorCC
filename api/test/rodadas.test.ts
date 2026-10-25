import type { Disponibilidade, Rodada } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEventos } from '../src/acoes/eventos';
import { handlersRodadas } from '../src/acoes/rodadas';
import { criarAmbiente } from './apoio';
import { linhaEscala, linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };

function ambiente() {
  const amb = criarAmbiente({ handlers: { ...handlersEventos, ...handlersRodadas } });
  amb.repo.inserir('eventos', linhaEvento('e1'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-12-05' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's2', eventoId: 'e1', data: '2026-12-06' }));
  const gestor = amb.token('p01');
  const bolsista = amb.token('p02');
  const rodada = (p: Partial<Rodada> = {}): Rodada => ({ id: '', nome: 'Dezembro/2026', prazo: '2026-10-30T18:00', status: 'aberta', sessaoIds: ['s1', 's2'], ...p });
  const abrir = (p: Partial<Rodada> = {}) => amb.chamar('rodadas.salvar', rodada(p), { token: gestor });
  const marcar = (dados: { sessaoId: string; disponivel: boolean; pessoaId?: string }, token = bolsista) =>
    amb.chamar('disponibilidades.marcar', dados, { token });
  const disponibilidades = (token = gestor) => (amb.chamar('disponibilidades.listar', { sessaoIds: ['s1', 's2'] }, { token }) as Ok<Disponibilidade[]>).dados;
  return { ...amb, gestor, bolsista, rodada, abrir, marcar, disponibilidades };
}

describe('rodadas', () => {
  it('gestor abre rodada; todos são avisados no app; bolsista lista', () => {
    const amb = ambiente();
    const r = amb.abrir() as Ok<Rodada>;
    expect(r.ok).toBe(true);
    expect(r.dados.id).toBeTruthy();
    const avisos = amb.repo.listar<{ id: string; pessoaId: string; texto: string; link: string }>('notificacoes');
    expect(avisos.map((n) => n.pessoaId).sort()).toEqual(['p01', 'p02']);
    expect(avisos[0]).toMatchObject({ texto: 'Rodada de disponibilidade aberta: Dezembro/2026. Responda até 30/10 às 18:00.', link: '/disponibilidade' });
    const lista = (amb.chamar('rodadas.listar', null, { token: amb.bolsista }) as Ok<Rodada[]>).dados;
    expect(lista).toHaveLength(1);
    expect(lista[0].sessaoIds.sort()).toEqual(['s1', 's2']);
    expect(lista[0].sessoesNovas).toEqual([]);
  });

  it('validações da rodada', () => {
    const amb = ambiente();
    const erro = (mensagem: string) => ({ ok: false, erro: { codigo: 'VALIDACAO', mensagem } });
    expect(amb.abrir({ nome: ' ' })).toEqual(erro('Informe o nome da rodada.'));
    expect(amb.abrir({ prazo: '30/10' })).toEqual(erro('Informe o prazo da rodada.'));
    expect(amb.abrir({ sessaoIds: [] })).toEqual(erro('Escolha ao menos uma sessão.'));
    expect(amb.abrir({ sessaoIds: ['s-nada'] })).toEqual(erro('Sessão não encontrada ou cancelada.'));
    expect(amb.chamar('rodadas.salvar', amb.rodada(), { token: amb.bolsista })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('sessão nova do mesmo mês entra na rodada aberta com selo nova', () => {
    const amb = ambiente();
    amb.abrir();
    amb.chamar('eventos.salvar', {
      evento: { id: '', nome: 'Show Teste', tipo: 'Show/Concerto', organizador: 'X', contatoOrganizador: '', pagamento: 'interno', instrumento: 'nenhum', status: 'ativo' },
      sessoes: [{ id: '', eventoId: '', data: '2026-12-20', chegada: '18:30', inicio: '20:00', fim: '22:00', horarioADefinir: false, vagasBolsistas: 8, vagasServidores: 1, diaria: null, minimoExperientes: 1, status: 'ativa', publicadaEm: null, convocacao: null }],
    }, { token: amb.gestor });
    const nova = amb.repo.listar<{ id: string; data: string }>('sessoes').find((s) => s.data === '2026-12-20')!;
    const r = (amb.chamar('rodadas.listar', null, { token: amb.bolsista }) as Ok<Rodada[]>).dados[0];
    expect(r.sessaoIds).toContain(nova.id);
    expect(r.sessoesNovas).toEqual([nova.id]);
  });
});

describe('disponibilidade', () => {
  it('bolsista marca Sim e depois Não; fica uma linha só', () => {
    const amb = ambiente();
    amb.abrir();
    expect(amb.marcar({ sessaoId: 's1', disponivel: true })).toMatchObject({ ok: true, dados: { pessoaId: 'p02', sessaoId: 's1', disponivel: true, origem: 'proprio' } });
    amb.marcar({ sessaoId: 's1', disponivel: false });
    expect(amb.disponibilidades()).toEqual([{ pessoaId: 'p02', sessaoId: 's1', disponivel: false, origem: 'proprio' }]);
  });

  it('prazo: no minuto exato vale, depois não', () => {
    const amb = ambiente();
    amb.abrir({ prazo: '2026-10-24T10:00' });
    expect(amb.marcar({ sessaoId: 's1', disponivel: true }).ok).toBe(true);
    amb.relogio.avancarMinutos(1);
    expect(amb.marcar({ sessaoId: 's1', disponivel: true })).toEqual({
      ok: false, erro: { codigo: 'PRAZO', mensagem: 'O prazo para marcar disponibilidade nesta sessão terminou.' },
    });
  });

  it('gestor marca por outra pessoa, com histórico, mesmo sem rodada aberta', () => {
    const amb = ambiente();
    expect(amb.marcar({ sessaoId: 's1', disponivel: true, pessoaId: 'p02' }, amb.gestor)).toMatchObject({ ok: true, dados: { origem: 'gestor' } });
    const h = amb.repo.listar<{ id: string; acao: string }>('historico').map((x) => x.acao);
    expect(h).toContain('marcou disponibilidade por outra pessoa (Sim)');
    expect(amb.marcar({ sessaoId: 's1', disponivel: true, pessoaId: 'p01' })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('bolsista não vê a disponibilidade dos outros', () => {
    const amb = ambiente();
    amb.abrir();
    amb.marcar({ sessaoId: 's1', disponivel: true, pessoaId: 'p01' }, amb.gestor);
    amb.marcar({ sessaoId: 's1', disponivel: true });
    expect(amb.disponibilidades(amb.bolsista).map((d) => d.pessoaId)).toEqual(['p02']);
    expect(amb.disponibilidades().map((d) => d.pessoaId).sort()).toEqual(['p01', 'p02']);
  });

  it('convocação aberta aceita só quem não está escalado', () => {
    const amb = ambiente();
    const s1 = amb.repo.listar<{ id: string }>('sessoes').find((s) => s.id === 's1')!;
    amb.repo.atualizar('sessoes', { ...s1, publicadaEm: '2026-10-20T09:00', convocacaoAbertaAte: '2026-10-25T18:00', convocacaoVagas: 2 });
    expect(amb.marcar({ sessaoId: 's1', disponivel: true })).toMatchObject({ ok: true, dados: { origem: 'convocacao' } });
    amb.repo.inserir('escalas', linhaEscala({ id: 'x1', sessaoId: 's1', pessoaId: 'p02' }));
    expect(amb.marcar({ sessaoId: 's1', disponivel: true })).toEqual({
      ok: false, erro: { codigo: 'JA_ESCALADO', mensagem: 'Você já está escalado(a) nesta sessão.' },
    });
  });
});
