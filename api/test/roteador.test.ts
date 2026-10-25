import { ErroApi, type Aviso } from '@shared';
import { describe, expect, it } from 'vitest';
import { travaOcupada } from '../src/adaptadores/memoria';
import { exigirVersao, montarPessoa, registrar, tratarRequisicao } from '../src/nucleo/roteador';
import { criarAmbiente } from './apoio';

const avisoNovo = (): Aviso => ({
  id: '', titulo: 'Aviso', texto: 'Texto', publico: 'todos', pessoasIds: [], fixado: false, validoAte: null,
  pedeConfirmacao: false, autorId: '', criadoEm: '', leituras: [],
});

/** Handler mínimo de teste: grava um aviso e registra no histórico. */
const salvarAvisoTeste = {
  'avisos.salvar': (a: Aviso, ctx: Parameters<typeof registrar>[0]) => {
    const id = `a${ctx.portas.repo.listar('avisos').length + 1}`;
    ctx.portas.repo.inserir('avisos', { ...a, id });
    registrar(ctx, 'aviso', id, 'publicou aviso', null, a);
    return { ...a, id };
  },
};

describe('roteador', () => {
  it('ação desconhecida não está disponível', () => {
    const amb = criarAmbiente();
    const r = amb.chamar('eventos.listar', { de: '2026-10-01', ate: '2026-10-31' }, { token: amb.token('p01') });
    expect(r).toEqual({ ok: false, erro: { codigo: 'NAO_DISPONIVEL', mensagem: 'Esta função ainda não está disponível.' } });
  });

  it('JSON quebrado vira erro de requisição', async () => {
    const { tratarRequisicao } = await import('../src/nucleo/roteador');
    const amb = criarAmbiente();
    expect(JSON.parse(tratarRequisicao('{quebrado', amb.portas, {})).erro.codigo).toBe('REQUISICAO');
  });

  it('sem token pede login novamente', () => {
    const amb = criarAmbiente({ handlers: { 'pessoas.listar': () => [] } });
    const r = amb.chamar('pessoas.listar', null);
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'SESSAO', mensagem: 'Sua sessão expirou. Entre novamente.' } });
  });

  it('bolsista não pode salvar pessoas', () => {
    const amb = criarAmbiente({ handlers: { 'pessoas.salvar': (p) => p } });
    const r = amb.chamar('pessoas.salvar', {} as never, { token: amb.token('p02') });
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('token de pessoa desativada ou com versão antiga não vale', () => {
    const amb = criarAmbiente({ handlers: { 'pessoas.listar': () => [] } });
    expect(amb.chamar('pessoas.listar', null, { token: amb.token('p01', 0) })).toMatchObject({ erro: { codigo: 'SESSAO' } });
    const [gestora] = amb.repo.listar<{ id: string; ativo: boolean }>('pessoas');
    amb.repo.atualizar('pessoas', { ...gestora, ativo: false });
    expect(amb.chamar('pessoas.listar', null, { token: amb.token('p01') })).toMatchObject({ erro: { codigo: 'SESSAO' } });
  });

  it('mesmo idRequisicao não grava duas vezes e devolve a mesma resposta', () => {
    const amb = criarAmbiente({ handlers: salvarAvisoTeste as never });
    const t = amb.token('p01');
    const r1 = amb.chamar('avisos.salvar', avisoNovo(), { token: t, idRequisicao: 'mesmo' });
    const r2 = amb.chamar('avisos.salvar', avisoNovo(), { token: t, idRequisicao: 'mesmo' });
    expect(r1).toEqual(r2);
    expect(amb.repo.listar('avisos')).toHaveLength(1);
    expect(amb.repo.listar('historico')).toHaveLength(1);
  });

  it('fila de gravação ocupada vira SISTEMA_OCUPADO', () => {
    const amb = criarAmbiente({ trava: travaOcupada(), handlers: salvarAvisoTeste as never });
    const r = amb.chamar('avisos.salvar', avisoNovo(), { token: amb.token('p01') });
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'SISTEMA_OCUPADO' } });
  });

  it('erro inesperado vira mensagem amigável', () => {
    const amb = criarAmbiente({
      handlers: {
        'config.obter': () => {
          throw new Error('boom');
        },
      },
    });
    const r = amb.chamar('config.obter', null, { token: amb.token('p02') });
    expect(r).toEqual({
      ok: false,
      erro: { codigo: 'INTERNO', mensagem: 'Algo deu errado do nosso lado. Tente de novo; se continuar, avise o gestor do sistema.' },
    });
  });

  it('ErroApi do handler chega como está', () => {
    const amb = criarAmbiente({
      handlers: {
        'config.obter': () => {
          throw new ErroApi('X', 'Mensagem x');
        },
      },
    });
    expect(amb.chamar('config.obter', null, { token: amb.token('p02') })).toEqual({ ok: false, erro: { codigo: 'X', mensagem: 'Mensagem x' } });
  });
});

describe('apoios do roteador', () => {
  it('montarPessoa junta as permissões', () => {
    const amb = criarAmbiente();
    const p = montarPessoa(amb.repo, 'p02')!;
    expect(p.permissoes.mural).toBe('ver');
    expect(p.permissoes.pessoas).toBe('nenhum');
    expect(montarPessoa(amb.repo, 'nao-existe')).toBeNull();
  });

  it('exigirVersao acusa conflito com o nome de quem alterou', () => {
    const nomes = (id: string) => (id === 'p01' ? 'Gestora Teste' : id);
    expect(() => exigirVersao({ atualizadoEm: '2026-10-24T10:30', atualizadoPor: 'p01' }, '2026-10-24T10:00', nomes)).toThrowError(
      'Gestora Teste alterou este registro às 10:30. Recarregue a tela antes de salvar.',
    );
    expect(() => exigirVersao({ atualizadoEm: '2026-10-24T10:30', atualizadoPor: 'p01' }, '2026-10-24T10:30', nomes)).not.toThrow();
    expect(() => exigirVersao({ atualizadoEm: '2026-10-24T10:30', atualizadoPor: 'p01' }, undefined, nomes)).not.toThrow();
  });
});

describe('roteador: cache das abas', () => {
  function registrarChamadas(amb: ReturnType<typeof criarAmbiente>) {
    const log: string[] = [];
    amb.repo.descartarLeituras = () => void log.push('descartar');
    amb.repo.concluirEscrita = () => void log.push('concluir');
    return log;
  }

  it('gravação relê tudo ao pegar a trava e conclui a escrita no fim', () => {
    const amb = criarAmbiente({ handlers: salvarAvisoTeste as never });
    const log = registrarChamadas(amb);
    amb.chamar('avisos.salvar', avisoNovo(), { token: amb.token('p01') });
    expect(log).toEqual(['descartar', 'concluir']);
  });

  it('conclui a escrita mesmo quando o handler falha', () => {
    const amb = criarAmbiente({
      handlers: {
        'avisos.salvar': () => {
          throw new Error('boom');
        },
      },
    });
    const log = registrarChamadas(amb);
    expect(amb.chamar('avisos.salvar', avisoNovo(), { token: amb.token('p01') })).toMatchObject({ ok: false, erro: { codigo: 'INTERNO' } });
    expect(log).toEqual(['descartar', 'concluir']);
  });

  it('consulta não mexe na escrita', () => {
    const amb = criarAmbiente({ handlers: { 'pessoas.listar': () => [] } });
    const log = registrarChamadas(amb);
    amb.chamar('pessoas.listar', null, { token: amb.token('p01') });
    expect(log).toEqual([]);
  });
});

describe('roteador: consultas em lote', () => {
  const lote = (amb: ReturnType<typeof criarAmbiente>, corpo: unknown) => JSON.parse(tratarRequisicao(JSON.stringify(corpo), amb.portas, amb.handlers()));

  it('responde cada consulta na ordem, com o token do lote', () => {
    const amb = criarAmbiente({ handlers: { 'pessoas.listar': () => ['p'] as never, 'feriados.listar': () => ['f'] as never } });
    const r = lote(amb, { token: amb.token('p01'), lote: [{ acao: 'pessoas.listar', dados: null }, { acao: 'feriados.listar', dados: null }, { acao: 'nao.existe', dados: null }] });
    expect(r).toEqual({
      ok: true,
      dados: [
        { ok: true, dados: ['p'] },
        { ok: true, dados: ['f'] },
        { ok: false, erro: { codigo: 'NAO_DISPONIVEL', mensagem: 'Esta função ainda não está disponível.' } },
      ],
    });
  });

  it('sem token, cada consulta pede login', () => {
    const amb = criarAmbiente({ handlers: { 'pessoas.listar': () => [] } });
    const r = lote(amb, { lote: [{ acao: 'pessoas.listar', dados: null }] });
    expect(r.dados[0]).toMatchObject({ ok: false, erro: { codigo: 'SESSAO' } });
  });

  it('gravação não vai em lote', () => {
    const amb = criarAmbiente({ handlers: salvarAvisoTeste as never });
    const r = lote(amb, { token: amb.token('p01'), lote: [{ acao: 'avisos.salvar', dados: avisoNovo() }] });
    expect(r.dados[0]).toEqual({ ok: false, erro: { codigo: 'REQUISICAO', mensagem: 'Gravações não vão em lote.' } });
    expect(amb.repo.listar('avisos')).toEqual([]);
  });

  it('lote vazio ou com mais de 20 consultas é recusado', () => {
    const amb = criarAmbiente();
    expect(lote(amb, { lote: [] })).toMatchObject({ ok: false, erro: { codigo: 'REQUISICAO' } });
    expect(lote(amb, { lote: Array(21).fill({ acao: 'sistema.ping', dados: null }) })).toMatchObject({ ok: false, erro: { codigo: 'REQUISICAO' } });
  });
});
