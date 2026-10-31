import { waitFor } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

const FASE5 = 'pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar';

describe('App na fase 5', () => {
  it('almoxarifado, infraestrutura e relatar não chamam contratos', async () => {
    let chamar!: MockInstance;
    const { router } = await renderizar({ rota: '/almox', recursos: FASE5, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
    for (const rota of ['/infra', '/relatar', '/']) {
      await router.navigate(rota);
      await waitFor(() => expect(chamar).toHaveBeenCalled());
    }
    await waitFor(() => expect(chamar.mock.calls.map((c) => c[0])).toContain('infra.listar'));
    expect(chamar.mock.calls.map((c) => c[0])).not.toContain('contratos.listar');
  });
});
