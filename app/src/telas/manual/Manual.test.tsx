import { screen } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Manual do GestorCC', () => {
  it('gestor vê todas as seções, com sumário e botão de imprimir', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/manual' });
    expect(await screen.findByRole('heading', { name: /Escalas: rodada, montar e publicar/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sumário' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir \/ salvar em PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Ficha técnica/ })).toBeInTheDocument();
  });

  it('bolsista vê só a parte dele', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/manual' });
    expect(await screen.findByRole('heading', { name: /Marcar disponibilidade/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Contratos/ })).not.toBeInTheDocument();
  });
});
