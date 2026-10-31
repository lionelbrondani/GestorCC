import { screen } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Meus ganhos', () => {
  it('quem não tem escalas vê R$ 0,00 e nenhum NaN', async () => {
    const { container } = await renderizar({ pessoa: 'gestor', rota: '/ganhos' });
    expect(await screen.findByText('≈ R$ 0,00')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });

  it('bolsista vê previsto e histórico', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/ganhos' });
    expect(await screen.findByText('Previsto')).toBeInTheDocument();
    expect(screen.getByText('Pagamentos externos')).toBeInTheDocument();
  });
});
