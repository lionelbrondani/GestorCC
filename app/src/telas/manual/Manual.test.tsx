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

  it('mostra prints reais das telas, e todos os arquivos existem em public/manual', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/manual' });
    expect(await screen.findByRole('img', { name: 'Montar · evento a evento' })).toHaveAttribute('src', '/manual/escalas-montar.jpg');
    expect(screen.getByRole('img', { name: 'O que o produtor vê, no celular' })).toHaveAttribute('src', '/manual/ficha-produtor.jpg');
    const existentes = Object.keys(import.meta.glob('../../../public/manual/*.jpg')).map((c) => c.replace('../../../public', ''));
    const usados = screen.getAllByRole('img').map((i) => i.getAttribute('src')).filter((s) => s?.startsWith('/manual/'));
    expect(usados.length).toBeGreaterThan(15);
    for (const src of usados) expect(existentes).toContain(src);
  });

  it('bolsista vê só a parte dele', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/manual' });
    expect(await screen.findByRole('heading', { name: /Marcar disponibilidade/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Contratos/ })).not.toBeInTheDocument();
  });
});
