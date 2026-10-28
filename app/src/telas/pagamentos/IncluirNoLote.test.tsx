import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

const quantas = (texto: string | null) => Number(texto?.match(/\d+/)?.[0] ?? 0);

describe('Incluir sessões num lote já criado', () => {
  it('lista só as sessões que ainda podem ser pagas e inclui as escolhidas', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/pagamentos/L2' });
    const antes = quantas((await screen.findByRole('tab', { name: /Sessões/ })).textContent);
    await userEvent.click(screen.getByRole('button', { name: 'Incluir sessões' }));
    const janela = await screen.findByRole('dialog', { name: 'Incluir sessões no lote' });
    const incluir = within(janela).getByRole('button', { name: /^Incluir/ });
    expect(incluir).toBeDisabled();
    await userEvent.click(within(janela).getAllByRole('checkbox')[0]);
    await userEvent.click(within(janela).getByRole('button', { name: 'Incluir 1 sessão' }));
    await waitFor(() => expect(quantas(screen.getByRole('tab', { name: /Sessões/ }).textContent)).toBeGreaterThan(antes));
    expect(screen.queryByRole('dialog', { name: 'Incluir sessões no lote' })).not.toBeInTheDocument();
  });
});
