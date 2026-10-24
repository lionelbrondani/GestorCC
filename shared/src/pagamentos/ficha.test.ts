import { describe, expect, it } from 'vitest';
import { escala, evento, pessoa, sessao } from '../teste/fabricas';
import type { Lote } from '../tipos';
import { mascararCpf, montarFicha } from './ficha';

describe('mascararCpf', () => {
  it('mantém só o terceiro bloco', () => expect(mascararCpf('123.456.789-09')).toBe('***.***.789-**'));
  it('vazio continua vazio', () => expect(mascararCpf('')).toBe(''));
});

describe('montarFicha', () => {
  const lote: Lote = {
    id: 'L', titulo: 'Lote', periodoReferencia: 'OUTUBRO/2026 – eventos de 16/09/2026 até 15/10/2026',
    edital: 'edital 000/2026', iniciativa: 'Iniciativa Teste', incluirZerados: true, status: 'enviado', criadoEm: '2026-10-16', pagoEm: null,
  };
  const ana = pessoa({ id: 'a', nome: 'ANA TESTE', matricula: '202600001' });
  const bia = pessoa({ id: 'b', nome: 'BIA TESTE', matricula: '202600002' });
  const servidor = pessoa({ id: 's', nome: 'SERVIDOR', tipo: 'servidor' });
  const base = {
    eventos: [evento({ id: 'ev', nome: 'Concerto' })],
    sessoes: [sessao({ id: 's1', eventoId: 'ev', data: '2026-10-02' }), sessao({ id: 's2', eventoId: 'ev', data: '2026-09-20' })],
    escalas: [
      escala({ id: 'x1', sessaoId: 's1', pessoaId: 'a', status: 'realizado', loteId: 'L' }),
      escala({ id: 'x2', sessaoId: 's2', pessoaId: 'a', status: 'realizado', loteId: 'L' }),
    ],
    lotes: [lote],
  };
  const itens = [
    { loteId: 'L', escalaId: 'x1', pessoaId: 'a', valor: 8000 },
    { loteId: 'L', escalaId: 'x2', pessoaId: 'a', valor: 8000 },
  ];
  const dados = [{ pessoaId: 'a', cpf: '123.456.789-09', banco: 'Banco Teste', agencia: '0001', conta: '12345-6' }];

  it('inclui zerados, soma total e discrimina eventos em ordem de data', () => {
    const f = montarFicha({ lote, itens, pessoas: [bia, ana, servidor], dados, base, mascarar: false });
    expect(f.linhas.map((l) => [l.ordem, l.nome, l.valor])).toEqual([[1, 'ANA TESTE', 16000], [2, 'BIA TESTE', 0]]);
    expect(f.linhas[0].cpf).toBe('123.456.789-09');
    expect(f.linhas[1].cpf).toBe('');
    expect(f.total).toBe(16000);
    expect(f.discriminacao).toEqual([
      { nome: 'ANA TESTE', eventos: 'Concerto (20/09/2026), Concerto (02/10/2026)' },
      { nome: 'BIA TESTE', eventos: '' },
    ]);
    expect(f.iniciativaEdital).toBe('Iniciativa: Iniciativa Teste - edital 000/2026.');
    expect(f.observacao).toBe('O recurso sairá da Iniciativa Teste.');
  });

  it('mascara CPF e omite zerados quando pedido', () => {
    const f = montarFicha({ lote: { ...lote, incluirZerados: false }, itens, pessoas: [ana, bia], dados, base, mascarar: true });
    expect(f.linhas).toHaveLength(1);
    expect(f.linhas[0].cpf).toBe('***.***.789-**');
  });
});
