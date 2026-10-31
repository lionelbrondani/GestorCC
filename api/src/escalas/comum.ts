import { ErroApi, temConflito, type ContextoEscala, type Disponibilidade, type Escala, type Evento, type Sessao, type StatusEscala } from '@shared';
import { linhasSessoes, paraSessao } from '../acoes/eventos';
import { comPermissoes, type Contexto } from '../nucleo/roteador';

export interface LinhaEscala {
  id: string;
  sessaoId: string;
  pessoaId: string;
  papel: 'bolsista' | 'servidor';
  status: StatusEscala;
  adicaoDireta: boolean;
  loteId: string;
}

export interface LinhaDisponibilidade extends Disponibilidade {
  id: string;
  respondidoEm: string;
}

type LinhaPessoa = Parameters<typeof comPermissoes>[0];

export const linhasEscalas = (ctx: Contexto) => ctx.portas.repo.listar<LinhaEscala>('escalas');
export const linhasDisponibilidades = (ctx: Contexto) => ctx.portas.repo.listar<LinhaDisponibilidade>('disponibilidades');
export const linhasPessoas = (ctx: Contexto) => ctx.portas.repo.listar<LinhaPessoa & { id: string }>('pessoas');

export function paraEscala(l: LinhaEscala): Escala {
  return {
    id: l.id, sessaoId: l.sessaoId, pessoaId: l.pessoaId, papel: l.papel, status: l.status,
    adicaoDireta: !!l.adicaoDireta, loteId: l.loteId ? l.loteId : null,
  };
}

const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** 'Formatura Teste (05/12)': como a sessão aparece nos avisos. */
export function nomeSessao(evento: Evento, sessao: Sessao): string {
  return `${evento.nome} (${diaMes(sessao.data)})`;
}

/** As regras de montagem do shared, alimentadas pela planilha. */
export function contextoEscala(ctx: Contexto): ContextoEscala {
  const permissoes = ctx.portas.repo.listar<{ id: string; pessoaId: string; modulo: string; nivel: never }>('permissoes');
  return {
    pessoas: linhasPessoas(ctx).filter((p) => p.ativo).map((p) => comPermissoes(p, permissoes as never)),
    sessoes: linhasSessoes(ctx).filter((s) => s.status === 'ativa').map(paraSessao),
    escalas: linhasEscalas(ctx).map(paraEscala),
    disponibilidades: linhasDisponibilidades(ctx).map(({ pessoaId, sessaoId, disponivel, origem }) => ({ pessoaId, sessaoId, disponivel: !!disponivel, origem })),
  };
}

/** Conflito de horário bloqueia (spec 7.3): o servidor confere mesmo que o app deixe passar. */
export function exigirSemConflito(ctx: Contexto, pessoaId: string, sessao: Sessao): void {
  const c = contextoEscala(ctx);
  if (!temConflito(pessoaId, sessao, c)) return;
  const nome = linhasPessoas(ctx).find((p) => p.id === pessoaId)?.nomeCurto ?? 'Esta pessoa';
  throw new ErroApi('CONFLITO_HORARIO', `${nome} já está escalado(a) em outra sessão no mesmo horário (${diaMes(sessao.data)}).`);
}
