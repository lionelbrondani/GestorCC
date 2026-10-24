import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ApiContexto } from '../api/cliente';
import { criarMockCliente } from '../api/mock/mockCliente';
import { SessaoProvedor, type SessaoInicial } from '../auth/SessaoContexto';
import { FUTURO_ROTEADOR, ROTAS } from '../rotas';
import { definirHoje } from '../util/hoje';

export const CONTAS = {
  gestor: { email: 'gestor@ufsm.br', senha: '1000000001' },
  operacao: { email: 'operacao@acad.ufsm.br', senha: '2026000002' },
  bolsista: { email: 'bolsista@acad.ufsm.br', senha: '2026000001' },
} as const;

export async function renderizar(opcoes: { pessoa?: keyof typeof CONTAS | null; rota?: string; hoje?: string } = {}) {
  definirHoje(opcoes.hoje ?? '2026-10-24');
  const api = criarMockCliente({ latenciaMs: 0, persistir: false, hoje: opcoes.hoje });
  let inicial: SessaoInicial | null = null;
  const conta = opcoes.pessoa === undefined ? 'gestor' : opcoes.pessoa;
  if (conta) {
    const r = await api.chamar('auth.entrar', CONTAS[conta]);
    inicial = { token: r.token, pessoa: r.pessoa, senhaInicial: false };
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(ROTAS, { initialEntries: [opcoes.rota ?? '/'], future: FUTURO_ROTEADOR });
  const resultado = render(
    <QueryClientProvider client={qc}>
      <ApiContexto.Provider value={api}>
        <SessaoProvedor inicial={inicial} persistir={false}>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </SessaoProvedor>
      </ApiContexto.Provider>
    </QueryClientProvider>,
  );
  return { ...resultado, router, api };
}
