import type { Modulo } from '@shared';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Exige, LayoutAutenticado } from './auth/RotaProtegida';
import { EstadoVazio } from './componentes';
import { Notificacoes } from './layout/Notificacoes';
import { Agenda } from './telas/agenda/Agenda';
import { EventoDetalhe } from './telas/agenda/EventoDetalhe';
import { ImprimirAgenda } from './telas/agenda/ImprimirAgenda';
import { ImprimirEscala } from './telas/escalas/ImprimirEscala';
import { Escalas } from './telas/escalas/Escalas';
import { LoteDetalhe } from './telas/pagamentos/LoteDetalhe';
import { NovoLote } from './telas/pagamentos/NovoLote';
import { Pagamentos } from './telas/pagamentos/Pagamentos';
import { ContratoDetalhe } from './telas/contratos/ContratoDetalhe';
import { Contratos } from './telas/contratos/Contratos';
import { SolicitarFundep } from './telas/contratos/SolicitarFundep';
import { Almox } from './telas/almox/Almox';
import { Configuracoes } from './telas/configuracoes/Configuracoes';
import { Formularios } from './telas/formularios/Formularios';
import { Mural } from './telas/mural/Mural';
import { PessoaForm } from './telas/pessoas/PessoaForm';
import { Pessoas } from './telas/pessoas/Pessoas';
import { Inicio } from './telas/inicio/InicioGestor';
import { Login } from './telas/login/Login';
import { Avisos } from './telas/pessoal/Avisos';
import { MeusGanhos } from './telas/pessoal/MeusGanhos';
import { MinhaDisponibilidade } from './telas/pessoal/MinhaDisponibilidade';
import { MinhasEscalas } from './telas/pessoal/MinhasEscalas';
import { Perfil } from './telas/pessoal/Perfil';

const comPermissao = (modulos: Modulo[], el: ReactNode, nivel: 'ver' | 'editar' = 'ver') => (
  <Exige modulos={modulos} nivel={nivel}>
    {el}
  </Exige>
);

export const ROTAS: RouteObject[] = [
  { path: '/entrar', element: <Login /> },
  {
    element: <LayoutAutenticado notificacoes={<Notificacoes />} />,
    children: [
      { path: '/', element: <Inicio /> },
      { path: '/minhas-escalas', element: <MinhasEscalas /> },
      { path: '/disponibilidade', element: <MinhaDisponibilidade /> },
      { path: '/ganhos', element: <MeusGanhos /> },
      { path: '/avisos', element: <Avisos /> },
      { path: '/perfil', element: <Perfil /> },
      { path: '/agenda', element: comPermissao(['eventos'], <Agenda />) },
      { path: '/agenda/imprimir', element: comPermissao(['eventos'], <ImprimirAgenda />) },
      { path: '/agenda/:eventoId', element: comPermissao(['eventos'], <EventoDetalhe />) },
      { path: '/escalas', element: comPermissao(['escalas'], <Escalas />) },
      { path: '/escalas/imprimir', element: comPermissao(['escalas'], <ImprimirEscala />) },
      { path: '/pagamentos', element: comPermissao(['pagamentos'], <Pagamentos />) },
      { path: '/pagamentos/novo', element: comPermissao(['pagamentos'], <NovoLote />, 'editar') },
      { path: '/pagamentos/:loteId', element: comPermissao(['pagamentos'], <LoteDetalhe />) },
      { path: '/contratos', element: comPermissao(['contratos'], <Contratos />) },
      { path: '/contratos/fundep', element: comPermissao(['contratos'], <SolicitarFundep />, 'editar') },
      { path: '/contratos/:id', element: comPermissao(['contratos'], <ContratoDetalhe />) },
      { path: '/almox', element: comPermissao(['almoxEstoque', 'almoxSaidas'], <Almox />) },
      { path: '/mural', element: comPermissao(['mural'], <Mural />, 'editar') },
      { path: '/pessoas', element: comPermissao(['pessoas'], <Pessoas />) },
      { path: '/pessoas/:id', element: comPermissao(['pessoas'], <PessoaForm />) },
      { path: '/configuracoes', element: comPermissao(['configuracoes'], <Configuracoes />) },
      { path: '/formularios', element: comPermissao(['formularios'], <Formularios />) },
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
