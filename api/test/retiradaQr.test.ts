import type { Notificacao } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersAlmox } from '../src/acoes/almox';
import { handlersAvisos } from '../src/acoes/avisos';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
type Linha = { id: string; [k: string]: unknown };

function ambiente() {
  const amb = criarAmbiente({ handlers: { ...handlersAlmox, ...handlersAvisos } });
  const item = (cod: string, nomeComum: string, saldo: number, status = 'Ativo') =>
    amb.repo.inserir('almoxItens', { id: cod, cod, nomeAlmox: nomeComum.toUpperCase(), nomeComum, unidade: 'UN', valor: 500, categoria: 'Geral', qtdMinima: 1, sala: 'A', status, saldo } as never);
  item('0012', 'Fita crepe', 7);
  item('0020', 'Pilha AA', 10);
  item('0030', 'Lâmpada antiga', 3, 'Inativo');
  const gestor = amb.token('p01');
  const chave = (amb.chamar('almox.qr', {}, { token: gestor }) as Ok<{ chave: string }>).dados.chave;
  return { ...amb, gestor, chave };
}

describe('retirada pelo QR code da porta do almoxarifado', () => {
  it('a página do QR abre sem login, só com a chave do código, e lista os itens ativos', () => {
    const amb = ambiente();
    expect(amb.chave.length).toBeGreaterThanOrEqual(16);
    expect((amb.chamar('retirada.abrir', { chave: amb.chave }) as Ok<{ itens: unknown[] }>).dados.itens).toEqual([
      { cod: '0012', nome: 'Fita crepe', unidade: 'UN' },
      { cod: '0020', nome: 'Pilha AA', unidade: 'UN' },
    ]);
    expect(amb.chamar('retirada.abrir', { chave: 'outra-chave-qualquer' })).toMatchObject({ ok: false, erro: { codigo: 'CHAVE' } });
  });

  it('registra a retirada no nome de quem digitou, baixa o estoque e avisa quem cuida do almoxarifado', () => {
    const amb = ambiente();
    const pedir = (dados: object) => amb.chamar('retirada.registrar', { chave: amb.chave, ...dados } as never);
    expect(pedir({ nome: ' ', itens: [{ cod: '0012', qtd: 1 }], finalidade: 'Ensaio' })).toMatchObject({ ok: false, erro: { mensagem: 'Escreva o seu nome.' } });
    expect(pedir({ nome: 'Pessoa Teste', itens: [{ cod: '0012', qtd: 50 }], finalidade: 'Ensaio' })).toMatchObject({ ok: false, erro: { codigo: 'ESTOQUE' } });
    expect(pedir({ nome: 'Pessoa Teste', itens: [{ cod: '0012', qtd: 2 }, { cod: '0020', qtd: 4 }], finalidade: 'Ensaio do coral' })).toEqual({ ok: true, dados: { registrados: 2 } });
    const saldo = (cod: string) => Number(amb.repo.listar<Linha>('almoxItens').find((i) => i.id === cod)!.saldo);
    expect([saldo('0012'), saldo('0020')]).toEqual([5, 6]);
    expect(amb.repo.listar<Linha>('almoxMovimentos')[0]).toMatchObject({ tipo: 'saida', qtd: -2, retiradoPorExterno: 'Pessoa Teste (QR da porta)', finalidade: 'Ensaio do coral' });
    const avisos = (amb.chamar('notificacoes.listar', null, { token: amb.gestor }) as Ok<Notificacao[]>).dados.map((n) => n.texto);
    expect(avisos).toContain('Retirada pelo QR da porta: Pessoa Teste levou 2 itens (Ensaio do coral).');
  });

  it('o campo-armadilha engana robôs; um QR novo invalida o antigo', () => {
    const amb = ambiente();
    expect(amb.chamar('retirada.registrar', { chave: amb.chave, nome: 'Robô', itens: [{ cod: '0012', qtd: 1 }], finalidade: 'x', site: 'http://spam' } as never)).toEqual({ ok: true, dados: { registrados: 1 } });
    expect(amb.repo.listar('almoxMovimentos')).toHaveLength(0);
    const nova = (amb.chamar('almox.qr', { novo: true }, { token: amb.gestor }) as Ok<{ chave: string }>).dados.chave;
    expect(nova).not.toBe(amb.chave);
    expect(amb.chamar('retirada.abrir', { chave: amb.chave })).toMatchObject({ ok: false, erro: { codigo: 'CHAVE' } });
    expect(amb.chamar('almox.qr', {}, { token: amb.token('p02') })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });
});
