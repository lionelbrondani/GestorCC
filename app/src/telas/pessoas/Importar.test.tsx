import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('Importar pessoas da planilha', () => {
  it('o gestor importa a aba IMPORTAR_PESSOAS e vê o relatório com os problemas por linha', async () => {
    const { api } = await renderizar({ rota: '/pessoas' });
    const original = api.chamar.bind(api);
    const chamar = vi.spyOn(api, 'chamar').mockImplementation(((acao: string, dados: unknown) =>
      acao === 'pessoas.importar'
        ? Promise.resolve({ importadas: 2, atualizadas: 1, problemas: [{ linha: 4, mensagem: 'CPF inválido.' }] })
        : original(acao as never, dados as never)) as typeof api.chamar);
    const u = userEvent.setup();

    await u.click(await screen.findByRole('button', { name: /Importar da planilha/ }));
    const janela = await screen.findByRole('dialog', { name: 'Importar da planilha' });
    expect(within(janela).getByText(/IMPORTAR_PESSOAS/)).toBeInTheDocument();

    await u.click(within(janela).getByRole('button', { name: 'Importar agora' }));
    expect(chamar).toHaveBeenCalledWith('pessoas.importar', null);
    expect(await within(janela).findByText('2 pessoas novas e 1 atualizada.')).toBeInTheDocument();
    expect(within(janela).getByText('Linha 4: CPF inválido.')).toBeInTheDocument();
    expect(within(janela).getByText(/apague as linhas da aba/)).toBeInTheDocument();
  });
});
