import { pode, type Modulo } from '@shared';
import { Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Carregando, EstadoVazio } from '../componentes';
import { recursoAtivo, type Recurso } from '../recursos';
import { Shell } from '../layout/Shell';
import { AvisoSenha } from './AvisoSenha';
import { useSessao } from './SessaoContexto';
import { ModalSobre, useSobrePrimeiroAcesso } from '../layout/Sobre';

export function SemAcesso() {
  return (
    <EstadoVazio
      titulo="Você não tem acesso a esta área"
      texto="Se você precisa desta função, peça a um gestor para liberar o acesso no seu cadastro."
    />
  );
}

export function EmBreve() {
  return <EstadoVazio titulo="Esta área chega numa próxima etapa." texto="Ela já existe no protótipo e será ligada aos dados reais em breve." />;
}

/** Área pessoal que depende de um módulo ainda não ligado (ex.: minhas escalas). */
export function ExigeRecurso({ recurso, children }: { recurso: Recurso; children: ReactNode }) {
  return recursoAtivo(recurso) ? <>{children}</> : <EmBreve />;
}

/** Exige que a pessoa tenha ao menos um dos módulos no nível pedido. */
export function Exige({
  modulos,
  nivel = 'ver',
  children,
}: {
  modulos: Modulo[];
  nivel?: 'ver' | 'editar';
  children: ReactNode;
}) {
  const { sessao } = useSessao();
  if (!sessao) return null;
  if (!modulos.some((m) => recursoAtivo(m))) return <EmBreve />;
  const permitido = modulos.some((m) => pode(sessao.pessoa.permissoes, m, nivel));
  return permitido ? <>{children}</> : <SemAcesso />;
}

export function LayoutAutenticado({ busca, notificacoes }: { busca?: ReactNode; notificacoes?: ReactNode }) {
  const { sessao, sair } = useSessao();
  const local = useLocation();
  const [sobre, abrirSobre, fecharSobre] = useSobrePrimeiroAcesso();
  if (!sessao) {
    const voltar = encodeURIComponent(local.pathname + local.search);
    return <Navigate to={`/entrar?voltar=${voltar}`} replace />;
  }
  return (
    <Shell pessoa={sessao.pessoa} aoSair={sair} busca={busca} notificacoes={notificacoes} faixa={<AvisoSenha />} aoAbrirSobre={abrirSobre}>
      <Suspense fallback={<Carregando />}>
        <Outlet />
      </Suspense>
      <ModalSobre aberto={sobre} aoFechar={fecharSobre} />
    </Shell>
  );
}
