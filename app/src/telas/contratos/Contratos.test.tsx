import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Contratos', () => {
  it('"Só com pendências" esconde contrato em dia e mantém o que tem ECAD pendente a 3 dias do evento', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/contratos', hoje: '2026-10-28' });
    expect(await screen.findByText('17/2026')).toBeInTheDocument();
    expect(screen.getByText('21/2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Só com pendências' }));
    expect(screen.queryByText('17/2026')).not.toBeInTheDocument();
    expect(screen.getByText('21/2026')).toBeInTheDocument();
  });
});
