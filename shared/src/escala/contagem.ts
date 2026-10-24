import { mesDe } from '../datas';
import type { Escala, Id, Sessao, StatusEscala } from '../tipos';

export const STATUS_QUE_CONTAM: StatusEscala[] = ['rascunho', 'publicado', 'realizado'];

export function contaNaEscala(e: Escala): boolean {
  return STATUS_QUE_CONTAM.includes(e.status);
}

export function contarNoMes(escalas: Escala[], sessoes: Sessao[], mes: string): Map<Id, number> {
  const mesDaSessao = new Map(sessoes.map((s) => [s.id, mesDe(s.data)]));
  const contagem = new Map<Id, number>();
  for (const e of escalas) {
    if (!contaNaEscala(e) || mesDaSessao.get(e.sessaoId) !== mes) continue;
    contagem.set(e.pessoaId, (contagem.get(e.pessoaId) ?? 0) + 1);
  }
  return contagem;
}
