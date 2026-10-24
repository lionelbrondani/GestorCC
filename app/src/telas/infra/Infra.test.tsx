import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Infraestrutura', () => {
  it('bolsista relata um problema pelo app e acompanha em "Meus relatos"', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/relatar' });
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('O que aconteceu?'), 'Lâmpada queimada no camarim 3');
    await u.selectOptions(screen.getByLabelText('Onde?'), 'Camarins');
    await u.selectOptions(screen.getByLabelText('Tipo de problema'), 'Iluminação');
    await u.click(screen.getByRole('button', { name: 'Enviar relato' }));
    expect(await screen.findByText(/Relato enviado/)).toBeInTheDocument();
    const meus = screen.getByRole('region', { name: 'Meus relatos' });
    expect(await within(meus).findByText('Lâmpada queimada no camarim 3')).toBeInTheDocument();
    expect(within(meus).getAllByText('Nova').length).toBeGreaterThan(0);
  });

  it('gestor importa respostas do formulário', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/infra' });
    await userEvent.click(await screen.findByRole('button', { name: 'Importar respostas do formulário' }));
    expect(await screen.findByText('2 nova(s) ocorrência(s) importada(s) do formulário.')).toBeInTheDocument();
  });

  it('abrir chamado exige o número do chamado da UFSM', async () => {
    const { api, router } = await renderizar({ pessoa: 'gestor', rota: '/perfil' });
    const alvo = (await api.chamar('infra.listar', null)).find((o) => o.status === 'analise')!;
    await router.navigate(`/infra/${alvo.id}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Chamado aberto' }));
    await u.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Informe o número do chamado aberto no sistema da UFSM.')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Nº do chamado na UFSM'), '2026/09999');
    await u.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.getByTestId('status-ocorrencia')).toHaveTextContent('Chamado aberto'));
    expect(screen.getByText('2026/09999')).toBeInTheDocument();
  });
});
