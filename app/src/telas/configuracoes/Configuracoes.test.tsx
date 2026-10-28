import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('Configurações da busca', () => {
  it('as informações do setor, que vão com as perguntas ao Gemini, são editadas e salvas, com o aviso de não pôr dados pessoais', async () => {
    let chamar!: MockInstance;
    await renderizar({ rota: '/configuracoes', aoCriarApi: (api) => void (chamar = vi.spyOn(api, 'chamar')) });
    const campo = await screen.findByRole('textbox', { name: 'Informações do setor' });
    expect(campo).toHaveValue('Teatro com 1.170 lugares (plateia baixa, alta e mezanino). Fica na Avenida Roraima, 1000, Camobi, Santa Maria.');
    expect(screen.getByText(/não escreva dados pessoais/i)).toBeInTheDocument();
    const u = userEvent.setup();
    await u.clear(campo);
    await u.type(campo, 'Bilheteria abre 1 hora antes.');
    await u.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(chamar).toHaveBeenCalledWith('config.salvar', expect.objectContaining({ informacoesSetor: 'Bilheteria abre 1 hora antes.' }));
  });
});
