import { screen } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Relatório mensal', () => {
  it('mostra os números do mês, o direito de cada pessoa e a agenda', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/relatorio-mensal?mes=2026-11' });
    expect(await screen.findByText('RELATÓRIO MENSAL · NOVEMBRO/2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O que cada pessoa tem direito' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Agenda do mês \(\d+\)/ })).toBeInTheDocument();
    expect(screen.getByText('em diárias (UFSM)')).toBeInTheDocument();
  });
});
