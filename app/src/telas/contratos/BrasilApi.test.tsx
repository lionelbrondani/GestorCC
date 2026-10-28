import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

/** A BrasilAPI de mentira: o resto do sistema (protótipo) não usa fetch. */
const brasilApi = (corpo: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(corpo), { status: 200 })));

afterEach(() => vi.unstubAllGlobals());

describe('dados públicos da BrasilAPI', () => {
  it('no novo contratante, o CNPJ preenche razão social, endereço, CEP e e-mail, e avisa a situação na Receita', async () => {
    brasilApi({
      razao_social: 'PRODUTORA TESTE LTDA', descricao_tipo_de_logradouro: 'RUA', logradouro: 'DO TESTE', numero: '10', bairro: 'CENTRO',
      municipio: 'SANTA MARIA', uf: 'RS', cep: '97010000', email: 'CONTATO@PRODUTORA.TESTE', descricao_situacao_cadastral: 'BAIXADA',
    });
    await renderizar({ rota: '/contratos/novo' });
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar novo contratante' }));
    const janela = await screen.findByRole('dialog', { name: 'Novo contratante' });
    const documento = within(janela).getByLabelText('CNPJ ou CPF');
    fireEvent.change(documento, { target: { value: '11.222.333/0001-81' } });
    fireEvent.blur(documento);
    expect(await within(janela).findByDisplayValue('PRODUTORA TESTE LTDA')).toBeInTheDocument();
    expect(within(janela).getByLabelText('Endereço completo')).toHaveValue('RUA DO TESTE, 10 - CENTRO, SANTA MARIA/RS');
    expect(within(janela).getByLabelText('CEP')).toHaveValue('97010-000');
    expect(within(janela).getByLabelText('E-mail')).toHaveValue('contato@produtora.teste');
    expect(within(janela).getByText(/situação BAIXADA/)).toBeInTheDocument();
  });

  it('em Configurações, importa os feriados nacionais do ano para conferir e salvar', async () => {
    brasilApi([{ date: '2026-08-29', name: 'Feriado nacional de teste' }]);
    await renderizar({ rota: '/configuracoes' });
    fireEvent.click(await screen.findByRole('button', { name: /Importar feriados nacionais/ }));
    expect(await screen.findByDisplayValue('Feriado nacional de teste')).toBeInTheDocument();
    expect(screen.getByText(/1 feriado nacional incluído/)).toBeInTheDocument();
  });
});
