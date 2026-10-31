import { screen, within } from '@testing-library/react';
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

  it('nome que não está na lista pode ser cadastrado como autorizado na hora', async () => {
    const { api } = await renderizar({ pessoa: 'gestor', rota: '/almox?aba=saida' });
    const { itens } = await api.chamar('almox.listar', null);
    const fita = itens.find((i) => i.nomeComum === 'Fita crepe 48mm')!;
    const u = userEvent.setup();
    await u.selectOptions(await screen.findByLabelText('Item'), fita.cod);
    await u.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
    await u.type(screen.getByLabelText('Quem está retirando'), 'Produtora Nova');
    await u.type(screen.getByLabelText('Finalidade'), 'Montagem');
    await u.click(screen.getByRole('button', { name: 'Registrar retirada' }));
    expect(await screen.findByText(/não está na lista de quem pode retirar/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cadastrar e registrar' }));
    expect(await screen.findByText('Retirada registrada e estoque atualizado.')).toBeInTheDocument();
    expect((await api.chamar('almox.listar', null)).autorizadosExternos).toContain('Produtora Nova');
  });
});

describe('Quem pode retirar', () => {
  it('adiciona e desativa autorizados', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/almox?aba=autorizados' });
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Nome de quem pode retirar'), 'Técnico de Luz');
    await u.click(screen.getByRole('button', { name: /Adicionar/ }));
    expect(await screen.findByText('Técnico de Luz pode retirar material.')).toBeInTheDocument();
    const linha = (await screen.findByText('Técnico de Luz', { selector: 'span' })).closest('tr')!;
    await u.click(within(linha).getByRole('button', { name: 'Desativar' }));
    expect(await screen.findByText('Técnico de Luz desativado.')).toBeInTheDocument();
  });
});
