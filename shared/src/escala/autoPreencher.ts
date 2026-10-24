import { horaParaMinutos, mesDe } from '../datas';
import type { Disponibilidade, Escala, Id, Pessoa, Sessao } from '../tipos';
import { alertasDaEscala } from './alertas';
import { contaNaEscala, contarNoMes } from './contagem';

export interface ContextoEscala {
  pessoas: Pessoa[];
  sessoes: Sessao[];
  escalas: Escala[];
  disponibilidades: Disponibilidade[];
}

export function compararNomes(a: Pessoa, b: Pessoa): number {
  return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
}

export function estaDisponivel(pessoaId: Id, sessaoId: Id, ctx: ContextoEscala): boolean {
  return ctx.disponibilidades.some((d) => d.pessoaId === pessoaId && d.sessaoId === sessaoId && d.disponivel);
}

/** Sessões em que a pessoa já está escalada (com status que conta), exceto a sessão informada. */
export function sessoesDaPessoa(pessoaId: Id, ctx: ContextoEscala, excetoSessaoId?: Id): Sessao[] {
  const ids = new Set(
    ctx.escalas.filter((e) => e.pessoaId === pessoaId && contaNaEscala(e) && e.sessaoId !== excetoSessaoId).map((e) => e.sessaoId),
  );
  return ctx.sessoes.filter((s) => ids.has(s.id));
}

export function temConflito(pessoaId: Id, sessao: Sessao, ctx: ContextoEscala): boolean {
  return alertasDaEscala(sessao, sessoesDaPessoa(pessoaId, ctx, sessao.id)).includes('conflito');
}

export function escaladosNaSessao(sessaoId: Id, ctx: ContextoEscala, papel?: 'bolsista' | 'servidor'): Escala[] {
  return ctx.escalas.filter((e) => e.sessaoId === sessaoId && contaNaEscala(e) && (!papel || e.papel === papel));
}

export function candidatos(sessao: Sessao, ctx: ContextoEscala): Pessoa[] {
  const ja = new Set(escaladosNaSessao(sessao.id, ctx).map((e) => e.pessoaId));
  const contagem = contarNoMes(ctx.escalas, ctx.sessoes, mesDe(sessao.data));
  return ctx.pessoas
    .filter(
      (p) =>
        p.ativo &&
        p.tipo === 'bolsista' &&
        !ja.has(p.id) &&
        estaDisponivel(p.id, sessao.id, ctx) &&
        !temConflito(p.id, sessao, ctx),
    )
    .sort(
      (a, b) =>
        Number(a.escalarMenos) - Number(b.escalarMenos) ||
        (contagem.get(a.id) ?? 0) - (contagem.get(b.id) ?? 0) ||
        compararNomes(a, b),
    );
}

export function autoPreencherSessao(sessao: Sessao, ctx: ContextoEscala): Id[] {
  const bolsistas = escaladosNaSessao(sessao.id, ctx, 'bolsista');
  const faltam = sessao.vagasBolsistas - bolsistas.length;
  if (faltam <= 0) return [];

  const lista = candidatos(sessao, ctx);
  const experientesNaSessao = bolsistas.filter((e) => ctx.pessoas.find((p) => p.id === e.pessoaId)?.experiente).length;
  const deficit = Math.max(0, sessao.minimoExperientes - experientesNaSessao);

  const escolhidos = lista.filter((p) => p.experiente).slice(0, Math.min(deficit, faltam));
  for (const p of lista) {
    if (escolhidos.length >= faltam) break;
    if (!escolhidos.includes(p)) escolhidos.push(p);
  }
  return escolhidos.map((p) => p.id);
}

function chaveCronologica(s: Sessao): string {
  const hora = s.chegada ?? s.inicio;
  return `${s.data}-${hora ? String(horaParaMinutos(hora)).padStart(4, '0') : '9999'}`;
}

export function autoPreencherPeriodo(sessaoIds: Id[], ctx: ContextoEscala): { sessaoId: Id; pessoaId: Id }[] {
  const alvo = ctx.sessoes
    .filter((s) => sessaoIds.includes(s.id) && s.status === 'ativa')
    .sort((a, b) => chaveCronologica(a).localeCompare(chaveCronologica(b)));

  const escolhas: { sessaoId: Id; pessoaId: Id }[] = [];
  let atual = ctx;
  for (const s of alvo) {
    const ids = autoPreencherSessao(s, atual);
    const novas: Escala[] = ids.map((pessoaId) => ({
      id: `auto-${s.id}-${pessoaId}`,
      sessaoId: s.id,
      pessoaId,
      papel: 'bolsista',
      status: 'rascunho',
      adicaoDireta: false,
      loteId: null,
    }));
    escolhas.push(...ids.map((pessoaId) => ({ sessaoId: s.id, pessoaId })));
    atual = { ...atual, escalas: [...atual.escalas, ...novas] };
  }
  return escolhas;
}
