import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CONTAS, renderizar } from '../../teste/renderizar';

describe('Login', () => {
  it('bolsista entra e vê o aviso de senha inicial', async () => {
    const { router } = await renderizar({ pessoa: null, rota: '/entrar' });
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('E-mail acadêmico'), CONTAS.bolsista.email);
    await u.type(screen.getByLabelText('Senha'), CONTAS.bolsista.senha);
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText(/Você ainda usa a senha inicial/)).toBeInTheDocument();
  });

  it('esqueci a senha orienta a pedir ao gestor, sem enviar nada', async () => {
    const { api } = await renderizar({ pessoa: null, rota: '/entrar' });
    const chamar = vi.spyOn(api, 'chamar');
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('E-mail acadêmico'), CONTAS.bolsista.email);
    await u.click(screen.getByRole('button', { name: /Esqueci minha senha/ }));
    const janela = await screen.findByRole('dialog', { name: 'Esqueci minha senha' });
    expect(within(janela).getByText(/Peça a um gestor para redefinir sua senha/)).toBeInTheDocument();
    expect(within(janela).queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();
    expect(chamar).not.toHaveBeenCalled();
  });

  it('senha errada mostra mensagem clara', async () => {
    await renderizar({ pessoa: null, rota: '/entrar' });
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('E-mail acadêmico'), CONTAS.bolsista.email);
    await u.type(screen.getByLabelText('Senha'), 'errada');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
  });
});
