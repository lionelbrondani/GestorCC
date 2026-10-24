import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Google Agenda', () => {
  it('bolsista ativa os convites no Perfil e o aviso some de Minhas escalas', async () => {
    const { router } = await renderizar({ pessoa: 'bolsista', rota: '/minhas-escalas' });
    expect(await screen.findByText(/Receba suas escalas no seu Google Agenda/)).toBeInTheDocument();

    await router.navigate('/perfil');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('checkbox', { name: 'Receber minhas escalas no Google Agenda' }));
    await u.click(screen.getByRole('button', { name: 'Salvar preferência' }));
    expect(await screen.findByText(/Convites ativados/)).toBeInTheDocument();

    await router.navigate('/minhas-escalas');
    expect(await screen.findByText('Minhas escalas')).toBeInTheDocument();
    expect(screen.queryByText(/Receba suas escalas no seu Google Agenda/)).not.toBeInTheDocument();
  });

  it('a agenda do setor aparece conectada na Agenda', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/agenda' });
    expect(await screen.findByText('Google Agenda do setor')).toBeInTheDocument();
    expect(screen.getByText('Sincronizada')).toBeInTheDocument();
  });
});
