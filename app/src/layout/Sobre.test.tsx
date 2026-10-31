import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../teste/renderizar';

describe('Sobre o GestorCC', () => {
  beforeEach(() => localStorage.clear());

  it('abre sozinho no primeiro acesso, com o e-mail para sugestões e erros, e não abre de novo', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/' });
    const janela = await screen.findByRole('dialog', { name: 'Sobre o GestorCC' });
    expect(within(janela).getByText(/é um sistema de código aberto/)).toBeInTheDocument();
    expect(within(janela).getByRole('link', { name: 'contato@exemplo.org' })).toHaveAttribute('href', expect.stringContaining('mailto:contato@exemplo.org'));
    await userEvent.click(within(janela).getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog', { name: 'Sobre o GestorCC' })).not.toBeInTheDocument();
    expect(localStorage.getItem('gestorcc-sobre-visto-v1')).toBe('1');
  });

  it('a tela de login tem o link para o Sobre', async () => {
    await renderizar({ pessoa: null, rota: '/entrar' });
    await userEvent.click(await screen.findByRole('button', { name: 'Sobre o GestorCC' }));
    expect(await screen.findByRole('dialog', { name: 'Sobre o GestorCC' })).toBeInTheDocument();
  });
});

describe('Sobre: código aberto', () => {
  it('sem repositório nos dados do setor, não mostra o link', async () => {
    localStorage.clear();
    await renderizar({ pessoa: 'gestor', rota: '/' });
    const janela = await screen.findByRole('dialog', { name: 'Sobre o GestorCC' });
    expect(within(janela).getByText(/código é aberto/)).toBeInTheDocument();
    expect(within(janela).queryByRole('link', { name: /github/ })).not.toBeInTheDocument();
  });
});
