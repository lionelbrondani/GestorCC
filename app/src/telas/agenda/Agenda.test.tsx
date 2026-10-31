import { screen } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Agenda', () => {
  it('os dias bloqueados para pedidos de data aparecem no calendário do mês, com o motivo', async () => {
    await renderizar({ rota: '/agenda', hoje: '2026-12-01' });
    const marcas = await screen.findAllByText('Bloqueado: Recesso de fim de ano');
    // 24 a 31/12 e 1º e 2/1, que a grade de dezembro também mostra
    expect(marcas).toHaveLength(10);
  });
});
