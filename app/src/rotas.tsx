import type { Modulo } from '@shared';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Exige, LayoutAutenticado } from './auth/RotaProtegida';
import { EstadoVazio } from './componentes';
import { Login } from './telas/login/Login';

function EmConstrucao() {
  return <EstadoVazio titulo="Em construção" texto="Esta tela chega nas próximas etapas do protótipo." />;
}

const comPermissao = (modulos: Modulo[], el: ReactNode, nivel: 'ver' | 'editar' = 'ver') => (
  <Exige modulos={modulos} nivel={nivel}>
    {el}
  </Exige>
);

/** Telas registradas pelas próximas tasks; até lá, "Em construção". */
export const TELAS: Record<string, ReactNode> = {};
const tela = (rota: string) => TELAS[rota] ?? <EmConstrucao />;

export const ROTAS: RouteObject[] = [
  { path: '/entrar', element: <Login /> },
  {
    element: <LayoutAutenticado />,
    children: [
      { path: '/', element: tela('/') },
      { path: '/minhas-escalas', element: tela('/minhas-escalas') },
      { path: '/disponibilidade', element: tela('/disponibilidade') },
      { path: '/ganhos', element: tela('/ganhos') },
      { path: '/avisos', element: tela('/avisos') },
      { path: '/perfil', element: tela('/perfil') },
      { path: '/agenda', element: comPermissao(['eventos'], tela('/agenda')) },
      { path: '/agenda/imprimir', element: comPermissao(['eventos'], tela('/agenda/imprimir')) },
      { path: '/agenda/:eventoId', element: comPermissao(['eventos'], tela('/agenda/:eventoId')) },
      { path: '/escalas', element: comPermissao(['escalas'], tela('/escalas')) },
      { path: '/escalas/imprimir', element: comPermissao(['escalas'], tela('/escalas/imprimir')) },
      { path: '/pagamentos', element: comPermissao(['pagamentos'], tela('/pagamentos')) },
      { path: '/pagamentos/novo', element: comPermissao(['pagamentos'], tela('/pagamentos/novo'), 'editar') },
      { path: '/pagamentos/:loteId', element: comPermissao(['pagamentos'], tela('/pagamentos/:loteId')) },
      { path: '/contratos', element: comPermissao(['contratos'], tela('/contratos')) },
      { path: '/contratos/fundep', element: comPermissao(['contratos'], tela('/contratos/fundep'), 'editar') },
      { path: '/contratos/:id', element: comPermissao(['contratos'], tela('/contratos/:id')) },
      { path: '/almox', element: comPermissao(['almoxEstoque', 'almoxSaidas'], tela('/almox')) },
      { path: '/mural', element: comPermissao(['mural'], tela('/mural'), 'editar') },
      { path: '/pessoas', element: comPermissao(['pessoas'], tela('/pessoas')) },
      { path: '/pessoas/:id', element: comPermissao(['pessoas'], tela('/pessoas/:id')) },
      { path: '/configuracoes', element: comPermissao(['configuracoes'], tela('/configuracoes')) },
      { path: '/formularios', element: comPermissao(['formularios'], tela('/formularios')) },
      { path: '*', element: <EstadoVazio titulo="Página não encontrada" texto="Confira o endereço ou use o menu." /> },
    ],
  },
];

export const FUTURO_ROTEADOR = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;
