import { screen, waitFor } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

const FASE4 = 'pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos';
const DESLIGADAS = ['almox.listar', 'contratos.listar', 'infra.listar'];
const desligadas = (chamar: MockInstance) => chamar.mock.calls.map((c) => c[0] as string).filter((a) => DESLIGADAS.includes(a));

describe('App na fase 4', () => {
  it('bolsista vê Ganhos', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/', recursos: FASE4 });
    await screen.findByText(/Olá, /);
    expect(screen.queryAllByRole('link').map((l) => l.getAttribute('href'))).toContain('/ganhos');
  });

  it('gestor abre pagamentos e novo lote sem chamar áreas desligadas', async () => {
    let chamar!: MockInstance;
    const { router } = await renderizar({ rota: '/pagamentos', recursos: FASE4, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
    await router.navigate('/pagamentos/novo');
    await waitFor(() => expect(chamar.mock.calls.map((c) => c[0])).toContain('lotes.listar'));
    expect(desligadas(chamar)).toEqual([]);
  });
});
