import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../teste/renderizar';

describe('Sobre o GestorCC', () => {
  beforeEach(() => localStorage.clear());

  it('abre sozinho no primeiro acesso, com o e-mail para sugestões e erros, e não abre de novo', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/' });
    const janela = await screen.findByRole('dialog', { name: 'Sobre o GestorCC' });
    expect(within(janela).getByText(/desenvolvido por/)).toHaveTextContent('desenvolvido por Lionel Brondani, bolsista do Centro de Convenções da UFSM');
    expect(within(janela).getByRole('link', { name: 'lionel.brondani@acad.ufsm.br' })).toHaveAttribute('href', expect.stringContaining('mailto:lionel.brondani@acad.ufsm.br'));
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
  it('tem o link do repositório no GitHub', async () => {
    localStorage.clear();
    await renderizar({ pessoa: 'gestor', rota: '/' });
    const janela = await screen.findByRole('dialog', { name: 'Sobre o GestorCC' });
    expect(within(janela).getByRole('link', { name: 'github.com/lionelbrondani/GestorCC' })).toHaveAttribute('href', 'https://github.com/lionelbrondani/GestorCC');
  });
});
