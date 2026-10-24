import type { Aviso, Notificacao } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersAvisos } from '../src/acoes/avisos';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
const aviso = (p: Partial<Aviso> = {}): Aviso => ({
  id: '', titulo: 'Reunião', texto: 'Sala 308', publico: 'todos', pessoasIds: [], fixado: false, validoAte: null,
  pedeConfirmacao: false, autorId: '', criadoEm: '', leituras: [], ...p,
});

describe('mural', () => {
  it('envio repetido (mesmo idRequisicao) cria um único aviso', () => {
    const amb = criarAmbiente({ handlers: handlersAvisos });
    const t = amb.token('p01');
    amb.chamar('avisos.salvar', aviso(), { token: t, idRequisicao: 'rede-caiu' });
    amb.chamar('avisos.salvar', aviso(), { token: t, idRequisicao: 'rede-caiu' });
    expect(amb.repo.listar('avisos')).toHaveLength(1);
  });

  it('título é obrigatório', () => {
    const amb = criarAmbiente({ handlers: handlersAvisos });
    expect(amb.chamar('avisos.salvar', aviso({ titulo: '  ' }), { token: amb.token('p01') })).toMatchObject({ erro: { codigo: 'TITULO' } });
  });

  it('bolsista não vê aviso só para gestores nem aviso vencido; o editor vê todos', () => {
    const amb = criarAmbiente({ handlers: handlersAvisos });
    const g = amb.token('p01');
    amb.chamar('avisos.salvar', aviso({ titulo: 'Para todos' }), { token: g });
    amb.chamar('avisos.salvar', aviso({ titulo: 'Só gestores', publico: 'gestores' }), { token: g });
    amb.chamar('avisos.salvar', aviso({ titulo: 'Vencido', validoAte: '2026-10-01' }), { token: g });
    amb.chamar('avisos.salvar', aviso({ titulo: 'Fixado', fixado: true }), { token: g });
    const doBolsista = (amb.chamar('avisos.listar', null, { token: amb.token('p02') }) as Ok<Aviso[]>).dados.map((a) => a.titulo);
    expect(doBolsista).toEqual(['Fixado', 'Para todos']);
    expect((amb.chamar('avisos.listar', null, { token: g }) as Ok<Aviso[]>).dados).toHaveLength(4);
  });

  it('confirmar leitura duas vezes conta uma vez', () => {
    const amb = criarAmbiente({ handlers: handlersAvisos });
    const a = (amb.chamar('avisos.salvar', aviso({ pedeConfirmacao: true }), { token: amb.token('p01') }) as Ok<Aviso>).dados;
    const t = amb.token('p02');
    amb.chamar('avisos.confirmarLeitura', { avisoId: a.id }, { token: t });
    amb.chamar('avisos.confirmarLeitura', { avisoId: a.id }, { token: t });
    expect(amb.repo.listar('avisosLeituras')).toHaveLength(1);
    expect((amb.chamar('avisos.listar', null, { token: t }) as Ok<Aviso[]>).dados[0].leituras).toEqual(['p02']);
  });
});

describe('notificações', () => {
  it('cada pessoa vê só as suas e pode marcar como lidas', () => {
    const amb = criarAmbiente({ handlers: handlersAvisos });
    amb.repo.inserir('notificacoes', { id: 'n1', pessoaId: 'p02', texto: 'Para a bolsista', link: '/', lida: false });
    amb.repo.inserir('notificacoes', { id: 'n2', pessoaId: 'p01', texto: 'Para a gestora', link: '/', lida: false });
    const t = amb.token('p02');
    const lista = (amb.chamar('notificacoes.listar', null, { token: t }) as Ok<Notificacao[]>).dados;
    expect(lista.map((n) => n.texto)).toEqual(['Para a bolsista']);
    expect(lista[0].criadaEm).toBe('2026-10-24T10:00');
    amb.chamar('notificacoes.marcarLidas', null, { token: t });
    expect((amb.chamar('notificacoes.listar', null, { token: t }) as Ok<Notificacao[]>).dados[0].lida).toBe(true);
    expect(amb.repo.listar<{ id: string; lida: boolean }>('notificacoes').find((n) => n.id === 'n2')!.lida).toBe(false);
  });
});
