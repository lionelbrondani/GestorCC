import { describe, expect, it } from 'vitest';
import { handlersEmails } from '../src/acoes/emails';
import { emailMemoria } from '../src/adaptadores/memoria';
import { criarAmbiente } from './apoio';

function ambiente(cota = 100) {
  const email = emailMemoria(cota);
  const amb = criarAmbiente({ email, handlers: handlersEmails });
  return { amb, email, gestor: amb.token('p01'), bolsista: amb.token('p02') };
}

const base = { tipo: 'ficha' as const, para: ['produtor@exemplo.com'], assunto: 'Ficha técnica', mensagem: 'Olá! Segue o link.' };

describe('e-mails (só quando alguém clica em Enviar)', () => {
  it('manda o e-mail confirmado e devolve quantos foram e quanto resta da cota', () => {
    const { amb, email, gestor } = ambiente();
    expect(amb.chamar('emails.enviar', { ...base, html: '<b>só na FUNDEP</b>' }, { token: gestor })).toEqual({ ok: true, dados: { enviados: 1, restante: 99 } });
    expect(email.enviados).toEqual([{ para: ['produtor@exemplo.com'], assunto: 'Ficha técnica', texto: 'Olá! Segue o link.', anexos: [] }]);
  });

  it('cada pessoa recebe o seu e-mail; as pessoas escolhidas pelo id viram o endereço delas', () => {
    const { amb, email, gestor } = ambiente();
    const r = amb.chamar('emails.enviar', { ...base, tipo: 'escala', para: ['extra@ufsm.br'], pessoaIds: ['p02', 'p01', 'nao-existe'] }, { token: gestor });
    expect(r).toEqual({ ok: true, dados: { enviados: 3, restante: 97 } });
    expect(email.enviados.map((e) => e.para)).toEqual([['extra@ufsm.br'], ['bolsista@acad.ufsm.br'], ['gestor@ufsm.br']]);
  });

  it('o pedido à FUNDEP vai num e-mail só, formatado e com os PDFs assinados dos contratos escolhidos', () => {
    const { amb, email, gestor } = ambiente();
    amb.repo.inserir('contratos', { id: 'c1', numero: '01/2026', pdfAssinadoId: 'arq-1' } as never);
    amb.repo.inserir('contratos', { id: 'c2', numero: '02/2026', pdfAssinadoId: '' } as never);
    const r = amb.chamar('emails.enviar', { ...base, tipo: 'fundep', para: ['a@fundep.br', 'b@fundep.br'], html: '<p>Prezadas</p>', contratoIds: ['c1', 'c2'] }, { token: gestor });
    expect(r).toEqual({ ok: true, dados: { enviados: 2, restante: 98 } });
    expect(email.enviados).toEqual([{ para: ['a@fundep.br', 'b@fundep.br'], assunto: 'Ficha técnica', texto: 'Olá! Segue o link.', html: '<p>Prezadas</p>', anexos: ['arq-1'] }]);
  });

  it('recusa quem não edita o módulo do e-mail', () => {
    const { amb, email, bolsista } = ambiente();
    expect(amb.chamar('emails.enviar', base, { token: bolsista })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
    expect(email.enviados).toEqual([]);
  });

  it('confere endereços, assunto, mensagem e o limite de destinatários por envio', () => {
    const { amb, email, gestor } = ambiente();
    const enviar = (dados: object) => amb.chamar('emails.enviar', { ...base, ...dados }, { token: gestor });
    expect(enviar({ para: ['sem-arroba'] })).toEqual({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'E-mail inválido: sem-arroba.' } });
    expect(enviar({ para: [] })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
    expect(enviar({ assunto: '  ' })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
    expect(enviar({ mensagem: '' })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
    expect(enviar({ para: Array.from({ length: 51 }, (_, i) => `p${i}@ufsm.br`) })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
    expect(email.enviados).toEqual([]);
  });

  it('o assunto vira uma linha só', () => {
    const { amb, email, gestor } = ambiente();
    amb.chamar('emails.enviar', { ...base, assunto: 'Ficha\r\ntécnica ' }, { token: gestor });
    expect(email.enviados[0].assunto).toBe('Ficha técnica');
  });

  it('não passa da cota do dia', () => {
    const { amb, email, gestor } = ambiente(1);
    expect(amb.chamar('emails.enviar', { ...base, para: ['a@ufsm.br', 'b@ufsm.br'] }, { token: gestor })).toMatchObject({ ok: false, erro: { codigo: 'LIMITE' } });
    expect(email.enviados).toEqual([]);
    expect(amb.chamar('emails.cota', null, { token: gestor })).toEqual({ ok: true, dados: { restante: 1 } });
  });

  it('o mesmo pedido repetido (rede instável) não manda de novo', () => {
    const { amb, email, gestor } = ambiente();
    amb.chamar('emails.enviar', base, { token: gestor, idRequisicao: 'mesmo' });
    amb.chamar('emails.enviar', base, { token: gestor, idRequisicao: 'mesmo' });
    expect(email.enviados).toHaveLength(1);
  });

  it('registra o envio no histórico, sem guardar os endereços', () => {
    const { amb, gestor } = ambiente();
    amb.chamar('emails.enviar', { ...base, para: ['a@ufsm.br', 'b@ufsm.br'] }, { token: gestor });
    const historico = amb.repo.listar<{ id: string; entidade: string; acao: string }>('historico');
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({ entidade: 'email', acao: 'mandou o e-mail "Ficha técnica" para 2 pessoas' });
    expect(JSON.stringify(historico)).not.toContain('a@ufsm.br');
  });
});
