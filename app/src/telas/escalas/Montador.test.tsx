import { candidatos } from '@shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('Montador (foco na sessão)', () => {
  it('auto-preencher mostra o progresso da sessão', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/escalas?aba=montar&mes=2026-12' });
    const sessaoId = 'e19s1';
    const { sessoes } = await api.chamar('eventos.listar', { de: '2026-12-01', ate: '2026-12-31' });
    const pessoas = await api.chamar('pessoas.listar', null);
    const disponibilidades = await api.chamar('disponibilidades.listar', { sessaoIds: sessoes.map((s) => s.id) });
    const escalas = await api.chamar('escalas.listar', { de: '2026-12-01', ate: '2026-12-31' });
    const alvo = sessoes.find((s) => s.id === sessaoId)!;
    const esperado = Math.min(alvo.vagasBolsistas, candidatos(alvo, { pessoas, sessoes, escalas, disponibilidades }).length);

    await userEvent.selectOptions(await screen.findByLabelText('Sessão'), sessaoId);
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent(`0 / ${alvo.vagasBolsistas}`);
    await userEvent.click(screen.getByRole('button', { name: 'Auto-preencher sessão' }));
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent(`${esperado} / ${alvo.vagasBolsistas}`);
    expect(within(screen.getByTestId('lista-bolsistas')).getAllByRole('listitem')).toHaveLength(esperado);
  });

  it('publicar avisa só pelo app, sem opção de e-mail', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/escalas?aba=montar&mes=2026-12' });
    const chamar = vi.spyOn(api, 'chamar');
    const u = userEvent.setup();
    await u.selectOptions(await screen.findByLabelText('Sessão'), 'e19s1');
    await u.click(screen.getByRole('button', { name: 'Auto-preencher sessão' }));
    await u.click(screen.getByRole('button', { name: 'Publicar…' }));

    const janela = await screen.findByRole('dialog', { name: 'Publicar escala' });
    expect(within(janela).queryByText(/e-mail/i)).not.toBeInTheDocument();
    await u.click(within(janela).getByRole('button', { name: /^Publicar \d+ sessão/ }));
    await waitFor(() => expect(chamar).toHaveBeenCalledWith('escalas.publicar', { sessaoIds: expect.any(Array) }));
  });
});
