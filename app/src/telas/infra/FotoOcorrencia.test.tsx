import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

describe('Foto da ocorrência', () => {
  it('com a API real, a foto vem por infra.foto quando a ocorrência tem foto', async () => {
    const FOTO = 'data:image/png;base64,QUJD';
    await renderizar({
      rota: '/infra/oc1',
      aoCriarApi: (api) => {
        const original = api.chamar.bind(api);
        vi.spyOn(api, 'chamar').mockImplementation((async (acao: string, dados: unknown) => {
          if (acao === 'infra.foto') return FOTO;
          const r = await original(acao as never, dados as never);
          if (acao !== 'infra.listar') return r;
          return (r as { id: string }[]).map((o) => (o.id === 'oc1' ? { ...o, foto: null, temFoto: true } : o));
        }) as typeof api.chamar);
      },
    });
    expect(await screen.findByAltText('Foto enviada no relato')).toHaveAttribute('src', FOTO);
  });
});
