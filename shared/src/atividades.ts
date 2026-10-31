/** Atividades de apoio de um evento (montagem, passagem de som…): sessões com escala própria, fora da rodada e sem diária. */
import type { AtividadeSessao, Sessao } from './tipos';

export const NOMES_ATIVIDADE: Record<AtividadeSessao, string> = {
  evento: 'Evento',
  montagem: 'Montagem',
  passagemSom: 'Passagem de som',
  desmontagem: 'Desmontagem',
  ensaio: 'Ensaio',
};

export const ATIVIDADES: AtividadeSessao[] = ['evento', 'montagem', 'passagemSom', 'desmontagem', 'ensaio'];

/** Sessão de apoio (não é o evento em si). */
export const ehApoio = (s: Pick<Sessao, 'atividade'>) => !!s.atividade && s.atividade !== 'evento';

/** 'Montagem · Formatura – Palco' para apoio; 'Formatura – Palco' para a sessão do evento. */
export function tituloComAtividade(nomeEvento: string, s: Pick<Sessao, 'atividade' | 'rotulo'>): string {
  const base = s.rotulo ? `${nomeEvento} – ${s.rotulo}` : nomeEvento;
  return ehApoio(s) ? `${NOMES_ATIVIDADE[s.atividade!]} · ${base}` : base;
}
