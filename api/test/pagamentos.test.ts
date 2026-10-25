import type { Escala, Lote, LoteItem, MeusGanhos } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEscalas } from '../src/acoes/escalas';
import { handlersPagamentos } from '../src/acoes/pagamentos';
import { criarAmbiente } from './apoio';
import { linhaEscala, linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };

function ambiente() {
  const amb = criarAmbiente({ handlers: { ...handlersPagamentos, ...handlersEscalas } });
  amb.repo.inserir('eventos', linhaEvento('e1'));
  amb.repo.inserir('eventos', { ...linhaEvento('e2', 'Evento Externo'), pagamento: 'externo', pagadorExterno: 'Fundação Teste' });
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-10-05' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's2', eventoId: 'e1', data: '2026-10-06', diaria: 12000 }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's3', eventoId: 'e2', data: '2026-10-07' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's4', eventoId: 'e1', data: '2026-10-08' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's5', eventoId: 'e1', data: '2026-10-09' }));
  amb.repo.inserir('escalas', linhaEscala({ id: 'x1', sessaoId: 's1', pessoaId: 'p02', status: 'realizado' }));
  amb.repo.inserir('escalas', linhaEscala({ id: 'x2', sessaoId: 's2', pessoaId: 'p02', status: 'realizado' }));
  amb.repo.inserir('escalas', linhaEscala({ id: 'x3', sessaoId: 's3', pessoaId: 'p02', status: 'realizado' }));
  amb.repo.inserir('escalas', linhaEscala({ id: 'x4', sessaoId: 's4', pessoaId: 'p02', status: 'faltou' }));
  amb.repo.inserir('escalas', linhaEscala({ id: 'x5', sessaoId: 's5', pessoaId: 'p02', status: 'cancelado' }));
  const gestor = amb.token('p01');
  const criar = (escalaIds: string[], titulo = 'Outubro/2026') =>
    amb.chamar('lotes.criar', { escalaIds, titulo, periodoReferencia: 'OUTUBRO/2026', edital: 'Edital 1', iniciativa: 'Iniciativa 1', incluirZerados: true }, { token: gestor });
  const listar = () => (amb.chamar('lotes.listar', null, { token: gestor }) as Ok<{ lotes: Lote[]; itens: LoteItem[] }>).dados;
  const loteDe = (escalaId: string) => amb.repo.listar<{ id: string; loteId: string }>('escalas').find((e) => e.id === escalaId)!.loteId;
  return { ...amb, gestor, criar, listar, loteDe };
}

describe('lotes', () => {
  it('cria lote só com escalas realizadas de evento interno, com a diária certa', () => {
    const amb = ambiente();
    const r = amb.criar(['x1', 'x2']) as Ok<Lote>;
    expect(r.dados).toMatchObject({ titulo: 'Outubro/2026', status: 'enviado', pagoEm: null });
    expect(amb.listar().itens.map((i) => [i.escalaId, i.valor]).sort()).toEqual([['x1', 8000], ['x2', 12000]]);
    expect(amb.loteDe('x1')).toBe(r.dados.id);
    expect(amb.criar([])).toMatchObject({ erro: { codigo: 'LOTE_VAZIO', mensagem: 'Selecione ao menos uma sessão.' } });
    expect(amb.criar(['x1'], ' ')).toMatchObject({ erro: { codigo: 'VALIDACAO', mensagem: 'Informe o título do lote.' } });
  });

  it('mesma escala em dois lotes é recusada', () => {
    const amb = ambiente();
    amb.criar(['x1']);
    expect(amb.criar(['x1'])).toEqual({ ok: false, erro: { codigo: 'NAO_ELEGIVEL', mensagem: 'Alguma sessão selecionada não pode ser paga.' } });
  });

  it('faltou, cancelado e evento externo não entram', () => {
    const amb = ambiente();
    for (const id of ['x3', 'x4', 'x5', 'x-nada']) expect(amb.criar([id])).toMatchObject({ erro: { codigo: 'NAO_ELEGIVEL' } });
  });

  it('retirar item devolve a escala; lote pago não muda; cancelar devolve todas', () => {
    const amb = ambiente();
    const lote = (amb.criar(['x1', 'x2']) as Ok<Lote>).dados;
    expect(amb.chamar('lotes.retirarItem', { loteId: lote.id, escalaId: 'x2' }, { token: amb.gestor }).ok).toBe(true);
    expect(amb.loteDe('x2')).toBe('');
    expect(amb.listar().itens).toHaveLength(1);
    expect((amb.chamar('lotes.marcarPago', { loteId: lote.id, data: '2026-11-10' }, { token: amb.gestor }) as Ok<Lote>).dados).toMatchObject({ status: 'pago', pagoEm: '2026-11-10' });
    expect(amb.chamar('lotes.retirarItem', { loteId: lote.id, escalaId: 'x1' }, { token: amb.gestor })).toMatchObject({ erro: { codigo: 'LOTE_FECHADO' } });
    expect(amb.chamar('lotes.cancelar', { loteId: lote.id, justificativa: 'Erro' }, { token: amb.gestor })).toMatchObject({ erro: { codigo: 'LOTE_FECHADO' } });

    const outro = (amb.criar(['x2'], 'Outro') as Ok<Lote>).dados;
    expect(amb.chamar('lotes.cancelar', { loteId: outro.id, justificativa: ' ' }, { token: amb.gestor })).toMatchObject({ erro: { codigo: 'JUSTIFICATIVA' } });
    expect((amb.chamar('lotes.cancelar', { loteId: outro.id, justificativa: 'Lote duplicado' }, { token: amb.gestor }) as Ok<Lote>).dados.status).toBe('cancelado');
    expect(amb.loteDe('x2')).toBe('');
    expect(amb.criar(['x2'], 'Refeito').ok).toBe(true);
  });

  it('marcar pago avisa as pessoas no app e exige a data', () => {
    const amb = ambiente();
    const lote = (amb.criar(['x1']) as Ok<Lote>).dados;
    expect(amb.chamar('lotes.marcarPago', { loteId: lote.id, data: '' }, { token: amb.gestor })).toMatchObject({ erro: { codigo: 'VALIDACAO', mensagem: 'Informe a data do pagamento.' } });
    amb.chamar('lotes.marcarPago', { loteId: lote.id, data: '2026-11-10' }, { token: amb.gestor });
    const avisos = amb.repo.listar<{ id: string; pessoaId: string; texto: string }>('notificacoes').filter((n) => n.pessoaId === 'p02');
    expect(avisos.map((n) => n.texto)).toContain('Pagamento do Outubro/2026 realizado.');
  });

  it('presença não pode ser refeita depois do lote', () => {
    const amb = ambiente();
    amb.criar(['x1']);
    const r = amb.chamar('escalas.confirmarPresenca', { sessaoId: 's1', faltaram: ['p02'] }, { token: amb.gestor }) as Ok<Escala[]>;
    expect(r.dados.find((e) => e.id === 'x1')!.status).toBe('realizado');
  });

  it('bolsista não vê nem cria lotes', () => {
    const amb = ambiente();
    expect(amb.chamar('lotes.listar', null, { token: amb.token('p02') })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('meus ganhos e pagamento externo', () => {
  it('meus ganhos: enviado, pago e externos', () => {
    const amb = ambiente();
    amb.criar(['x1', 'x2']);
    const g = (amb.chamar('ganhos.meus', null, { token: amb.token('p02') }) as Ok<MeusGanhos>).dados;
    expect(g.enviados).toHaveLength(1);
    expect(g.enviados[0].valor).toBe(20000);
    expect(g.externos).toHaveLength(1);
    expect(g.pagos).toEqual([]);
  });

  it('registra envio ao pagador externo; recusa evento interno', () => {
    const amb = ambiente();
    expect(amb.chamar('externos.registrarEnvio', { eventoId: 'e2', campos: ['nome', 'matricula'] }, { token: amb.gestor })).toEqual({ ok: true, dados: null });
    expect(amb.repo.listar<{ id: string; eventoId: string; campos: string[]; enviadoPor: string }>('envioExterno')[0]).toMatchObject({ eventoId: 'e2', campos: ['nome', 'matricula'], enviadoPor: 'p01' });
    expect(amb.chamar('externos.registrarEnvio', { eventoId: 'e1', campos: ['nome'] }, { token: amb.gestor })).toEqual({
      ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Este evento não tem pagamento externo.' },
    });
  });
});
