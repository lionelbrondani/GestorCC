import { screen, waitFor } from '@testing-library/react';
import { renderizar } from '../teste/renderizar';

describe('Rotas protegidas', () => {
  it('bolsista não acessa pagamentos', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/pagamentos' });
    expect(await screen.findByText('Você não tem acesso a esta área')).toBeInTheDocument();
  });

  it('sem sessão vai para o login guardando a rota', async () => {
    const { router } = await renderizar({ pessoa: null, rota: '/escalas' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(router.state.location.search).toBe('?voltar=%2Fescalas');
  });
});
