import { MODULOS, type Nivel, type Permissoes, type Pessoa } from '@shared';
import { paraBase64Url } from '../auth/bytes';
import type { Portas, Repositorio } from './portas';

export type Contexto = { portas: Portas; eu: Pessoa | null; idRequisicao: string };

export function novoId(portas: Portas, prefixo: string): string {
  return `${prefixo}-${paraBase64Url(portas.cripto.aleatorio(9))}`;
}

export function registrar(
  ctx: Contexto,
  entidade: string,
  entidadeId: string,
  acao: string,
  antes: unknown,
  depois: unknown,
  justificativa = '',
): void {
  ctx.portas.repo.inserir('historico', {
    id: novoId(ctx.portas, 'h'),
    quando: ctx.portas.relogio.agora(),
    quemId: ctx.eu?.id ?? '',
    entidade,
    entidadeId,
    acao,
    antes: antes ?? null,
    depois: depois ?? null,
    justificativa,
  });
}

type LinhaPessoa = Omit<Pessoa, 'permissoes'> & { id: string };
type LinhaPermissao = { id: string; pessoaId: string; modulo: string; nivel: Nivel };

/** Pessoa completa: linha de `pessoas` + linhas de `permissoes` (módulo ausente = 'nenhum'). */
export function montarPessoa(repo: Repositorio, id: string): Pessoa | null {
  const linha = repo.listar<LinhaPessoa>('pessoas').find((p) => p.id === id);
  if (!linha) return null;
  return comPermissoes(linha, repo.listar<LinhaPermissao>('permissoes'));
}

export function comPermissoes(linha: LinhaPessoa, todas: LinhaPermissao[]): Pessoa {
  const permissoes = Object.fromEntries(MODULOS.map((m) => [m.id, 'nenhum'])) as Permissoes;
  for (const p of todas) {
    if (p.pessoaId === linha.id && p.modulo in permissoes) permissoes[p.modulo as keyof Permissoes] = p.nivel;
  }
  const { criadoEm: _c, atualizadoPor: _a, ...resto } = linha as LinhaPessoa & { criadoEm?: string; atualizadoPor?: string };
  return { ...resto, convitesAgenda: resto.convitesAgenda || null, permissoes };
}
