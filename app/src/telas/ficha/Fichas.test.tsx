import { fireEvent, screen, within } from '@testing-library/react';
import { criarMockCliente } from '../../api/mock/mockCliente';
import { CONTAS, renderizar } from '../../teste/renderizar';

async function gerarLinks(...eventoIds: string[]) {
  const api = criarMockCliente({ latenciaMs: 0, persistir: false });
  api.definirToken((await api.chamar('auth.entrar', CONTAS.gestor)).token);
  for (const eventoId of eventoIds) await api.chamar('fichas.link', { eventoId, novo: false });
  return api;
}

describe('menu Fichas técnicas', () => {
  it('lista as fichas com a situação, o resumo e os atalhos', async () => {
    await gerarLinks('e19', 'e20');
    await renderizar({ rota: '/fichas' });
    const linha = (await screen.findByRole('link', { name: 'Concerto de Natal' })).closest('tr')!;
    expect(within(linha).getByText('Ainda não enviada')).toBeInTheDocument();
    expect(within(linha).getByText(/12\/12\/2026/)).toBeInTheDocument();
    expect(within(linha).getByRole('button', { name: /Copiar link/ })).toBeInTheDocument();
    expect(within(linha).getByRole('link', { name: /Imprimir/ })).toHaveAttribute('href', '/agenda/e19/ficha');
    expect(screen.getByRole('link', { name: 'Espetáculo de Dança de Fim de Ano' })).toBeInTheDocument();
  });

  it('separa enviadas e aguardando', async () => {
    await gerarLinks('e19');
    await renderizar({ rota: '/fichas' });
    await screen.findByRole('link', { name: 'Concerto de Natal' });
    fireEvent.click(screen.getByRole('tab', { name: /Enviadas/ }));
    expect(screen.queryByRole('link', { name: 'Concerto de Natal' })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma ficha aqui.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Aguardando/ }));
    expect(screen.getByRole('link', { name: 'Concerto de Natal' })).toBeInTheDocument();
  });
});
