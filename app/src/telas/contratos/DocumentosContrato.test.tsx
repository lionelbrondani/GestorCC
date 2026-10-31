import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

function espiar(respostas: Record<string, unknown>) {
  let chamar!: MockInstance;
  const aoCriarApi = (api: { chamar: (...a: never[]) => Promise<unknown> }) => {
    const original = api.chamar.bind(api);
    chamar = vi.spyOn(api, 'chamar').mockImplementation((async (acao: string, dados: unknown) =>
      acao in respostas ? respostas[acao] : original(acao as never, dados as never)) as never);
  };
  return { aoCriarApi, chamadas: () => chamar };
}

describe('Documentos e anexos do contrato', () => {
  it('gerar contrato mostra o link do Google Docs e o .docx para baixar', async () => {
    const e = espiar({ 'documentos.gerar': { url: 'https://docs.google.com/document/d/abc/edit', docx: 'data:application/octet-stream;base64,UEs=' } });
    await renderizar({ rota: '/contratos/c1', aoCriarApi: e.aoCriarApi as never });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Gerar contrato/ }));
    const janela = await screen.findByRole('dialog', { name: 'Gerar contrato' });
    expect(e.chamadas()).toHaveBeenCalledWith('documentos.gerar', { contratoId: 'c1', tipo: 'contrato' });
    expect(await within(janela).findByRole('link', { name: /Abrir no Google Docs/ })).toHaveAttribute('href', 'https://docs.google.com/document/d/abc/edit');
    expect(within(janela).getByRole('link', { name: /Baixar .docx/ })).toHaveAttribute('download');
  });

  it('modelo ausente aparece como mensagem clara', async () => {
    await renderizar({ rota: '/contratos/c1' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Formulário do piano/ }));
    const janela = await screen.findByRole('dialog', { name: 'Formulário do piano' });
    expect(await within(janela).findByText(/Google Docs/)).toBeInTheDocument();
  });

  it('enviar o PDF assinado chama contratos.anexar com o arquivo', async () => {
    const e = espiar({});
    await renderizar({ rota: '/contratos/c1', aoCriarApi: e.aoCriarApi as never });
    const u = userEvent.setup();
    const campo = await screen.findByLabelText('Enviar contrato assinado (PDF)');
    await u.upload(campo, new File(['%PDF-1.4'], 'assinado.pdf', { type: 'application/pdf' }));
    await vi.waitFor(() =>
      expect(e.chamadas()).toHaveBeenCalledWith('contratos.anexar', expect.objectContaining({ contratoId: 'c1', tipo: 'assinado', arquivo: expect.stringMatching(/^data:application\/pdf/) })),
    );
  });
});
