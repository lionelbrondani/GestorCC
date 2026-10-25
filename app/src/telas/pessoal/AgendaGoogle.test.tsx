import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Google Agenda', () => {
  it('bolsista ativa os convites no Perfil e o aviso some de Minhas escalas', async () => {
    const { router } = await renderizar({ pessoa: 'bolsista', rota: '/minhas-escalas' });
    expect(await screen.findByText(/Receba suas escalas no seu Google Agenda/)).toBeInTheDocument();

    await router.navigate('/perfil');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('checkbox', { name: 'Receber minhas escalas no Google Agenda' }));
    await u.click(screen.getByRole('button', { name: 'Salvar preferência' }));
    expect(await screen.findByText(/Convites ativados/)).toBeInTheDocument();

    await router.navigate('/minhas-escalas');
    expect(await screen.findByText('Minhas escalas')).toBeInTheDocument();
    expect(screen.queryByText(/Receba suas escalas no seu Google Agenda/)).not.toBeInTheDocument();
  });

  it('agenda do setor desconectada orienta a rodar instalar', async () => {
    await renderizar({
      pessoa: 'gestor',
      rota: '/configuracoes',
      aoCriarApi: (api) => {
        const original = api.chamar.bind(api);
        vi.spyOn(api, 'chamar').mockImplementation((async (acao: string, dados: unknown) => {
          const r = await original(acao as never, dados as never);
          return acao === 'config.obter' ? { ...(r as object), agendaSetor: { nome: 'Centro de Convenções UFSM', conta: '', link: '', conectada: false } } : r;
        }) as typeof api.chamar);
      },
    });
    expect(await screen.findByText(/A agenda do setor ainda não foi criada/)).toBeInTheDocument();
    expect(screen.getByText('Desconectada')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Google Agenda/ })).not.toBeInTheDocument();
  });

  it('a agenda do setor aparece conectada na Agenda', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/agenda' });
    expect(await screen.findByText('Google Agenda do setor')).toBeInTheDocument();
    expect(screen.getByText('Sincronizada')).toBeInTheDocument();
  });
});
