import { screen } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Relatório mensal', () => {
  it('mostra o panorama do setor: números, ocupação, equipe em totais e contratos', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/relatorio-mensal?mes=2026-11' });
    expect(await screen.findByText('RELATÓRIO MENSAL · NOVEMBRO/2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agenda e ocupação do espaço' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equipe e escalas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contratos dos eventos do mês' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'O que cada pessoa tem direito' })).not.toBeInTheDocument();
  });
});
