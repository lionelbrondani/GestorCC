import { ErroApi, pode, type Acao, type Entrada, type Saida } from '@shared';
import { lerToken } from '../auth/tokens';
import { montarPessoa, type Contexto } from './historico';
import type { Portas } from './portas';
import { ACOES_FASE } from './regras';

export { comPermissoes, montarPessoa, novoId, registrar, type Contexto } from './historico';

export type Handler<A extends Acao> = (dados: Entrada<A>, ctx: Contexto) => Saida<A>;
export type Handlers = Partial<{ [A in Acao]: Handler<A> }>;

const ESPERA_TRAVA_MS = 10_000;
/** O CacheService guarda no máximo 6 horas. */
const VALIDADE_IDEMPOTENCIA_S = 6 * 60 * 60;

const SESSAO = () => new ErroApi('SESSAO', 'Sua sessão expirou. Entre novamente.');

/** Lança CONFLITO se o registro mudou desde que a tela o carregou. */
export function exigirVersao(
  atual: { atualizadoEm?: string; atualizadoPor?: string },
  esperada: string | undefined,
  nomes: (id: string) => string,
): void {
  if (!esperada || !atual.atualizadoEm || esperada === atual.atualizadoEm) return;
  const quem = atual.atualizadoPor ? nomes(atual.atualizadoPor) : 'Outra pessoa';
  throw new ErroApi('CONFLITO', `${quem} alterou este registro às ${atual.atualizadoEm.slice(11, 16)}. Recarregue a tela antes de salvar.`);
}

function sessao(token: unknown, portas: Portas) {
  if (typeof token !== 'string' || !token) throw SESSAO();
  const segredo = portas.props.obter('SEGREDO_TOKEN');
  if (!segredo) throw new Error('SEGREDO_TOKEN não configurado (rode instalar()).');
  const lido = lerToken(portas.cripto, segredo, token, portas.relogio.agoraMs());
  if (!lido) throw SESSAO();
  const eu = montarPessoa(portas.repo, lido.pessoaId);
  const cred = portas.repo.listar<{ id: string; versaoToken: number }>('credenciais').find((c) => c.id === lido.pessoaId);
  if (!eu || !eu.ativo || !cred || cred.versaoToken !== lido.versaoToken) throw SESSAO();
  return eu;
}

function resposta(corpo: unknown): string {
  return JSON.stringify(corpo);
}

export function tratarRequisicao(corpo: string, portas: Portas, handlers: Handlers): string {
  let req: { acao?: Acao; token?: string; idRequisicao?: string; dados?: unknown };
  try {
    req = JSON.parse(corpo);
    if (!req || typeof req !== 'object') throw new Error();
  } catch {
    return resposta({ ok: false, erro: { codigo: 'REQUISICAO', mensagem: 'Requisição inválida.' } });
  }

  try {
    const acao = req.acao as Acao;
    const def = ACOES_FASE[acao];
    const handler = handlers[acao] as Handler<Acao> | undefined;
    if (!def || !handler) throw new ErroApi('NAO_DISPONIVEL', 'Esta função ainda não está disponível.');

    const eu = def.regra === 'publica' ? null : sessao(req.token, portas);
    if (Array.isArray(def.regra) && !pode(eu!.permissoes, def.regra[0], def.regra[1])) {
      throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    }

    const ctx: Contexto = { portas, eu, idRequisicao: req.idRequisicao ?? '' };
    const executar = () => resposta({ ok: true, dados: handler(req.dados as never, ctx) ?? null });
    if (!def.escrita) return executar();

    const chave = req.idRequisicao ? `req:${req.idRequisicao}` : null;
    const anterior = chave ? portas.cache.obter(chave) : null;
    if (anterior) return anterior;
    return portas.trava.executar(() => {
      const repetida = chave ? portas.cache.obter(chave) : null;
      if (repetida) return repetida;
      portas.repo.definirAutor(eu?.id ?? '');
      const r = executar();
      if (chave) portas.cache.guardar(chave, r, VALIDADE_IDEMPOTENCIA_S);
      return r;
    }, ESPERA_TRAVA_MS);
  } catch (e) {
    if (e instanceof ErroApi) return resposta({ ok: false, erro: { codigo: e.codigo, mensagem: e.message } });
    console.error(e);
    return resposta({
      ok: false,
      erro: { codigo: 'INTERNO', mensagem: 'Algo deu errado do nosso lado. Tente de novo; se continuar, avise o gestor do sistema.' },
    });
  }
}
