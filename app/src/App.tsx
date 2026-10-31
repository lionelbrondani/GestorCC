import { ErroApi } from '@shared';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { MODO_PROTOTIPO, URL_API } from './ambiente';
import { ApiContexto, type ApiCliente } from './api/cliente';
import { criarHttpCliente } from './api/http/httpCliente';
import { criarMockCliente } from './api/mock/mockCliente';
import { EVENTO_SESSAO_EXPIRADA, SessaoProvedor } from './auth/SessaoContexto';
import { FUTURO_ROTEADOR, ROTAS } from './rotas';
import { definirHoje } from './util/hoje';

function avisarSessaoExpirada(erro: unknown) {
  if (erro instanceof ErroApi && erro.codigo === 'SESSAO') window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
}

function criarApi(): ApiCliente {
  if (MODO_PROTOTIPO) return criarMockCliente();
  // Com a API real, "hoje" é a data de verdade (no protótipo fica fixa para casar com os dados de exemplo).
  const agora = new Date();
  definirHoje(`${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`);
  return criarHttpCliente(URL_API);
}

export default function App() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
        queryCache: new QueryCache({ onError: avisarSessaoExpirada }),
        mutationCache: new MutationCache({ onError: avisarSessaoExpirada }),
      }),
  );
  const [api] = useState(criarApi);
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
