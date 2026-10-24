import { MODELOS, MODULOS, type Pessoa } from '@shared';
import { describe, expect, it } from 'vitest';
import { criptoNode } from '../src/adaptadores/node';
import { handlersAuth, criarCredencialInicial } from '../src/acoes/auth';
import { handlersPessoas } from '../src/acoes/pessoas';
import { BOLSISTA, criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };

function ambiente() {
  const amb = criarAmbiente({ handlers: { ...handlersAuth, ...handlersPessoas } });
  // Segunda gestora, para simular edição simultânea.
  amb.repo.inserir('pessoas', { id: 'p03', nome: 'Outra Gestora', nomeCurto: 'OUTRA', emailAcademico: 'outra@ufsm.br', matricula: '1000000003', tipo: 'servidor', vinculo: 'fixo', experiente: false, escalarMenos: false, ativo: true });
  for (const m of MODULOS) amb.repo.inserir('permissoes', { id: `p03:${m.id}`, pessoaId: 'p03', modulo: m.id, nivel: MODELOS.gestor[m.id] });
  amb.repo.inserir('credenciais', criarCredencialInicial(criptoNode, 'p03', '1000000003'));
  return amb;
}

const buscar = (amb: ReturnType<typeof ambiente>, token: string, id: string) =>
  (amb.chamar('pessoas.listar', null, { token }) as Ok<Pessoa[]>).dados.find((p) => p.id === id)!;

describe('pessoas', () => {
  it('edição simultânea: a segunda gravação com versão antiga é recusada', () => {
    const amb = ambiente();
    const a = amb.token('p01');
    const b = amb.token('p03');
    amb.chamar('pessoas.salvar', { ...buscar(amb, a, 'p02'), nomeCurto: 'BOLSISTA T.' }, { token: a });
    const carregadaPorA = buscar(amb, a, 'p02');
    amb.relogio.avancarMinutos(5);
    expect(amb.chamar('pessoas.salvar', { ...buscar(amb, b, 'p02'), experiente: true }, { token: b }).ok).toBe(true);
    const r = amb.chamar('pessoas.salvar', { ...carregadaPorA, escalarMenos: true }, { token: a });
    expect(r).toEqual({ ok: false, erro: { codigo: 'CONFLITO', mensagem: 'Outra Gestora alterou este registro às 10:05. Recarregue a tela antes de salvar.' } });
  });

  it('pessoa nova entra com a matrícula e recebe as permissões escolhidas', () => {
    const amb = ambiente();
    const nova: Pessoa = {
      id: '', nome: 'Nova Pessoa', nomeCurto: 'NOVA', emailAcademico: 'Nova.Pessoa@acad.ufsm.br ', matricula: '202600099', tipo: 'bolsista',
      vinculo: 'fixo', experiente: false, escalarMenos: false, ativo: true, permissoes: MODELOS.operacao,
    };
    const r = amb.chamar('pessoas.salvar', nova, { token: amb.token('p01') }) as Ok<Pessoa>;
    expect(r.ok).toBe(true);
    expect(r.dados.permissoes.escalas).toBe('editar');
    const login = amb.chamar('auth.entrar', { email: 'nova.pessoa@acad.ufsm.br', senha: '202600099' }) as Ok<{ senhaInicial: boolean }>;
    expect(login.dados.senhaInicial).toBe(true);
  });

  it('valida matrícula e e-mail repetido', () => {
    const amb = ambiente();
    const base = { ...buscar(amb, amb.token('p01'), 'p02') };
    expect(amb.chamar('pessoas.salvar', { ...base, matricula: '123' }, { token: amb.token('p01') })).toMatchObject({ erro: { codigo: 'MATRICULA' } });
    expect(amb.chamar('pessoas.salvar', { ...base, emailAcademico: 'GESTOR@ufsm.br' }, { token: amb.token('p01') })).toMatchObject({ erro: { codigo: 'EMAIL' } });
  });

  it('desativar encerra a sessão da pessoa', () => {
    const amb = ambiente();
    const tokenBolsista = amb.token('p02');
    amb.chamar('pessoas.salvar', { ...buscar(amb, amb.token('p01'), 'p02'), ativo: false }, { token: amb.token('p01') });
    expect(amb.chamar('pessoas.listar', null, { token: tokenBolsista })).toMatchObject({ erro: { codigo: 'SESSAO' } });
  });

  it('quem não é gestor vê a equipe sem e-mail nem matrícula', () => {
    const amb = ambiente();
    const lista = (amb.chamar('pessoas.listar', null, { token: amb.token('p02') }) as Ok<Pessoa[]>).dados;
    expect(lista.every((p) => p.emailAcademico === '' && p.matricula === '')).toBe(true);
  });
});

describe('dados pessoais e perfil', () => {
  it('bolsista lê os próprios dados, mas não os de outra pessoa', () => {
    const amb = ambiente();
    const t = amb.token('p02');
    expect(amb.chamar('dadosPessoais.salvar', { pessoaId: 'p02', cpf: '12345678909', banco: 'Banco X', agencia: '0001', conta: '123-4' }, { token: t }).ok).toBe(true);
    expect((amb.chamar('dadosPessoais.obter', { pessoaId: 'p02' }, { token: t }) as Ok<{ cpf: string }>).dados.cpf).toBe('123.456.789-09');
    expect(amb.chamar('dadosPessoais.obter', { pessoaId: 'p01' }, { token: t })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('CPF inválido é recusado', () => {
    const amb = ambiente();
    expect(amb.chamar('dadosPessoais.salvar', { pessoaId: 'p02', cpf: '123.456.789-00', banco: '', agencia: '', conta: '' }, { token: amb.token('p02') }))
      .toMatchObject({ erro: { codigo: 'CPF' } });
  });

  it('mudança bancária feita pela própria pessoa avisa os gestores', () => {
    const amb = ambiente();
    amb.chamar('dadosPessoais.salvar', { pessoaId: 'p02', cpf: '', banco: 'Banco X', agencia: '0001', conta: '123-4' }, { token: amb.token('p02') });
    const avisos = amb.repo.listar<{ id: string; pessoaId: string; texto: string }>('notificacoes');
    expect(avisos.map((n) => n.pessoaId).sort()).toEqual(['p01', 'p03']);
    expect(avisos[0].texto).toContain(BOLSISTA.nome);
  });

  it('perfil: convites do Google Agenda só para e-mails do próprio cadastro', () => {
    const amb = ambiente();
    const t = amb.token('p02');
    expect((amb.chamar('perfil.salvarAgenda', { email: BOLSISTA.emailAcademico }, { token: t }) as Ok<Pessoa>).dados.convitesAgenda).toBe(BOLSISTA.emailAcademico);
    expect(amb.chamar('perfil.salvarAgenda', { email: 'outro@gmail.com' }, { token: t })).toMatchObject({ erro: { codigo: 'EMAIL' } });
  });
});
