import type { CortesiasPublica, DestinoCortesias } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersCortesias } from '../src/acoes/cortesias';
import { criarAmbiente } from './apoio';
import { linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };

function ambiente() {
  const amb = criarAmbiente({ handlers: handlersCortesias });
  amb.relogio.definir('2026-12-01T10:00');
  amb.repo.inserir('eventos', linhaEvento('e1', 'Show Teste'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-12-12' }));
  const gestor = amb.token('p01');
  const destino = (p: Partial<{ id: string; nome: string; quantidade: number; pedirMatricula: boolean }> = {}) =>
    amb.chamar('cortesias.salvarDestino', { id: '', eventoId: 'e1', nome: 'Casa do Estudante', quantidade: 3, pedirMatricula: true, ...p }, { token: gestor });
  const listar = () => (amb.chamar('cortesias.listar', { eventoId: 'e1' }, { token: gestor }) as Ok<{ destinos: DestinoCortesias[]; totalContrato: number | null }>).dados;
  return { ...amb, gestor, destino, listar };
}

const ana = { nome: 'Ana Souza', matricula: '202600001' };
const bia = { nome: 'Bia Lima', matricula: '202600002' };

describe('cortesias: destinos', () => {
  it('cria o destino com link próprio e prazo no dia anterior ao evento', () => {
    const amb = ambiente();
    const d = (amb.destino() as Ok<DestinoCortesias>).dados;
    expect(d).toMatchObject({ eventoId: 'e1', nome: 'Casa do Estudante', quantidade: 3, pedirMatricula: true, prazo: '2026-12-11', travada: false, pessoas: [] });
    expect(d.token).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(amb.listar()).toEqual({ destinos: [d], totalContrato: null });
  });

  it('traz o total de cortesias do contrato do evento', () => {
    const amb = ambiente();
    amb.repo.inserir('contratos', { id: 'c1', eventoId: 'e1', cortesiasQtd: 50, statusContrato: 'Assinado' } as never);
    amb.repo.inserir('contratos', { id: 'c2', eventoId: 'e1', cortesiasQtd: 99, statusContrato: 'Cancelado' } as never);
    expect(amb.listar().totalContrato).toBe(50);
  });

  it('nome e quantidade são obrigatórios', () => {
    const amb = ambiente();
    expect(amb.destino({ nome: ' ' })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Informe o nome do destino.' } });
    expect(amb.destino({ quantidade: 0 })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'A quantidade deve ser de 1 a 2000.' } });
  });

  it('novo link invalida o antigo; remover apaga o destino e a lista', () => {
    const amb = ambiente();
    const d = (amb.destino() as Ok<DestinoCortesias>).dados;
    const novo = (amb.chamar('cortesias.novoLink', { id: d.id }, { token: amb.gestor }) as Ok<DestinoCortesias>).dados;
    expect(novo.token).not.toBe(d.token);
    expect(amb.chamar('cortesia.abrir', { token: d.token })).toMatchObject({ ok: false, erro: { codigo: 'LINK' } });
    amb.chamar('cortesias.removerDestino', { id: d.id }, { token: amb.gestor });
    expect(amb.listar().destinos).toEqual([]);
    expect(amb.repo.listar('cortesiasSigilo')).toEqual([]);
    expect(amb.chamar('cortesia.abrir', { token: novo.token })).toMatchObject({ ok: false, erro: { codigo: 'LINK' } });
  });
});

describe('cortesias: lista pelo link do destino', () => {
  it('abre sem login e mostra a quantidade e o evento', () => {
    const amb = ambiente();
    const d = (amb.destino() as Ok<DestinoCortesias>).dados;
    const r = amb.chamar('cortesia.abrir', { token: d.token }) as Ok<CortesiasPublica>;
    expect(r.dados).toEqual({
      evento: { nome: 'Show Teste', datas: ['2026-12-12'] },
      destino: { nome: 'Casa do Estudante', quantidade: 3, pedirMatricula: true },
      travada: false, prazo: '2026-12-11', pessoas: [],
    });
  });

  it('salva a lista na planilha Sigiloso e o gestor vê quantos foram lançados', () => {
    const amb = ambiente();
    const d = (amb.destino() as Ok<DestinoCortesias>).dados;
    const r = amb.chamar('cortesia.salvar', { token: d.token, pessoas: [ana, bia] }) as Ok<CortesiasPublica>;
    expect(r.dados.pessoas).toEqual([ana, bia]);
    expect(JSON.stringify(amb.repo.listar('cortesiasDestinos'))).not.toContain('Ana Souza');
    expect(amb.listar().destinos[0]).toMatchObject({ pessoas: [ana, bia], atualizadoPeloDestinoEm: '2026-12-01T10:00' });
  });

  it('recusa lista com erro e não passa da quantidade', () => {
    const amb = ambiente();
    const d = (amb.destino({ quantidade: 1 }) as Ok<DestinoCortesias>).dados;
    expect(amb.chamar('cortesia.salvar', { token: d.token, pessoas: [{ nome: 'Ana', matricula: '' }] })).toMatchObject({
      ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Linha 1: Informe a matrícula.' },
    });
    const r = amb.chamar('cortesia.salvar', { token: d.token, pessoas: [ana, bia] }) as Ok<CortesiasPublica>;
    expect(r.dados.pessoas).toEqual([ana]);
  });

  it('não deixa baixar a quantidade abaixo dos nomes lançados', () => {
    const amb = ambiente();
    const d = (amb.destino() as Ok<DestinoCortesias>).dados;
    amb.chamar('cortesia.salvar', { token: d.token, pessoas: [ana, bia] });
    expect(amb.destino({ id: d.id, quantidade: 1 })).toMatchObject({ ok: false, erro: { mensagem: 'Já há 2 nomes lançados. Peça para tirar nomes antes de baixar a quantidade.' } });
    expect((amb.destino({ id: d.id, quantidade: 5, nome: 'CEU' }) as Ok<DestinoCortesias>).dados).toMatchObject({ quantidade: 5, nome: 'CEU', pessoas: [ana, bia], token: d.token });
  });

  it('trava depois do prazo; o gestor destrava ou corrige a lista', () => {
    const amb = ambiente();
    const d = (amb.destino() as Ok<DestinoCortesias>).dados;
    amb.relogio.definir('2026-12-12T08:00');
    const gestor = amb.token('p01');
    expect((amb.chamar('cortesia.abrir', { token: d.token }) as Ok<CortesiasPublica>).dados.travada).toBe(true);
    expect(amb.chamar('cortesia.salvar', { token: d.token, pessoas: [ana] })).toMatchObject({
      ok: false, erro: { codigo: 'TRAVADA', mensagem: 'O prazo para lançar os nomes terminou (11/12/2026). Fale com o Centro de Convenções.' },
    });
    expect((amb.chamar('cortesias.salvarPessoas', { id: d.id, pessoas: [bia] }, { token: gestor }) as Ok<DestinoCortesias>).dados.pessoas).toEqual([bia]);
    amb.chamar('cortesias.travar', { id: d.id, trava: 'destravada' }, { token: gestor });
    expect(amb.chamar('cortesia.salvar', { token: d.token, pessoas: [ana] }).ok).toBe(true);
  });

  it('evento cancelado fecha o link; bolsista não vê os destinos', () => {
    const amb = ambiente();
    const d = (amb.destino() as Ok<DestinoCortesias>).dados;
    expect(amb.chamar('cortesias.listar', { eventoId: 'e1' }, { token: amb.token('p02') })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
    const [e] = amb.repo.listar<{ id: string; status: string }>('eventos');
    amb.repo.atualizar('eventos', { ...e, status: 'cancelado' });
    expect(amb.chamar('cortesia.abrir', { token: d.token })).toMatchObject({ ok: false, erro: { codigo: 'LINK', mensagem: 'Este evento foi cancelado.' } });
  });
});
