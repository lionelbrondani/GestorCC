import type { AlmoxItem, AlmoxMovimento, AlmoxPedido } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersAlmox } from '../src/acoes/almox';
import { criarRepositorioMemoria } from '../src/adaptadores/memoria';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
const item = (p: Partial<AlmoxItem> = {}): AlmoxItem => ({
  cod: '12', nomeAlmox: 'LAMPADA LED 9W', nomeComum: 'Lâmpada', unidade: 'un', valor: 1500, categoria: 'Elétrica', qtdMinima: 2, sala: 'Depósito', status: 'Ativo', saldo: 0, ...p,
});

function ambiente(abasLivres: Record<string, Record<string, unknown>[]> = {}) {
  const amb = criarAmbiente({ handlers: handlersAlmox });
  // a importação lê abas livres: o repositório em memória recebe as linhas prontas
  if (Object.keys(abasLivres).length) Object.assign(amb.repo, { lerAbaLivre: criarRepositorioMemoria({}, amb.relogio, abasLivres).lerAbaLivre });
  const gestor = amb.token('p01');
  const chamar = <T,>(acao: string, dados: unknown, token = gestor) => amb.chamar(acao as never, dados as never, { token }) as { ok: true; dados: T } | { ok: false; erro: { codigo: string; mensagem: string } };
  const saldo = (cod: string) => amb.repo.listar<{ id: string; saldo: number }>('almoxItens').find((i) => i.id === cod)!.saldo;
  const cadastrarCom = (qtd: number) => {
    chamar('almox.salvarItem', item());
    if (qtd) chamar('almox.ajustar', { cod: '12', qtd, motivo: 'contagem' });
  };
  return { ...amb, gestor, chamar, saldo, cadastrarCom };
}

describe('almoxarifado', () => {
  it('cadastrar item com cod 12 vira 0012 e começa com saldo 0', () => {
    const amb = ambiente();
    const r = amb.chamar<AlmoxItem>('almox.salvarItem', item()) as Ok<AlmoxItem>;
    expect(r.dados).toMatchObject({ cod: '0012', saldo: 0 });
    amb.chamar('almox.salvarItem', item({ cod: '0012', nomeComum: 'Lâmpada LED', saldo: 999 }));
    expect(amb.saldo('0012')).toBe(0);
  });

  it('retirada baixa o saldo e grava quem retirou', () => {
    const amb = ambiente();
    amb.cadastrarCom(5);
    const r = amb.chamar<AlmoxMovimento[]>('almox.retirar', { itens: [{ cod: '12', qtd: 2 }], retiradoPorPessoaId: 'p02', finalidade: 'Troca no camarim' }) as Ok<AlmoxMovimento[]>;
    expect(r.dados[0]).toMatchObject({ tipo: 'saida', cod: '0012', qtd: -2, valorUnitario: 1500, retiradoPorPessoaId: 'p02', finalidade: 'Troca no camarim' });
    expect(amb.saldo('0012')).toBe(3);
  });

  it('retirar acima do saldo é recusado, também em duas retiradas seguidas', () => {
    const amb = ambiente();
    amb.cadastrarCom(3);
    const retirar = (qtd: number) => amb.chamar('almox.retirar', { itens: [{ cod: '0012', qtd }], retiradoPorPessoaId: 'p02', finalidade: 'Evento' });
    expect(retirar(4)).toEqual({ ok: false, erro: { codigo: 'ESTOQUE', mensagem: '0012: Saldo insuficiente (disponível: 3)' } });
    expect(retirar(2).ok).toBe(true);
    expect(retirar(2)).toMatchObject({ erro: { codigo: 'ESTOQUE' } });
    expect(amb.saldo('0012')).toBe(1);
  });

  it('retirada exige finalidade e quem retira', () => {
    const amb = ambiente();
    amb.cadastrarCom(3);
    expect(amb.chamar('almox.retirar', { itens: [{ cod: '12', qtd: 1 }], retiradoPorPessoaId: 'p02', finalidade: ' ' })).toMatchObject({ erro: { codigo: 'FINALIDADE', mensagem: 'Informe a finalidade da retirada.' } });
    expect(amb.chamar('almox.retirar', { itens: [{ cod: '12', qtd: 1 }], finalidade: 'Evento' })).toMatchObject({ erro: { codigo: 'QUEM_RETIRA', mensagem: 'Informe quem está retirando.' } });
    expect(amb.chamar('almox.retirar', { itens: [{ cod: '12', qtd: 1 }], retiradoPorExterno: 'Desconhecido', finalidade: 'Evento' })).toMatchObject({ erro: { codigo: 'QUEM_RETIRA' } });
  });

  it('ajuste exige motivo e não deixa saldo negativo', () => {
    const amb = ambiente();
    amb.cadastrarCom(2);
    expect(amb.chamar('almox.ajustar', { cod: '12', qtd: -1, motivo: '' })).toMatchObject({ erro: { codigo: 'MOTIVO', mensagem: 'Informe o motivo do ajuste.' } });
    expect(amb.chamar('almox.ajustar', { cod: '12', qtd: -3, motivo: 'quebra' })).toMatchObject({ erro: { codigo: 'ESTOQUE', mensagem: 'O ajuste deixaria o saldo negativo.' } });
    expect((amb.chamar('almox.ajustar', { cod: '12', qtd: -1, motivo: 'quebra' }) as Ok<AlmoxItem>).dados.saldo).toBe(1);
  });

  it('pedido recebido em parte e depois por completo', () => {
    const amb = ambiente();
    amb.cadastrarCom(0);
    const pedido = (amb.chamar('almox.criarPedido', { itens: [{ cod: '12', qtdPedida: 10, valorEstimado: 1500 }] }) as Ok<AlmoxPedido>).dados;
    expect(pedido).toMatchObject({ status: 'aberto', solicitanteId: 'p01', itens: [{ cod: '0012', qtdPedida: 10, qtdRecebida: 0 }] });
    expect((amb.chamar('almox.receber', { pedidoId: pedido.id, itens: [{ cod: '12', qtd: 4 }] }) as Ok<AlmoxPedido>).dados.status).toBe('parcial');
    expect((amb.chamar('almox.receber', { pedidoId: pedido.id, itens: [{ cod: '12', qtd: 6 }] }) as Ok<AlmoxPedido>).dados.status).toBe('recebido');
    expect(amb.saldo('0012')).toBe(10);
    expect(amb.chamar('almox.receber', { pedidoId: pedido.id, itens: [{ cod: '12', qtd: 1 }] })).toMatchObject({ erro: { codigo: 'PEDIDO_FECHADO', mensagem: 'Este pedido já foi recebido.' } });
    expect(amb.chamar('almox.criarPedido', { itens: [] })).toMatchObject({ erro: { codigo: 'PEDIDO_VAZIO' } });
    expect((amb.chamar('almox.pedidos', null) as Ok<AlmoxPedido[]>).dados).toHaveLength(1);
    const movs = (amb.chamar('almox.movimentos', { cod: '12' }) as Ok<AlmoxMovimento[]>).dados;
    expect(movs.filter((m) => m.tipo === 'recebimento').map((m) => m.qtd).sort()).toEqual([4, 6]);
  });

  it('importa itens e autorizados, com problemas por linha, sem duplicar', () => {
    const amb = ambiente({
      'dados:IMPORTAR_ALMOX': [
        { COD: 7, NOME_ALMOX: 'FITA CREPE', NOME_COMUM: 'Fita', UNIDADE: 'rolo', VALOR: '8,50', CATEGORIA: 'Escritório', QTD_MINIMA: 3, SALA: 'Depósito', STATUS: 'Ativo', SALDO: 12 },
        { COD: '', NOME_ALMOX: 'SEM CÓDIGO' },
      ],
      'dados:IMPORTAR_AUTORIZADOS': [{ NOME: 'Técnico da Produtora' }],
    });
    const r = amb.chamar('almox.importar', null) as Ok<{ itens: number; autorizados: number; problemas: { linha: number; mensagem: string }[] }>;
    expect(r.dados).toEqual({ itens: 1, autorizados: 1, problemas: [{ linha: 3, mensagem: 'Código em branco.' }] });
    expect(amb.saldo('0007')).toBe(12);
    expect(amb.repo.listar<{ id: string; motivo: string }>('almoxMovimentos')[0].motivo).toBe('saldo inicial (importação)');
    expect((amb.chamar('almox.importar', null) as Ok<{ itens: number }>).dados.itens).toBe(0);
    expect(amb.saldo('0007')).toBe(12);
    expect((amb.chamar('almox.listar', null) as Ok<{ autorizadosExternos: string[] }>).dados.autorizadosExternos).toEqual(['Técnico da Produtora']);
  });

  it('bolsista sem acesso ao almoxarifado', () => {
    const amb = ambiente();
    expect(amb.chamar('almox.listar', null, amb.token('p02'))).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
    expect(amb.chamar('almox.retirar', { itens: [], finalidade: 'x' }, amb.token('p02'))).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('almoxarifado: autorizados a retirar', () => {
  it('cadastra, renomeia e desativa autorizados', () => {
    const amb = ambiente();
    const a = amb.chamar<{ id: string; nome: string; ativo: boolean }>('almox.salvarAutorizado', { id: '', nome: '  Técnico da Luz  ', ativo: true }) as Ok<{ id: string; nome: string; ativo: boolean }>;
    expect(a.dados).toMatchObject({ nome: 'Técnico da Luz', ativo: true });
    amb.chamar('almox.salvarAutorizado', { id: a.dados.id, nome: 'Técnico de Luz', ativo: false });
    expect((amb.chamar<{ nome: string; ativo: boolean }[]>('almox.autorizados', null) as Ok<{ nome: string; ativo: boolean }[]>).dados).toEqual([
      expect.objectContaining({ nome: 'Técnico de Luz', ativo: false }),
    ]);
    expect(amb.chamar('almox.salvarAutorizado', { id: '', nome: ' ', ativo: true })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
    expect(amb.chamar('almox.salvarAutorizado', { id: '', nome: 'técnico de luz', ativo: true })).toMatchObject({ ok: false, erro: { mensagem: 'Já existe um autorizado com este nome.' } });
  });

  it('na retirada, um nome novo pode ser cadastrado na hora', () => {
    const amb = ambiente();
    amb.cadastrarCom(5);
    const sem = amb.chamar('almox.retirar', { itens: [{ cod: '12', qtd: 1 }], retiradoPorExterno: 'Produtora Teste', finalidade: 'Montagem' });
    expect(sem).toMatchObject({ ok: false, erro: { codigo: 'QUEM_RETIRA' } });
    const com = amb.chamar<AlmoxMovimento[]>('almox.retirar', { itens: [{ cod: '12', qtd: 1 }], retiradoPorExterno: ' Produtora Teste ', cadastrarExterno: true, finalidade: 'Montagem' });
    expect((com as Ok<AlmoxMovimento[]>).dados[0].retiradoPorExterno).toBe('Produtora Teste');
    expect((amb.chamar<{ autorizadosExternos: string[] }>('almox.listar', null) as Ok<{ autorizadosExternos: string[] }>).dados.autorizadosExternos).toContain('Produtora Teste');
  });
});
