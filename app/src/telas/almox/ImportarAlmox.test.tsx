import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('Importar almoxarifado', () => {
  it('o gestor importa o catálogo antigo e vê o relatório com os problemas por linha', async () => {
    const { api } = await renderizar({ rota: '/almox' });
    const original = api.chamar.bind(api);
    const chamar = vi.spyOn(api, 'chamar').mockImplementation(((acao: string, dados: unknown) =>
      acao === 'almox.importar'
        ? Promise.resolve({ itens: 120, autorizados: 3, problemas: [{ linha: 7, mensagem: 'Código em branco.' }] })
        : original(acao as never, dados as never)) as typeof api.chamar);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Importar da planilha/ }));
    const janela = await screen.findByRole('dialog', { name: 'Importar da planilha' });
    expect(within(janela).getByText(/IMPORTAR_ALMOX/)).toBeInTheDocument();
    await u.click(within(janela).getByRole('button', { name: 'Importar agora' }));
    expect(chamar).toHaveBeenCalledWith('almox.importar', null);
    expect(await within(janela).findByText('120 itens e 3 autorizados externos importados.')).toBeInTheDocument();
    expect(within(janela).getByText('Linha 7: Código em branco.')).toBeInTheDocument();
  });
});
