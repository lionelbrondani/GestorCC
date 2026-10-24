import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('mostra o nome do sistema', () => {
    render(<App />);
    expect(screen.getByText('GestorCC')).toBeInTheDocument();
  });
});
