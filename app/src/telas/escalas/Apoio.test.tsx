import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('Escala de apoio', () => {
  it('a montagem aparece só na aba Apoio, com bolsistas fixos e servidores, e é publicada ali mesmo', async () => {
    const { api, router } = await renderizar({ pessoa: 'gestor', rota: '/' });
    const { eventos, sessoes } = await api.chamar('eventos.listar', { de: '2026-12-01', ate: '2026-12-31' });
    const ev = eventos.find((e) => e.id === 'e19')!;
    const doEvento = sessoes.filter((s) => s.eventoId === 'e19');
    await api.chamar('eventos.salvar', { evento: ev, sessoes: [...doEvento, { ...doEvento[0], id: '', atividade: 'montagem', chegada: '09:00', inicio: '09:00', fim: '17:00', vagasBolsistas: 1, vagasServidores: 0 }] });
    await router.navigate('/escalas?aba=apoio&mes=2026-12');
    const chamar = vi.spyOn(api, 'chamar');
    const cartao = (await screen.findByText('Montagem')).closest('section')!;
    expect(within(cartao).getByRole('heading', { name: 'Montagem · Concerto de Natal' })).toBeInTheDocument();
    const select = within(cartao).getByRole('combobox', { name: 'Escalar em Montagem' });
    const opcoes = within(select).getAllByRole('option').slice(1).map((o) => o.textContent ?? '');
    expect(opcoes.length).toBeGreaterThan(0);
    expect(opcoes.every((t) => /\((servidor|bolsista fixo)\)$/.test(t))).toBe(true);
    await userEvent.selectOptions(select, within(select).getAllByRole('option')[1]);
    await userEvent.click(within(cartao).getByRole('button', { name: 'Escalar' }));
    await userEvent.click(within(cartao).getByRole('button', { name: /Publicar/ }));
    expect(await within(cartao).findByText(/Escala publicada/)).toBeInTheDocument();
    await waitFor(() => expect(chamar).toHaveBeenCalledWith('escalas.publicar', { sessaoIds: [expect.any(String)] }));
  });
});
