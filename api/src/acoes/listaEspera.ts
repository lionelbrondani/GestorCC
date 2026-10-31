import { diasOcupados, formatarData, pode, type DataISO } from '@shared';
import { comPermissoes, notificar, type Contexto } from '../nucleo/roteador';

type LinhaSessaoMin = { id: string; eventoId: string; data: DataISO; status: 'ativa' | 'cancelada' };
type LinhaEventoMin = { id: string; status: 'ativo' | 'cancelado' };
type LinhaPedido = { id: string; protocolo: string; status: string; listaEspera?: boolean; dados: { evento: string; dias: { data: DataISO }[] } };

/** Quem gerencia os eventos (edita eventos): recebe os avisos dos pedidos de data. */
export function quemGerenciaEventos(ctx: Contexto): string[] {
  const permissoes = ctx.portas.repo.listar<{ id: string; pessoaId: string; modulo: string; nivel: 'nenhum' | 'ver' | 'editar' }>('permissoes');
  return ctx.portas.repo
    .listar<{ id: string; ativo: boolean }>('pessoas')
    .filter((p) => p.ativo)
    .map((p) => comPermissoes(p as never, permissoes))
    .filter((p) => pode(p.permissoes, 'eventos', 'editar'))
    .map((p) => p.id);
}

/** Depois de cancelar sessões: se um dia ficou livre e há pedido na lista de espera para ele, quem gerencia é avisado. */
export function avisarListaEspera(ctx: Contexto, datas: DataISO[]): void {
  if (!datas.length) return;
  const ordenadas = [...datas].sort();
  const ainda = new Set(diasOcupados(ctx.portas.repo.listar<LinhaSessaoMin>('sessoes'), ctx.portas.repo.listar<LinhaEventoMin>('eventos'), ordenadas[0], ordenadas.at(-1)!));
  const livres = new Set(ordenadas.filter((d) => !ainda.has(d)));
  if (!livres.size) return;
  const gestores = quemGerenciaEventos(ctx);
  for (const p of ctx.portas.repo.listar<LinhaPedido>('pedidos')) {
    if (p.status !== 'novo' || !p.listaEspera) continue;
    const dia = (p.dados?.dias ?? []).map((d) => d.data).sort().find((d) => livres.has(d));
    if (dia) notificar(ctx, gestores, `O dia ${formatarData(dia)} ficou livre: o pedido ${p.protocolo} (${p.dados.evento}) está na lista de espera.`, '/pedidos');
  }
}
