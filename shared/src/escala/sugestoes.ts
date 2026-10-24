import { mesDe } from '../datas';
import type { Id } from '../tipos';
import { candidatos, escaladosNaSessao, type ContextoEscala } from './autoPreencher';
import { contarNoMes } from './contagem';

export interface Sugestao {
  sessaoId: Id;
  tirar: Id;
  colocar: Id;
  motivo: 'escalarMenos' | 'equilibrio';
  diferenca: number;
}

const LIMITE_POR_MOTIVO = 6;

export function sugestoesEquilibrio(sessaoIds: Id[], ctx: ContextoEscala): Sugestao[] {
  const pessoa = new Map(ctx.pessoas.map((p) => [p.id, p]));
  const todas: Sugestao[] = [];

  for (const sessao of ctx.sessoes.filter((s) => sessaoIds.includes(s.id))) {
    const cont = contarNoMes(ctx.escalas, ctx.sessoes, mesDe(sessao.data));
    const n = (id: Id) => cont.get(id) ?? 0;
    const escalados = escaladosNaSessao(sessao.id, ctx, 'bolsista');
    const experientes = escalados.filter((e) => pessoa.get(e.pessoaId)?.experiente).length;
    const livres = candidatos(sessao, ctx);

    for (const e of escalados) {
      const x = pessoa.get(e.pessoaId);
      if (!x) continue;
      for (const y of livres) {
        let motivo: Sugestao['motivo'] | null = null;
        if (x.escalarMenos && !y.escalarMenos && n(y.id) <= n(x.id) + 3) motivo = 'escalarMenos';
        else if (!x.escalarMenos && !y.escalarMenos && n(x.id) > n(y.id) + 1) motivo = 'equilibrio';
        if (!motivo) continue;
        const perdeExperiente = x.experiente && !y.experiente && experientes - 1 < sessao.minimoExperientes;
        if (perdeExperiente) continue;
        todas.push({ sessaoId: sessao.id, tirar: x.id, colocar: y.id, motivo, diferenca: n(x.id) - n(y.id) });
      }
    }
  }

  const ordenar = (a: Sugestao, b: Sugestao) => b.diferenca - a.diferenca;
  return [
    ...todas.filter((s) => s.motivo === 'escalarMenos').sort(ordenar).slice(0, LIMITE_POR_MOTIVO),
    ...todas.filter((s) => s.motivo === 'equilibrio').sort(ordenar).slice(0, LIMITE_POR_MOTIVO),
  ];
}
