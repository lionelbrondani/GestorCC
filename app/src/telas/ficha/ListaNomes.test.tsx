import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ListaNomes, nomesDaLista } from './ListaNomes';

function Controlado({ inicial = '' }: { inicial?: string }) {
  const [v, setV] = useState(inicial);
  return (
    <>
      <ListaNomes rotulo="Equipe" valor={v} aoMudar={setV} />
      <output>{JSON.stringify(v)}</output>
    </>
  );
}

describe('lista de nomes da equipe', () => {
  it('começa com um campo e adiciona nome por nome', () => {
    render(<Controlado />);
    fireEvent.change(screen.getByLabelText('Nome 1'), { target: { value: 'Ana Souza' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar nome/ }));
    fireEvent.change(screen.getByLabelText('Nome 2'), { target: { value: 'Bia Lima' } });
    expect(screen.getByRole('status').textContent).toBe(JSON.stringify('Ana Souza\nBia Lima'));
  });

  it('remove um nome', () => {
    render(<Controlado inicial={'Ana Souza\nBia Lima'} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Souza' }));
    expect(screen.getByLabelText('Nome 1')).toHaveValue('Bia Lima');
    expect(screen.queryByLabelText('Nome 2')).not.toBeInTheDocument();
  });

  it('Enter no último nome abre o próximo campo', () => {
    render(<Controlado inicial="Ana Souza" />);
    fireEvent.keyDown(screen.getByLabelText('Nome 1'), { key: 'Enter' });
    expect(screen.getByLabelText('Nome 2')).toHaveFocus();
  });

  it('nomesDaLista ignora linhas vazias', () => {
    expect(nomesDaLista('Ana\n\n Bia \n')).toEqual(['Ana', 'Bia']);
  });
});
