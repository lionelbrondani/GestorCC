import { elegiveisParaLote, formatarReais, previaLote } from '@shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Novo lote', () => {
  it('marcar as sessões de um evento atualiza o total e cria o lote', async () => {
    const { api, router } = await renderizar({ pessoa: 'gestor', rota: '/pagamentos/novo' });
    const { eventos, sessoes } = await api.chamar('eventos.listar', { de: '2026-01-01', ate: '2026-12-31' });
    const escalas = await api.chamar('escalas.listar', { de: '2026-01-01', ate: '2026-12-31' });
    const { lotes } = await api.chamar('lotes.listar', null);
    const evento = eventos.find((e) => e.nome === 'A Bela e a Fera in Concert')!;
    const ids = elegiveisParaLote({ eventos, sessoes, escalas, lotes })
      .filter((e) => sessoes.find((s) => s.id === e.sessaoId)?.eventoId === evento.id)
      .map((e) => e.id);
    const esperado = previaLote(ids, { eventos, sessoes, escalas, lotes }, 8000).total;

    await userEvent.click(await screen.findByRole('checkbox', { name: `Selecionar todas as sessões de ${evento.nome}` }));
    expect(screen.getByTestId('total-lote')).toHaveTextContent(formatarReais(esperado));

    await userEvent.click(screen.getByRole('button', { name: 'Criar lote' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/pagamentos\/L-/));
    expect(await screen.findByText('Enviado')).toBeInTheDocument();
  });
});
