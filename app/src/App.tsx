import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ApiContexto } from './api/cliente';
import { criarMockCliente } from './api/mock/mockCliente';
import { SessaoProvedor } from './auth/SessaoContexto';
import { FUTURO_ROTEADOR, ROTAS } from './rotas';

export default function App() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [api] = useState(() => criarMockCliente());
  const [router] = useState(() => createBrowserRouter(ROTAS, { future: FUTURO_ROTEADOR }));
  return (
    <QueryClientProvider client={qc}>
      <ApiContexto.Provider value={api}>
        <SessaoProvedor>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </SessaoProvedor>
      </ApiContexto.Provider>
    </QueryClientProvider>
  );
}
