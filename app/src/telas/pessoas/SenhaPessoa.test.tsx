import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Redefinir senha de outra pessoa', () => {
  it('depois de redefinir, o gestor recebe o texto pronto para copiar e enviar', async () => {
    await renderizar({ rota: '/pessoas' });
    const u = userEvent.setup();
    await u.click(await screen.findByText('Amanda Rocha'));
    await u.click(await screen.findByRole('button', { name: 'Redefinir senha para a matrícula' }));
    await u.click(within(await screen.findByRole('dialog', { name: 'Redefinir senha' })).getByRole('button', { name: 'Redefinir' }));

    const janela = await screen.findByRole('dialog', { name: 'Senha redefinida' });
    const texto = within(janela).getByRole('textbox', { name: 'Mensagem para enviar' }) as HTMLTextAreaElement;
    expect(texto.value).toContain('Olá, Amanda! Sua senha do GestorCC voltou a ser a sua matrícula.');
    expect(texto.value).toContain(window.location.origin);
    expect(within(janela).getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
  });
});
