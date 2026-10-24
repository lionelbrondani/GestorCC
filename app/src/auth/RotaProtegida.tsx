import { pode, type Modulo } from '@shared';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { EstadoVazio } from '../componentes';
import { Shell } from '../layout/Shell';
import { AvisoSenha } from './AvisoSenha';
import { useSessao } from './SessaoContexto';

export function SemAcesso() {
  return (
    <EstadoVazio
      titulo="Você não tem acesso a esta área"
      texto="Se você precisa desta função, peça a um gestor para liberar o acesso no seu cadastro."
    />
  );
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
  const permitido = modulos.some((m) => pode(sessao.pessoa.permissoes, m, nivel));
  return permitido ? <>{children}</> : <SemAcesso />;
}

export function LayoutAutenticado({ busca, notificacoes }: { busca?: ReactNode; notificacoes?: ReactNode }) {
  const { sessao, sair } = useSessao();
  const local = useLocation();
  if (!sessao) {
    const voltar = encodeURIComponent(local.pathname + local.search);
    return <Navigate to={`/entrar?voltar=${voltar}`} replace />;
  }
  return (
    <Shell pessoa={sessao.pessoa} aoSair={sair} busca={busca} notificacoes={notificacoes} faixa={<AvisoSenha />}>
      <Outlet />
    </Shell>
  );
}
