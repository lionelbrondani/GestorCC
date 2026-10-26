import { candidatos } from '@shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('Montador (evento a evento)', () => {
  it('auto-preencher mostra o progresso do evento', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/escalas?aba=montar&mes=2026-12' });
    const sessaoId = 'e19s1';
    const { sessoes } = await api.chamar('eventos.listar', { de: '2026-12-01', ate: '2026-12-31' });
    const pessoas = await api.chamar('pessoas.listar', null);
    const disponibilidades = await api.chamar('disponibilidades.listar', { sessaoIds: sessoes.map((s) => s.id) });
    const escalas = await api.chamar('escalas.listar', { de: '2026-12-01', ate: '2026-12-31' });
    const alvo = sessoes.find((s) => s.id === sessaoId)!;
    const esperado = Math.min(alvo.vagasBolsistas, candidatos(alvo, { pessoas, sessoes, escalas, disponibilidades }).length);

    await userEvent.click(await screen.findByRole('button', { name: /^12\/12 · Concerto de Natal/ }));
    expect(await screen.findByRole('heading', { name: 'Concerto de Natal' })).toBeInTheDocument();
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent(`0 / ${alvo.vagasBolsistas}`);
    expect(screen.getAllByLabelText('Vaga de bolsista livre')).toHaveLength(alvo.vagasBolsistas);
    await userEvent.click(screen.getByRole('button', { name: /Auto-preencher este evento/ }));
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent(`${esperado} / ${alvo.vagasBolsistas}`);
    expect(within(screen.getByTestId('lista-bolsistas')).getAllByRole('listitem')).toHaveLength(esperado);
  });

  it('tocar no bloco escala, tocar na vaga tira; "Escalar próximo evento" salva e avança', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/escalas?aba=montar&mes=2026-12' });
    const chamar = vi.spyOn(api, 'chamar');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /^12\/12 · Concerto de Natal/ }));
    const [primeiro] = screen.getAllByRole('button', { name: /^Escalar [^(]+$/ });
    const nome = primeiro.getAttribute('aria-label')!.replace('Escalar ', '');
    await u.click(primeiro);
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent(/^1 \//);
    await u.click(screen.getByRole('button', { name: `Tirar ${nome} da vaga` }));
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent(/^0 \//);
    await u.click(screen.getAllByRole('button', { name: /^Escalar [^(]+$/ })[0]);

    await u.click(screen.getByRole('button', { name: /Escalar próximo evento/ }));
    await waitFor(() => expect(chamar).toHaveBeenCalledWith('escalas.salvarRascunho', expect.objectContaining({ sessaoId: 'e19s1' })));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Concerto de Natal' })).not.toBeInTheDocument());
  });

  it('publicar avisa só pelo app, sem opção de e-mail', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/escalas?aba=montar&mes=2026-12' });
    const chamar = vi.spyOn(api, 'chamar');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /^12\/12 · Concerto de Natal/ }));
    await u.click(screen.getByRole('button', { name: /Auto-preencher este evento/ }));
    await u.click(screen.getByRole('button', { name: 'Publicar…' }));

    const janela = await screen.findByRole('dialog', { name: 'Publicar escala' });
    expect(within(janela).queryByText(/e-mail/i)).not.toBeInTheDocument();
    await u.click(within(janela).getByRole('button', { name: /^Publicar \d+ sessão/ }));
    await waitFor(() => expect(chamar).toHaveBeenCalledWith('escalas.publicar', { sessaoIds: expect.any(Array) }));
  });
});
