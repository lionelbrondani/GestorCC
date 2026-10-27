import { screen, within } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Imprimir agenda do mês', () => {
  it('lista todos os dias de novembro com feriados e horários a definir', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/agenda/imprimir?mes=2026-11&modelo=legado' });
    expect(await screen.findByRole('heading', { name: 'NOVEMBRO/2026' })).toBeInTheDocument();
    const tabela = screen.getByRole('table');
    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(30);
    const dia02 = linhas.find((l) => l.textContent?.includes('Segunda-feira, 02'))!;
    expect(dia02).toHaveTextContent('FERIADO');
    const dia18 = linhas.find((l) => l.textContent?.includes('Quarta-feira, 18'))!;
    expect(dia18).toHaveTextContent('No Movimento dos Anos 2000');
    expect(dia18).toHaveTextContent('a definir');
    expect(dia18).toHaveClass('com-evento');
    expect(dia02).not.toHaveClass('com-evento');
  });
});
