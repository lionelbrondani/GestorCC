import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Minha disponibilidade', () => {
  it('marcar "Sim" salva e confirma na tela', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/disponibilidade' });
    const sessoes = await screen.findAllByRole('group', { name: /Disponibilidade para/ });
    await userEvent.click(within(sessoes[0]).getByRole('button', { name: 'Sim' }));
    expect(await within(sessoes[0]).findByText('Salvo')).toBeInTheDocument();
    expect(within(sessoes[0]).getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('depois do prazo fica somente leitura', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/disponibilidade', hoje: '2026-11-26' });
    expect(await screen.findByText(/Prazo encerrado/)).toBeInTheDocument();
    for (const b of screen.getAllByRole('button', { name: 'Sim' })) expect(b).toBeDisabled();
  });
});
