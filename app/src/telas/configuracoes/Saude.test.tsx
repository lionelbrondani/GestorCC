import { screen, within } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Saúde do sistema', () => {
  it('quem administra vê, em Configurações, como estão backup, rotina, agenda, e-mails e erros', async () => {
    await renderizar({ rota: '/configuracoes' });
    const cartao = (await screen.findByRole('heading', { name: 'Saúde do sistema' })).closest('section')!;
    for (const item of ['Backup diário', 'Rotina de 5 minutos', 'Agenda Google', 'E-mails', 'Erros']) {
      expect(await within(cartao).findByText(item)).toBeInTheDocument();
    }
    expect(within(cartao).getAllByText('ok')).toHaveLength(5);
    expect(within(cartao).getByText(/Linhas nas planilhas: Pessoas \d+/)).toBeInTheDocument();
  });
});
