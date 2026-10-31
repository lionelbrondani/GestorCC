import { fireEvent, screen, within } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('score dos bolsistas', () => {
  it('a gestão vê o score, do maior para o menor, com o que pesa nele; as trocas pedidas descem o score', async () => {
    await renderizar({ rota: '/escalas?aba=score' });
    const tabela = await screen.findByRole('table');
    for (const titulo of ['Bolsista', 'Score', 'Escalas feitas', 'Faltas', 'Trocas pedidas', 'Disponibilidade', 'Avaliação']) {
      expect(within(tabela).getByRole('columnheader', { name: titulo })).toBeInTheDocument();
    }
    const scores = within(tabela).getAllByRole('row').slice(1).map((r) => Number(within(r).getAllByRole('cell')[1].textContent));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const debora = within(tabela).getByText('Débora Lenz').closest('tr')!;
    expect(within(debora).getAllByRole('cell')[4]).toHaveTextContent('2');
  });

  it('quem não é da gestão não vê a aba Score', async () => {
    await renderizar({ pessoa: 'operacao', rota: '/escalas' });
    await screen.findByRole('tab', { name: 'Montar' });
    expect(screen.queryByRole('tab', { name: 'Score' })).not.toBeInTheDocument();
  });

  it('ao montar a escala, cada bolsista disponível mostra o score', async () => {
    await renderizar({ rota: '/escalas?aba=montar&mes=2026-12' });
    const escalar = await screen.findAllByRole('button', { name: /^Escalar / });
    expect(escalar[0]).toHaveTextContent(/score \d+/);
  });

  it('a troca vai como pedida por quem sai, a não ser que a gestão desmarque', async () => {
    let chamar!: MockInstance;
    await renderizar({ rota: '/escalas?aba=publicadas&mes=2026-10', aoCriarApi: (api) => void (chamar = vi.spyOn(api, 'chamar')) });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Trocar' }))[0]);
    const janela = await screen.findByRole('dialog', { name: 'Trocar pessoas na escala' });
    const sai = within(janela).getByLabelText('Quem sai') as HTMLSelectElement;
    fireEvent.change(sai, { target: { value: sai.options[1].value } });
    expect(within(janela).getByRole('checkbox', { name: 'A troca foi pedida por quem sai (desce o score)' })).toBeChecked();
    fireEvent.change(within(janela).getByLabelText('Justificativa (obrigatória)'), { target: { value: 'Prova na universidade' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Confirmar troca' }));
    await vi.waitFor(() => expect(chamar).toHaveBeenCalledWith('escalas.trocar', expect.objectContaining({ aPedido: true, justificativa: 'Prova na universidade' })));
  });
});
