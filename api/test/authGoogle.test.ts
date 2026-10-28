import { describe, expect, it } from 'vitest';
import { handlersAuth } from '../src/acoes/auth';
import { identidadeMemoria } from '../src/adaptadores/memoria';
import { criarAmbiente } from './apoio';

const CLIENTE = '123-teste.apps.googleusercontent.com';
const valido = { email: 'Bolsista@acad.ufsm.br', emailVerificado: true, audiencia: CLIENTE, emissor: 'https://accounts.google.com', expiraEm: Date.parse('2026-10-25T00:00:00Z') / 1000 };

function ambiente(outros: Record<string, typeof valido> = {}) {
  const amb = criarAmbiente({ handlers: handlersAuth, identidade: identidadeMemoria({ ok: valido, ...outros }) });
  amb.portas.props.definir('GOOGLE_CLIENT_ID', CLIENTE);
  return amb;
}

describe('entrar com a conta Google da UFSM', () => {
  it('entra como a pessoa ativa com aquele e-mail acadêmico, sem pedir troca de senha', () => {
    const r = ambiente().chamar('auth.entrarGoogle', { credencial: 'ok' }) as { ok: true; dados: { token: string; pessoa: { id: string }; senhaInicial: boolean } };
    expect(r).toMatchObject({ ok: true, dados: { pessoa: { id: 'p02' }, senhaInicial: false } });
    expect(r.dados.token.length).toBeGreaterThan(20);
  });

  it('recusa comprovante de outro site, vencido, de e-mail não confirmado, de outro emissor ou que o Google não reconhece', () => {
    const amb = ambiente({
      outroSite: { ...valido, audiencia: 'outro.apps.googleusercontent.com' },
      vencido: { ...valido, expiraEm: 1 },
      naoConfirmado: { ...valido, emailVerificado: false },
      outroEmissor: { ...valido, emissor: 'https://falso.exemplo.com' },
    });
    for (const credencial of ['outroSite', 'vencido', 'naoConfirmado', 'outroEmissor', 'desconhecido']) {
      expect(amb.chamar('auth.entrarGoogle', { credencial })).toMatchObject({ ok: false, erro: { codigo: 'GOOGLE' } });
    }
  });

  it('conta Google sem cadastro, ou de pessoa desativada, não entra', () => {
    const amb = ambiente({ estranho: { ...valido, email: 'ninguem@acad.ufsm.br' } });
    expect(amb.chamar('auth.entrarGoogle', { credencial: 'estranho' })).toMatchObject({ ok: false, erro: { codigo: 'SEM_CADASTRO' } });
    const bolsista = amb.repo.listar<{ id: string; ativo: boolean }>('pessoas').find((p) => p.id === 'p02')!;
    amb.repo.atualizar('pessoas', { ...bolsista, ativo: false });
    expect(amb.chamar('auth.entrarGoogle', { credencial: 'ok' })).toMatchObject({ ok: false, erro: { codigo: 'SEM_CADASTRO' } });
  });

  it('sem o ID do cliente nas propriedades, o login com Google fica desligado', () => {
    const amb = criarAmbiente({ handlers: handlersAuth, identidade: identidadeMemoria({ ok: valido }) });
    expect(amb.chamar('auth.entrarGoogle', { credencial: 'ok' })).toMatchObject({ ok: false, erro: { codigo: 'NAO_DISPONIVEL' } });
  });
});
