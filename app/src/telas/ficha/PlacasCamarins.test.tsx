import type { FichaTecnica } from '@shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

const FICHA = { dados: { camarinsIndividuais: ['Banda Vento Sul', 'Maestro convidado'], camarinsColetivos: ['Coral'] } } as unknown as FichaTecnica;

async function abrir(ficha: FichaTecnica | null) {
  await renderizar({
    rota: '/agenda/e19/placas',
    aoCriarApi: (api) => {
      const original = api.chamar.bind(api);
      vi.spyOn(api, 'chamar').mockImplementation((async (acao: string, dados: unknown) =>
        acao === 'fichas.obter' ? ficha : original(acao as never, dados as never)) as typeof api.chamar);
    },
  });
  return screen.findByRole('heading', { name: 'Placas dos camarins: Concerto de Natal' });
}

describe('Placas dos camarins', () => {
  it('vêm com os nomes da ficha técnica, em maiúsculas, uma por folha; dá para corrigir, acrescentar e imprimir', async () => {
    await abrir(FICHA);
    const campos = () => screen.getAllByLabelText(/^Nome na placa \d+$/) as HTMLInputElement[];
    expect(campos().map((c) => c.value)).toEqual(['Banda Vento Sul', 'Maestro convidado', 'Coral']);
    expect(screen.getAllByRole('img', { name: /^Placa:/ }).map((p) => p.textContent)).toEqual(['BANDA VENTO SUL', 'MAESTRO CONVIDADO', 'CORAL']);

    const u = userEvent.setup();
    await u.clear(campos()[1]);
    await u.type(campos()[1], 'Diogo Exemplo');
    expect(screen.getByRole('img', { name: 'Placa: Diogo Exemplo' })).toHaveTextContent('DIOGO EXEMPLO');
    await u.click(screen.getByRole('button', { name: 'Adicionar placa' }));
    expect(campos()).toHaveLength(4);
    await u.click(screen.getByRole('button', { name: 'Tirar a placa 3' }));
    expect(campos().map((c) => c.value)).toEqual(['Banda Vento Sul', 'Diogo Exemplo', '']);

    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    await u.click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(imprimir).toHaveBeenCalled();
  });

  it('sem ficha técnica, começa com uma placa em branco', async () => {
    await abrir(null);
    expect((screen.getAllByLabelText(/^Nome na placa \d+$/) as HTMLInputElement[]).map((c) => c.value)).toEqual(['']);
  });
});
