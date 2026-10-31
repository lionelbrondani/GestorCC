import { screen, within } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('O que precisa de você', () => {
  it('o Início do gestor abre com as pendências, cada uma com o link e o prazo', async () => {
    await renderizar({ rota: '/' });
    const titulo = await screen.findByRole('heading', { name: /^O que precisa de você \(\d+\)$/ });
    const cartao = titulo.closest('section')!;
    expect(within(cartao).getByRole('link', { name: /sessões realizadas aguardando lote de pagamento/ })).toHaveAttribute('href', '/pagamentos/novo');
    expect(within(cartao).getAllByText(/^(há \d+ dias?|hoje|amanhã|em \d+ dias)$/).length).toBeGreaterThan(0);
    // fica no alto da página, antes de "Hoje"
    const hoje = screen.getByRole('heading', { name: 'Hoje' });
    expect(titulo.compareDocumentPosition(hoje) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
