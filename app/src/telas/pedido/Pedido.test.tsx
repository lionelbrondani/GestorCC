import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

// a BrasilAPI (CNPJ e CEP) fica fora do ar nos testes: a página continua funcionando à mão
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 }))));
afterEach(() => vi.unstubAllGlobals());

const preencher = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe('pedido de data pela página pública', () => {
  it('sem preencher, aponta os campos; preenchido, envia e mostra o protocolo', async () => {
    await renderizar({ pessoa: null, rota: '/pedido-de-data' });
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText('Informe o nome do evento.')).toBeInTheDocument();

    preencher('Nome do evento', 'Recital de Piano Teste');
    preencher('Categoria do evento', 'Concerto');
    preencher('Data do dia 1', '2026-12-20');
    preencher('Início do dia 1', '19:00');
    preencher('Fim do dia 1', '21:00');
    preencher('Programação do evento', 'Obras de Chopin.');
    preencher('Indicação etária', 'Livre');
    preencher('Pessoas envolvidas', '5');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Palco' }));
    preencher('Público estimado', '300');
    preencher('CNPJ (ou CPF)', '11.222.333/0001-81');
    preencher('Nome jurídico', 'Produtora Teste Ltda');
    preencher('Endereço completo', 'Rua do Teste, 1 - Centro, Santa Maria/RS');
    preencher('CEP', '97010-000');
    preencher('Inscrição estadual', 'Isento');
    preencher('Inscrição municipal', 'Isento');
    preencher('Nome do responsável', 'Pessoa Teste');
    preencher('CPF do responsável', '529.982.247-25');
    preencher('E-mail', 'pessoa@exemplo.com');
    preencher('Telefone/WhatsApp', '(55) 99999-0000');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));

    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument();
    expect(screen.getByText(/PD-2026-\d{4}/)).toBeInTheDocument();
  });

  it('a página explica para que servem os dados e quando são apagados', async () => {
    await renderizar({ pessoa: null, rota: '/pedido-de-data' });
    expect(await screen.findByText(/servem só para analisar este pedido/)).toBeInTheDocument();
  });
});

describe('pedidos de data na gestão', () => {
  it('mostra o conflito com a agenda e, aprovado, vira evento', async () => {
    const { router } = await renderizar({ rota: '/pedidos' });
    const linha = (await screen.findByText('Mostra de Dança Exemplo')).closest('tr')!;
    expect(within(linha).getByText(/conflito/)).toBeInTheDocument();
    fireEvent.click(within(linha).getByText('Mostra de Dança Exemplo'));
    const janela = await screen.findByRole('dialog', { name: /Pedido PD-2026-0001/ });
    expect(within(janela).getByText(/Concerto de Natal/)).toBeInTheDocument();
    fireEvent.click(within(janela).getByRole('button', { name: 'Aprovar e criar evento' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/agenda\/e-/));
  });
});
