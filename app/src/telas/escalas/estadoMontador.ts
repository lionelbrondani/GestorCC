import { autoPreencherPeriodo, temConflito, type ContextoEscala, type Escala, type Id, type Pessoa, type Sessao, type Sugestao } from '@shared';

export interface EstadoMontador {
  escalas: Escala[];
  alterado: boolean;
  /** Sessões com rascunho modificado, para salvar só o necessário. */
  alteradas: Id[];
}

export type AcaoMontador =
  | { tipo: 'carregar'; escalas: Escala[] }
  | { tipo: 'incluir'; sessaoId: Id; pessoaId: Id; papel: 'bolsista' | 'servidor'; adicaoDireta: boolean }
  | { tipo: 'remover'; sessaoId: Id; pessoaId: Id }
  | { tipo: 'autoPreencher'; sessaoIds: Id[]; ctx: ContextoEscala }
  | { tipo: 'aplicarSugestao'; sugestao: Sugestao }
  | { tipo: 'limpar'; sessaoId: Id }
  | { tipo: 'salvo' };

let seq = 0;
const idTemporario = () => `tmp-${++seq}`;

function marcar(e: EstadoMontador, escalas: Escala[], sessaoIds: Id[]): EstadoMontador {
  return { escalas, alterado: true, alteradas: [...new Set([...e.alteradas, ...sessaoIds])] };
}

function rascunho(sessaoId: Id, pessoaId: Id, papel: 'bolsista' | 'servidor', adicaoDireta: boolean): Escala {
  return { id: idTemporario(), sessaoId, pessoaId, papel, status: 'rascunho', adicaoDireta, loteId: null };
}

export function reduzirMontador(e: EstadoMontador, a: AcaoMontador): EstadoMontador {
  switch (a.tipo) {
    case 'carregar':
      return { escalas: a.escalas, alterado: false, alteradas: [] };
    case 'salvo':
      return { ...e, alterado: false, alteradas: [] };
    case 'incluir': {
      const ja = e.escalas.some((x) => x.sessaoId === a.sessaoId && x.pessoaId === a.pessoaId && x.status !== 'cancelado');
      if (ja) return e;
      return marcar(e, [...e.escalas, rascunho(a.sessaoId, a.pessoaId, a.papel, a.adicaoDireta)], [a.sessaoId]);
    }
    case 'remover': {
      const alvo = e.escalas.find((x) => x.sessaoId === a.sessaoId && x.pessoaId === a.pessoaId && x.status === 'rascunho');
      if (!alvo) return e;
      return marcar(e, e.escalas.filter((x) => x !== alvo), [a.sessaoId]);
    }
    case 'limpar':
      return marcar(e, e.escalas.filter((x) => !(x.sessaoId === a.sessaoId && x.status === 'rascunho')), [a.sessaoId]);
    case 'autoPreencher': {
      const escolhas = autoPreencherPeriodo(a.sessaoIds, { ...a.ctx, escalas: e.escalas });
      if (!escolhas.length) return e;
      const novas = escolhas.map((x) => rascunho(x.sessaoId, x.pessoaId, 'bolsista', false));
      return marcar(e, [...e.escalas, ...novas], escolhas.map((x) => x.sessaoId));
    }
    case 'aplicarSugestao': {
      const { sessaoId, tirar, colocar } = a.sugestao;
      const sem = e.escalas.filter((x) => !(x.sessaoId === sessaoId && x.pessoaId === tirar && x.status === 'rascunho'));
      if (sem.length === e.escalas.length) return e;
      return marcar(e, [...sem, rascunho(sessaoId, colocar, 'bolsista', false)], [sessaoId]);
    }
  }
}

export function bloqueioInclusao(sessao: Sessao, pessoa: Pessoa, papel: 'bolsista' | 'servidor', ctx: ContextoEscala): 'conflito' | 'papel' | null {
  const papelDaPessoa = pessoa.tipo === 'servidor' ? 'servidor' : 'bolsista';
  if (papelDaPessoa !== papel) return 'papel';
  if (temConflito(pessoa.id, sessao, ctx)) return 'conflito';
  return null;
}
