import { render, screen } from '@testing-library/react';
import { Etiqueta } from './Etiqueta';

describe('Etiqueta', () => {
  it('mostra o texto com o tom pedido', () => {
    render(<Etiqueta tom="erro">Vencida</Etiqueta>);
    const el = screen.getByText('Vencida');
    expect(el).toBeInTheDocument();
    expect(el.dataset.tom).toBe('erro');
  });
});
