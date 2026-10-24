import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Modelos de impressão', () => {
  it('escala: o modelo atualizado tem um bloco por sessão publicada e o resumo por pessoa', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/escalas/imprimir?mes=2026-10&modelo=atualizado' });
    const { sessoes } = await api.chamar('eventos.listar', { de: '2026-10-01', ate: '2026-10-31' });
    const publicadas = sessoes.filter((s) => s.publicadaEm && s.status === 'ativa');
    expect(await screen.findByText('ESCALA DO CENTRO DE CONVENÇÕES')).toBeInTheDocument();
    expect(screen.getAllByTestId('bloco-sessao')).toHaveLength(publicadas.length);
    expect(screen.getByRole('heading', { name: 'Escalas por pessoa' })).toBeInTheDocument();
  });

  it('escala: trocar para o modelo legado mostra a grade tradicional', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/escalas/imprimir?mes=2026-10&modelo=atualizado' });
    await userEvent.click(await screen.findByRole('tab', { name: 'Legado' }));
    expect(await screen.findAllByText('TABELA DE ESCALA DOS BOLSISTAS')).not.toHaveLength(0);
  });

  it('agenda: o modelo atualizado lista só os dias com evento, por semana, e mostra feriados', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/agenda/imprimir?mes=2026-11&modelo=atualizado' });
    expect(await screen.findByText('AGENDA DO CENTRO DE CONVENÇÕES')).toBeInTheDocument();
    const semanas = screen.getAllByTestId('semana');
    expect(semanas.length).toBeGreaterThan(0);
    expect(screen.queryByText('Domingo, 01')).not.toBeInTheDocument();
    const dia18 = screen.getByTestId('dia-2026-11-18');
    expect(within(dia18).getByText('No Movimento dos Anos 2000')).toBeInTheDocument();
    expect(dia18).toHaveTextContent('a definir');
    expect(screen.getByText(/Finados/)).toBeInTheDocument();
  });
});
