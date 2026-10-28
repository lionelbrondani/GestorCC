import { act, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { CONTAS, renderizar } from '../../teste/renderizar';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('entrar com a conta Google', () => {
  it('com o ID do cliente configurado, o botão do Google entra direto, sem senha', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '123-teste.apps.googleusercontent.com');
    let devolver!: (r: { credential: string }) => void;
    const desenhar = vi.fn();
    // o botão oficial (Google Identity Services) de mentira: guarda a função que recebe o comprovante
    vi.stubGlobal('google', { accounts: { id: { initialize: (o: { callback: typeof devolver }) => (devolver = o.callback), renderButton: desenhar } } });
    const pedidos: unknown[] = [];
    const { router } = await renderizar({
      pessoa: null,
      rota: '/entrar',
      aoCriarApi: (api) => {
        const original = api.chamar.bind(api) as (acao: string, dados: unknown) => Promise<unknown>;
        // no protótipo não há Google: a API de mentira responde como se a conta fosse a do gestor
        vi.spyOn(api, 'chamar').mockImplementation(((acao: string, dados: unknown) => {
          if (acao !== 'auth.entrarGoogle') return original(acao, dados);
          pedidos.push(dados);
          return original('auth.entrar', CONTAS.gestor);
        }) as never);
      },
    });
    await waitFor(() => expect(desenhar).toHaveBeenCalled());
    await act(async () => devolver({ credential: 'comprovante-do-google' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(pedidos).toEqual([{ credencial: 'comprovante-do-google' }]);
  });

  it('sem o ID do cliente, só aparece o login com e-mail e senha', async () => {
    const { container } = await renderizar({ pessoa: null, rota: '/entrar' });
    await waitFor(() => expect(container.querySelector('form')).not.toBeNull());
    expect(container.querySelector('.login-google')).toBeNull();
  });
});
