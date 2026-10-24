import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Minha disponibilidade (calendário)', () => {
  it('mostra a rodada como calendário do mês', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/disponibilidade' });
    expect(await screen.findByRole('grid', { name: 'Calendário de DEZEMBRO/2026' })).toBeInTheDocument();
  });

  it('tocar na sessão dentro do dia marca "Sim" e salva', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/disponibilidade' });
    const chip = await screen.findByRole('button', { name: /Formatura CCSH – Tarde: sem resposta/ });
    await userEvent.click(chip);
    expect(await screen.findByRole('button', { name: /Formatura CCSH – Tarde: disponível/ })).toBeInTheDocument();
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
  });

  it('o painel do dia tem Sim/Não grandes para o celular', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/disponibilidade' });
    await userEvent.click(await screen.findByRole('button', { name: /^Dia 12/ }));
    const grupo = await screen.findByRole('group', { name: /Disponibilidade para Concerto de Natal/ });
    await userEvent.click(within(grupo).getByRole('button', { name: 'Não' }));
    expect(within(grupo).getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('depois do prazo fica somente leitura', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/disponibilidade', hoje: '2026-11-26' });
    expect(await screen.findByText(/Prazo encerrado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Formatura CCSH – Tarde:/ })).toBeDisabled();
    for (const b of screen.getAllByRole('button', { name: 'Sim' })) expect(b).toBeDisabled();
  });
});
