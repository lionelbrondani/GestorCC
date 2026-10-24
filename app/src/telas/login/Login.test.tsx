import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('senha errada mostra mensagem clara', async () => {
    await renderizar({ pessoa: null, rota: '/entrar' });
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('E-mail acadêmico'), CONTAS.bolsista.email);
    await u.type(screen.getByLabelText('Senha'), 'errada');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
  });
});
