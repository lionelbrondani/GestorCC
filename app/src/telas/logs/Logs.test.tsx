import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Logs do sistema', () => {
  it('quem administra vê o que foi feito, por quem e quando, e filtra por pessoa e por palavras', async () => {
    await renderizar({ rota: '/logs' });
    const tabela = await screen.findByRole('table');
    const linha = within(tabela).getByText('publicou a escala de Bastidores em Cena (24/10)').closest('tr')!;
    expect(within(linha).getByText('Regina Fagundes')).toBeInTheDocument();
    expect(within(linha).getByText('Escalas')).toBeInTheDocument();
    expect(within(linha).getByText('24/10/2026 às 09:12')).toBeInTheDocument();
    expect(within(tabela).getByText('Motivo: prova na universidade')).toBeInTheDocument();

    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Pessoa'), 'p05');
    await waitFor(() => expect(screen.queryByText('publicou a escala de Bastidores em Cena (24/10)')).not.toBeInTheDocument());
    expect(screen.getByText('confirmou a presença: O Sino da Catedral (23/10)')).toBeInTheDocument();

    await u.selectOptions(screen.getByLabelText('Pessoa'), '');
    await u.type(screen.getByLabelText('Procurar'), 'lote');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(screen.getByText('criou o lote Lote 2026-10 #2')).toBeInTheDocument();
  });

  it('o menu mostra os logs só para quem administra', async () => {
    await renderizar({ rota: '/' });
    expect(await screen.findByRole('link', { name: /Logs do sistema/ })).toBeInTheDocument();
  });
});
