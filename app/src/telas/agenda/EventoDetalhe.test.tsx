import { screen } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

const FASE2 = 'pessoas,dadosPessoais,mural,formularios,configuracoes,eventos';

describe('Detalhe do evento', () => {
  it('detalhe do evento na fase 2 esconde a escala e não consulta escalas.listar', async () => {
    let chamar!: MockInstance;
    await renderizar({ rota: '/agenda/e19', recursos: FASE2, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
    expect(await screen.findByText(/^Sessões \(/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Montar escala/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Escala', { selector: 'th' })).not.toBeInTheDocument();
    expect(chamar.mock.calls.map((c) => c[0])).not.toContain('escalas.listar');
  });

  it('com as escalas ligadas, mostra a ocupação e o atalho para montar', async () => {
    await renderizar({ rota: '/agenda/e19' });
    expect(await screen.findByRole('link', { name: /Montar escala/ })).toBeInTheDocument();
    expect(screen.getByText('Escala', { selector: 'th' })).toBeInTheDocument();
  });
});
