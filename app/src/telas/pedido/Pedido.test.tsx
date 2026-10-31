import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { renderizar } from '../../teste/renderizar';

// a BrasilAPI (CNPJ e CEP) fica fora do ar nos testes: a página continua funcionando à mão
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const preencher = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

async function irParaDezembro() {
  fireEvent.click(await screen.findByRole('button', { name: 'Próximo mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
  expect(screen.getByRole('heading', { name: 'Dezembro de 2026' })).toBeInTheDocument();
}

function preencherOResto() {
  preencher('Nome do evento', 'Recital de Piano Teste');
  preencher('Categoria do evento', 'Concerto');
  preencher('Início do dia 1', '19:00');
  preencher('Fim do dia 1', '21:00');
  preencher('Programação do evento', 'Obras de Chopin.');
  preencher('Indicação etária', 'Livre');
  preencher('Pessoas envolvidas', '5');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Palco' }));
  preencher('Público estimado', '300');
  preencher('CNPJ (ou CPF)', '11.222.333/0001-81');
  preencher('Nome jurídico', 'Produtora Teste Ltda');
  preencher('Endereço completo', 'Rua do Teste, 1 - Centro, Cidade Exemplo/RS');
  preencher('CEP', '01001-000');
  preencher('Inscrição estadual', 'Isento');
  preencher('Inscrição municipal', 'Isento');
  preencher('Nome do responsável', 'Pessoa Teste');
  preencher('CPF do responsável', '529.982.247-25');
  preencher('E-mail', 'pessoa@exemplo.com');
  preencher('Telefone/WhatsApp', '(00) 99999-0000');
}

describe('pedido de data pela página pública', () => {
  it('sem preencher, aponta os campos; com o dia escolhido no calendário, envia e explica que ainda não é reserva', async () => {
    await renderizar({ pessoa: null, rota: '/pedido-de-data' });
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar pedido' }));
    expect(await screen.findByText('Informe o nome do evento.')).toBeInTheDocument();
    expect(screen.getByText('Informe pelo menos um dia.')).toBeInTheDocument();

    await irParaDezembro();
    fireEvent.click(await screen.findByRole('button', { name: '20/12/2026, livre' }));
    expect(screen.getByRole('button', { name: '20/12/2026, livre, escolhido' })).toBeInTheDocument();
    preencherOResto();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));

    expect(await screen.findByText(/Pedido recebido/)).toBeInTheDocument();
    const protocolo = screen.getByText(/PD-2026-\d{4}/).textContent!;
    expect(screen.getByText(/O pedido ainda não garante a reserva da data/)).toBeInTheDocument();
    const email = screen.getByRole('link', { name: 'Escrever o e-mail' });
    expect(email.getAttribute('href')).toMatch(/^mailto:contato@exemplo.org\?subject=/);
    expect(decodeURIComponent(email.getAttribute('href')!)).toContain(protocolo);
    expect(localStorage.getItem('gestorcc-pedido-rascunho')).toBeNull();
  });

  it('dia ocupado oferece a lista de espera; dia bloqueado pode ser pedido, com aviso', async () => {
    await renderizar({ pessoa: null, rota: '/pedido-de-data' });
    await irParaDezembro();
    fireEvent.click(await screen.findByRole('button', { name: '12/12/2026, ocupado' }));
    expect(screen.getByText('12/12/2026 já tem evento marcado. Quer entrar na lista de espera para este dia?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na lista de espera' }));
    const dia = screen.getByRole('group', { name: /12\/12\/2026/ });
    expect(within(dia).getByText('Lista de espera')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '24/12/2026, bloqueado' }));
    expect(within(screen.getByRole('group', { name: /24\/12\/2026/ })).getByText(
      'Esta data está bloqueada. Você pode pedir mesmo assim, mas o pedido pode não ser aceito.',
    )).toBeInTheDocument();
  });

  it('avisa quando o público estimado passa da lotação do teatro', async () => {
    await renderizar({ pessoa: null, rota: '/pedido-de-data' });
    await screen.findByLabelText('Público estimado');
    preencher('Público estimado', '1500');
    expect(await screen.findByText('A lotação máxima do teatro é de 1.000 lugares.')).toBeInTheDocument();
    preencher('Público estimado', '900');
    expect(screen.queryByText(/lotação máxima/)).not.toBeInTheDocument();
  });

  it('o que foi preenchido fica guardado no aparelho e volta se a página fechar; Limpar formulário apaga', async () => {
    const primeira = await renderizar({ pessoa: null, rota: '/pedido-de-data' });
    await screen.findByLabelText('Nome do evento');
    preencher('Nome do evento', 'Festival Guardado');
    primeira.unmount();
    await renderizar({ pessoa: null, rota: '/pedido-de-data' });
    expect(await screen.findByDisplayValue('Festival Guardado')).toBeInTheDocument();
    expect(screen.getByText(/Recuperamos o que você tinha preenchido/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar formulário' }));
    expect(screen.getByLabelText('Nome do evento')).toHaveValue('');
    expect(localStorage.getItem('gestorcc-pedido-rascunho')).toBeNull();
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

  it('a lista de espera fica numa aba própria', async () => {
    await renderizar({ rota: '/pedidos' });
    const aba = await screen.findByRole('tab', { name: 'Lista de espera (1)' });
    expect(screen.queryByText('Sarau de Poesia Exemplo')).not.toBeInTheDocument();
    fireEvent.click(aba);
    expect(await screen.findByText('Sarau de Poesia Exemplo')).toBeInTheDocument();
  });

  it('no Calendário, quem gerencia bloqueia e desbloqueia datas', async () => {
    await renderizar({ rota: '/pedidos' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('tab', { name: 'Calendário' }));
    expect(await screen.findByText('24/12/2026 a 03/01/2027')).toBeInTheDocument();
    expect(screen.getByText('Recesso de fim de ano')).toBeInTheDocument();
    preencher('De', '2026-11-10');
    preencher('Até', '2026-11-12');
    await u.type(screen.getByLabelText('Motivo (só a gestão vê)'), 'Manutenção do palco');
    await u.click(screen.getByRole('button', { name: 'Bloquear datas' }));
    const item = (await screen.findByText('10/11/2026 a 12/11/2026')).closest('li')!;
    expect(within(item).getByText('Manutenção do palco')).toBeInTheDocument();
    await u.click(within(item).getByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(screen.queryByText('10/11/2026 a 12/11/2026')).not.toBeInTheDocument());
  });
});
