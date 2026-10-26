import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapaPoltronas } from './MapaPoltronas';

describe('mapa das poltronas', () => {
  it('mostra a Plateia Baixa com todas as poltronas e troca de setor pelas abas', () => {
    render(<MapaPoltronas grupos={[{ nome: 'A', lugares: [] }]} aoMudar={() => {}} />);
    expect(screen.getAllByRole('button', { pressed: false }).length).toBe(336);
    fireEvent.click(screen.getByRole('tab', { name: 'Mezanino' }));
    expect(screen.getAllByRole('button', { pressed: false }).length).toBe(352);
  });

  it('tocar na poltrona marca no grupo ativo', () => {
    const aoMudar = vi.fn();
    render(<MapaPoltronas grupos={[{ nome: 'A', lugares: [] }, { nome: 'B', lugares: [] }]} ativo={1} aoMudar={aoMudar} />);
    const filaC = screen.getByRole('group', { name: 'Fila C' });
    fireEvent.click(within(filaC).getByRole('button', { name: 'C01, Convencional' }));
    expect(aoMudar).toHaveBeenCalledWith([{ nome: 'A', lugares: [] }, { nome: 'B', lugares: ['baixa:C01'] }]);
  });

  it('tocar na letra marca a fila inteira; Shift+clique marca o trecho', () => {
    const aoMudar = vi.fn();
    render(<MapaPoltronas grupos={[{ nome: 'A', lugares: [] }]} aoMudar={aoMudar} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fila K inteira (Plateia Baixa)' })[0]);
    expect(aoMudar.mock.calls[0][0][0].lugares).toHaveLength(18);
    const filaA = screen.getByRole('group', { name: 'Fila A' });
    fireEvent.click(within(filaA).getByRole('button', { name: 'A01, Convencional' }));
    fireEvent.click(within(filaA).getByRole('button', { name: 'A05, Convencional' }), { shiftKey: true });
    expect(aoMudar.mock.calls[2][0][0].lugares).toEqual(['baixa:A01', 'baixa:A03', 'baixa:A05']);
  });

  it('o número de marcadas aparece na aba do setor; sem aoMudar é só para ver', () => {
    render(<MapaPoltronas grupos={[{ nome: 'A', lugares: ['mezanino:A23', 'mezanino:A25'] }]} />);
    expect(screen.getByRole('tab', { name: 'Mezanino (2)' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { pressed: false })).toEqual([]);
  });
});
