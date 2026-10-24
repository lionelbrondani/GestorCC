import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Redefinir senha (link do e-mail)', () => {
  it('confere a confirmação e, com o link válido, troca a senha', async () => {
    await renderizar({ pessoa: null, rota: '/redefinir?token=exemplo' });
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Nova senha'), 'novaSenha123');
    await u.type(screen.getByLabelText('Confirme a nova senha'), 'outraCoisa1');
    await u.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByText('A confirmação não confere com a nova senha.')).toBeInTheDocument();

    await u.clear(screen.getByLabelText('Confirme a nova senha'));
    await u.type(screen.getByLabelText('Confirme a nova senha'), 'novaSenha123');
    await u.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByText(/Senha alterada\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });

  it('link vencido mostra a mensagem e o caminho para pedir outro', async () => {
    await renderizar({ pessoa: null, rota: '/redefinir?token=vencido' });
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Nova senha'), 'novaSenha123');
    await u.type(screen.getByLabelText('Confirme a nova senha'), 'novaSenha123');
    await u.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByText('Este link expirou ou já foi usado. Peça um novo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute('href', '/entrar');
  });
});
