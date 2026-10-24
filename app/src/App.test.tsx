import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('sem sessão abre a tela de login do GestorCC', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'GestorCC' })).toBeInTheDocument();
  });
});
