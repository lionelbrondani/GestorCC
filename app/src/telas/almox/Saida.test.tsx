import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Saída do almoxarifado', () => {
  it('quantidade acima do saldo mostra o erro e bloqueia o registro', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/almox?aba=saida' });
    const { itens } = await api.chamar('almox.listar', null);
    const fita = itens.find((i) => i.nomeComum === 'Fita crepe 48mm')!;
    const u = userEvent.setup();

    await u.selectOptions(await screen.findByLabelText('Item'), fita.cod);
    const qtd = screen.getByLabelText('Quantidade');
    await u.clear(qtd);
    await u.type(qtd, String(fita.saldo + 2));
    await u.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));

    expect(await screen.findByText(`Saldo insuficiente (disponível: ${fita.saldo})`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar retirada' })).toBeDisabled();
  });
});
