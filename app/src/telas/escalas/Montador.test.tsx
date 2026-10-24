import { candidatos } from '@shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
