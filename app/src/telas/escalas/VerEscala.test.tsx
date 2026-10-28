import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Ver escala', () => {
  it('mostra os eventos do mês com a equipe e troca para a visão por pessoa', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/escalas?aba=ver&mes=2026-11' });
    const escalas = (await api.chamar('escalas.listar', { de: '2026-11-01', ate: '2026-11-30' })).filter((e) => e.status !== 'cancelado');
    const pessoas = await api.chamar('pessoas.listar', null);
    const alguem = pessoas.find((p) => p.id === escalas[0].pessoaId)!;
    expect((await screen.findAllByText(alguem.nomeCurto, { exact: false })).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Por pessoa' }));
    expect(within(screen.getByRole('table')).getByText(alguem.nome)).toBeInTheDocument();
  });
});
