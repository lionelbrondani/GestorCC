import { describe, expect, it } from 'vitest';
import { handlersAuth, recuperarAcesso } from '../src/acoes/auth';
import { BOLSISTA, criarAmbiente, GESTOR } from './apoio';

const ambiente = () => criarAmbiente({ handlers: { ...handlersAuth, 'pessoas.listar': () => [] } });
type Ok<T> = { ok: true; dados: T };

describe('entrar', () => {
  it('aceita e-mail com maiúsculas e espaços e a matrícula como senha inicial', () => {
    const amb = ambiente();
    const r = amb.chamar('auth.entrar', { email: '  Gestor@UFSM.br ', senha: GESTOR.matricula }) as Ok<{ token: string; senhaInicial: boolean }>;
    expect(r.ok).toBe(true);
    expect(r.dados.senhaInicial).toBe(true);
    expect(amb.chamar('pessoas.listar', null, { token: r.dados.token }).ok).toBe(true);
  });

  it('senha errada não revela se o e-mail existe', () => {
    const amb = ambiente();
    const erroSenha = amb.chamar('auth.entrar', { email: GESTOR.emailAcademico, senha: 'errada' });
    const erroEmail = amb.chamar('auth.entrar', { email: 'ninguem@ufsm.br', senha: 'errada' });
    expect(erroSenha).toEqual({ ok: false, erro: { codigo: 'CREDENCIAIS', mensagem: 'E-mail ou senha incorretos.' } });
    expect(erroEmail).toEqual(erroSenha);
  });

  it('5 erros seguidos bloqueiam por 15 minutos, mesmo com a senha certa', () => {
    const amb = ambiente();
    for (let i = 0; i < 5; i++) amb.chamar('auth.entrar', { email: GESTOR.emailAcademico, senha: 'errada' });
    expect(amb.chamar('auth.entrar', { email: GESTOR.emailAcademico, senha: GESTOR.matricula })).toEqual({
      ok: false,
      erro: { codigo: 'BLOQUEADO', mensagem: 'Muitas tentativas. Tente de novo às 10:15.' },
    });
    amb.relogio.avancarMinutos(15);
    expect(amb.chamar('auth.entrar', { email: GESTOR.emailAcademico, senha: GESTOR.matricula }).ok).toBe(true);
  });
});

describe('trocar senha', () => {
  it('invalida o token antigo e devolve um novo que funciona', () => {
    const amb = ambiente();
    const antigo = amb.token('p02');
    const r = amb.chamar('auth.trocarSenha', { atual: BOLSISTA.matricula, nova: 'novaSenha123' }, { token: antigo }) as Ok<{ token: string }>;
    expect(r.ok).toBe(true);
    expect(amb.chamar('pessoas.listar', null, { token: antigo })).toMatchObject({ erro: { codigo: 'SESSAO' } });
    expect(amb.chamar('pessoas.listar', null, { token: r.dados.token }).ok).toBe(true);
    const login = amb.chamar('auth.entrar', { email: BOLSISTA.emailAcademico, senha: 'novaSenha123' }) as Ok<{ senhaInicial: boolean }>;
    expect(login.dados.senhaInicial).toBe(false);
  });

  it('espaços nas pontas da senha nova não impedem de entrar depois (o login ignora as pontas)', () => {
    const amb = ambiente();
    const t = amb.token('p02');
    expect(amb.chamar('auth.trocarSenha', { atual: ` ${BOLSISTA.matricula} `, nova: ' novaSenha123 ' }, { token: t }).ok).toBe(true);
    expect(amb.chamar('auth.entrar', { email: BOLSISTA.emailAcademico, senha: 'novaSenha123' }).ok).toBe(true);
    expect(amb.chamar('auth.trocarSenha', { atual: 'novaSenha123', nova: '  curta  ' }, { token: amb.token('p02', 2) })).toMatchObject({
      erro: { codigo: 'SENHA_CURTA' },
    });
  });

  it('confere a senha atual e o tamanho da nova', () => {
    const amb = ambiente();
    const t = amb.token('p02');
    expect(amb.chamar('auth.trocarSenha', { atual: 'x', nova: 'novaSenha123' }, { token: t })).toMatchObject({ erro: { codigo: 'SENHA_ATUAL' } });
    expect(amb.chamar('auth.trocarSenha', { atual: BOLSISTA.matricula, nova: 'curta' }, { token: t })).toMatchObject({ erro: { codigo: 'SENHA_CURTA' } });
  });
});

describe('redefinir senha (sem e-mail)', () => {
  it('não existe link de redefinição por e-mail: quem esqueceu pede ao gestor', () => {
    const amb = ambiente();
    for (const acao of ['auth.esqueciSenha', 'auth.redefinirSenha']) {
      expect(amb.chamar(acao as never, { email: BOLSISTA.emailAcademico } as never)).toMatchObject({ erro: { codigo: 'NAO_DISPONIVEL' } });
    }
  });

  it('gestor volta a senha para a matrícula e encerra as sessões', () => {
    const amb = ambiente();
    const antigo = amb.token('p02');
    amb.chamar('auth.trocarSenha', { atual: BOLSISTA.matricula, nova: 'novaSenha123' }, { token: antigo });
    expect(amb.chamar('pessoas.redefinirSenha', { pessoaId: 'p02' }, { token: amb.token('p01') }).ok).toBe(true);
    const login = amb.chamar('auth.entrar', { email: BOLSISTA.emailAcademico, senha: BOLSISTA.matricula }) as Ok<{ senhaInicial: boolean }>;
    expect(login.dados.senhaInicial).toBe(true);
  });

  it('o histórico não guarda senhas nem tokens', () => {
    const amb = ambiente();
    amb.chamar('auth.trocarSenha', { atual: BOLSISTA.matricula, nova: 'novaSenha123' }, { token: amb.token('p02') });
    expect(JSON.stringify(amb.repo.listar('historico'))).not.toMatch(/novaSenha123|hash|sal/);
  });
});

describe('recuperar acesso pelo editor', () => {
  it('volta a senha para a matrícula, encerra as sessões e exige troca no próximo login', () => {
    const amb = ambiente();
    amb.chamar('auth.trocarSenha', { atual: GESTOR.matricula, nova: 'esqueciEssa1' }, { token: amb.token('p01') });
    const sessao = amb.token('p01', 2);

    expect(recuperarAcesso(amb.portas, ' Gestor@UFSM.br ', GESTOR.matricula)).toBe('p01');

    expect(amb.chamar('pessoas.listar', null, { token: sessao })).toMatchObject({ erro: { codigo: 'SESSAO' } });
    const login = amb.chamar('auth.entrar', { email: GESTOR.emailAcademico, senha: GESTOR.matricula }) as Ok<{ senhaInicial: boolean }>;
    expect(login.dados.senhaInicial).toBe(true);
    expect(JSON.stringify(amb.repo.listar('historico'))).toContain('recuperação de acesso');
  });

  it('e-mail que não é de ninguém ativo é recusado', () => {
    expect(() => recuperarAcesso(ambiente().portas, 'ninguem@ufsm.br', '123')).toThrow('ninguem@ufsm.br');
  });
});
