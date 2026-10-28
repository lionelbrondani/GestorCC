import type { Modulo } from '@shared';
import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Exige, ExigeRecurso, LayoutAutenticado } from './auth/RotaProtegida';
import { Carregando, EstadoVazio } from './componentes';
import { Busca } from './layout/Busca';
import { Notificacoes } from './layout/Notificacoes';
import { Inicio } from './telas/inicio/InicioGestor';
import { Login } from './telas/login/Login';
import { MinhaDisponibilidade } from './telas/pessoal/MinhaDisponibilidade';
import { MinhasEscalas } from './telas/pessoal/MinhasEscalas';

// Telas carregadas só quando são abertas: o celular baixa menos na primeira visita.
// Início, login e as telas do bolsista ficam no pacote principal, para abrir na hora.
const PedidoDeData = lazy(() => import('./telas/pedido/PedidoDeData').then((m) => ({ default: m.PedidoDeData })));
const Pedidos = lazy(() => import('./telas/pedido/Pedidos').then((m) => ({ default: m.Pedidos })));
const Agenda = lazy(() => import('./telas/agenda/Agenda').then((m) => ({ default: m.Agenda })));
const EventoDetalhe = lazy(() => import('./telas/agenda/EventoDetalhe').then((m) => ({ default: m.EventoDetalhe })));
const ImprimirAgenda = lazy(() => import('./telas/agenda/ImprimirAgenda').then((m) => ({ default: m.ImprimirAgenda })));
const ImprimirEscala = lazy(() => import('./telas/escalas/ImprimirEscala').then((m) => ({ default: m.ImprimirEscala })));
const Escalas = lazy(() => import('./telas/escalas/Escalas').then((m) => ({ default: m.Escalas })));
const CortesiasDestino = lazy(() => import('./telas/cortesias/CortesiasDestino').then((m) => ({ default: m.CortesiasDestino })));
const ImprimirCortesias = lazy(() => import('./telas/cortesias/ImprimirCortesias').then((m) => ({ default: m.ImprimirCortesias })));
const FichaProdutor = lazy(() => import('./telas/ficha/FichaProdutor').then((m) => ({ default: m.FichaProdutor })));
const Fichas = lazy(() => import('./telas/ficha/Fichas').then((m) => ({ default: m.Fichas })));
const ImprimirFicha = lazy(() => import('./telas/ficha/ImprimirFicha').then((m) => ({ default: m.ImprimirFicha })));
const LoteDetalhe = lazy(() => import('./telas/pagamentos/LoteDetalhe').then((m) => ({ default: m.LoteDetalhe })));
const NovoLote = lazy(() => import('./telas/pagamentos/NovoLote').then((m) => ({ default: m.NovoLote })));
const Pagamentos = lazy(() => import('./telas/pagamentos/Pagamentos').then((m) => ({ default: m.Pagamentos })));
const ContratoDetalhe = lazy(() => import('./telas/contratos/ContratoDetalhe').then((m) => ({ default: m.ContratoDetalhe })));
const Contratos = lazy(() => import('./telas/contratos/Contratos').then((m) => ({ default: m.Contratos })));
const SolicitarFundep = lazy(() => import('./telas/contratos/SolicitarFundep').then((m) => ({ default: m.SolicitarFundep })));
const Almox = lazy(() => import('./telas/almox/Almox').then((m) => ({ default: m.Almox })));
const Configuracoes = lazy(() => import('./telas/configuracoes/Configuracoes').then((m) => ({ default: m.Configuracoes })));
const Formularios = lazy(() => import('./telas/formularios/Formularios').then((m) => ({ default: m.Formularios })));
const Manual = lazy(() => import('./telas/manual/Manual').then((m) => ({ default: m.Manual })));
const Mural = lazy(() => import('./telas/mural/Mural').then((m) => ({ default: m.Mural })));
const Orcamento = lazy(() => import('./telas/orcamento/Orcamento').then((m) => ({ default: m.Orcamento })));
const RelatorioMensal = lazy(() => import('./telas/relatorio/RelatorioMensal').then((m) => ({ default: m.RelatorioMensal })));
const PessoaForm = lazy(() => import('./telas/pessoas/PessoaForm').then((m) => ({ default: m.PessoaForm })));
const Pessoas = lazy(() => import('./telas/pessoas/Pessoas').then((m) => ({ default: m.Pessoas })));
const Infra = lazy(() => import('./telas/infra/Infra').then((m) => ({ default: m.Infra })));
const OcorrenciaDetalhe = lazy(() => import('./telas/infra/OcorrenciaDetalhe').then((m) => ({ default: m.OcorrenciaDetalhe })));
const Relatar = lazy(() => import('./telas/infra/Relatar').then((m) => ({ default: m.Relatar })));
const Avisos = lazy(() => import('./telas/pessoal/Avisos').then((m) => ({ default: m.Avisos })));
const MeusGanhos = lazy(() => import('./telas/pessoal/MeusGanhos').then((m) => ({ default: m.MeusGanhos })));
const Perfil = lazy(() => import('./telas/pessoal/Perfil').then((m) => ({ default: m.Perfil })));

const comPermissao = (modulos: Modulo[], el: ReactNode, nivel: 'ver' | 'editar' = 'ver') => (
  <Exige modulos={modulos} nivel={nivel}>
    {el}
  </Exige>
);

export const ROTAS: RouteObject[] = [
  { path: '/entrar', element: <Login /> },
  // link da ficha técnica: o produtor entra sem login
  { path: '/ficha/:token', element: <Suspense fallback={<Carregando />}><FichaProdutor /></Suspense> },
  // link das cortesias: o destino lança os nomes sem login
  { path: '/cortesias/:token', element: <Suspense fallback={<Carregando />}><CortesiasDestino /></Suspense> },
  // pedido de data: qualquer pessoa pede, sem login
  { path: '/pedido-de-data', element: <Suspense fallback={<Carregando />}><PedidoDeData /></Suspense> },
  {
    element: <LayoutAutenticado busca={<Busca />} notificacoes={<Notificacoes />} />,
    children: [
      { path: '/', element: <Inicio /> },
      { path: '/minhas-escalas', element: <ExigeRecurso recurso="escalasPessoais"><MinhasEscalas /></ExigeRecurso> },
      { path: '/disponibilidade', element: <ExigeRecurso recurso="escalasPessoais"><MinhaDisponibilidade /></ExigeRecurso> },
      { path: '/ganhos', element: <ExigeRecurso recurso="pagamentos"><MeusGanhos /></ExigeRecurso> },
      { path: '/avisos', element: <Avisos /> },
      { path: '/perfil', element: <Perfil /> },
      { path: '/manual', element: <Manual /> },
      { path: '/relatar', element: <ExigeRecurso recurso="relatar"><Relatar /></ExigeRecurso> },
      { path: '/infra', element: comPermissao(['infraestrutura'], <Infra />) },
      { path: '/infra/:id', element: comPermissao(['infraestrutura'], <OcorrenciaDetalhe />) },
      { path: '/agenda', element: comPermissao(['eventos'], <Agenda />) },
      { path: '/agenda/imprimir', element: comPermissao(['eventos'], <ImprimirAgenda />) },
      { path: '/agenda/:eventoId', element: comPermissao(['eventos'], <EventoDetalhe />) },
      { path: '/fichas', element: comPermissao(['eventos'], <Fichas />, 'editar') },
      { path: '/pedidos', element: comPermissao(['eventos'], <Pedidos />, 'editar') },
      { path: '/agenda/:eventoId/cortesias', element: comPermissao(['eventos'], <ImprimirCortesias />, 'editar') },
      { path: '/agenda/:eventoId/ficha', element: comPermissao(['eventos'], <ImprimirFicha />, 'editar') },
      { path: '/escalas', element: comPermissao(['escalas'], <Escalas />) },
      { path: '/escalas/imprimir', element: comPermissao(['escalas'], <ImprimirEscala />) },
      { path: '/pagamentos', element: comPermissao(['pagamentos'], <Pagamentos />) },
      { path: '/relatorio-mensal', element: comPermissao(['escalas'], <RelatorioMensal />, 'editar') },
      { path: '/orcamento', element: comPermissao(['pagamentos'], <Orcamento />, 'editar') },
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
