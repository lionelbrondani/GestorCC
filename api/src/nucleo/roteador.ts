import { ErroApi, pode, type Acao, type Entrada, type Saida } from '@shared';
import { lerToken } from '../auth/tokens';
import { montarPessoa, type Contexto } from './historico';
import type { Portas } from './portas';
import { ACOES_FASE } from './regras';

export { comPermissoes, montarPessoa, notificar, novoId, registrar, type Contexto } from './historico';

export type Handler<A extends Acao> = (dados: Entrada<A>, ctx: Contexto) => Saida<A>;
export type Handlers = Partial<{ [A in Acao]: Handler<A> }>;

const ESPERA_TRAVA_MS = 10_000;
/** O CacheService guarda no máximo 6 horas. */
const VALIDADE_IDEMPOTENCIA_S = 6 * 60 * 60;
const LOTE_MAX = 20;

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

/**
 * Várias consultas numa ida só: dividem a mesma leitura das planilhas e pagam uma vez o tempo de o Apps Script
 * acordar. Gravações vão sempre sozinhas (trava e proteção contra reenvio).
 */
function tratarLote(req: { token?: string; lote: unknown[] }, portas: Portas, handlers: Handlers): string {
  if (!req.lote.length || req.lote.length > LOTE_MAX) {
    return resposta({ ok: false, erro: { codigo: 'REQUISICAO', mensagem: `Mande de 1 a ${LOTE_MAX} consultas por lote.` } });
  }
  const respostas = req.lote.map((item) => {
    const { acao, dados } = (item ?? {}) as { acao?: Acao; dados?: unknown };
    if (acao && ACOES_FASE[acao]?.escrita) return { ok: false, erro: { codigo: 'REQUISICAO', mensagem: 'Gravações não vão em lote.' } };
    return JSON.parse(tratarRequisicao(JSON.stringify({ acao, dados, token: req.token }), portas, handlers));
  });
  return resposta({ ok: true, dados: respostas });
}

export function tratarRequisicao(corpo: string, portas: Portas, handlers: Handlers): string {
  let req: { acao?: Acao; token?: string; idRequisicao?: string; dados?: unknown; lote?: unknown };
  try {
    req = JSON.parse(corpo);
    if (!req || typeof req !== 'object') throw new Error();
  } catch {
    return resposta({ ok: false, erro: { codigo: 'REQUISICAO', mensagem: 'Requisição inválida.' } });
  }
  if (Array.isArray(req.lote)) return tratarLote({ token: req.token, lote: req.lote }, portas, handlers);

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
      portas.repo.descartarLeituras();
      portas.repo.definirAutor(eu?.id ?? '');
      try {
        const r = executar();
        if (chave) portas.cache.guardar(chave, r, VALIDADE_IDEMPOTENCIA_S);
        return r;
      } finally {
        portas.repo.concluirEscrita();
      }
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
