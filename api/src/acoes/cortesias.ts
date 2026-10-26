import {
  ErroApi,
  errosCortesias,
  fichaTravada,
  formatarData,
  limparPessoas,
  MAX_CORTESIAS_DESTINO,
  prazoCortesias,
  type CortesiasPublica,
  type DestinoCortesias,
  type PessoaCortesia,
  type TravaFicha,
} from '@shared';
import { paraBase64Url } from '../auth/bytes';
import { novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { linhasEventos, type LinhaEvento } from './eventos';
import { sessoesAtivas } from './fichas';

/** Destino das cortesias de um evento (sem os nomes, que ficam em `cortesiasSigilo`). */
interface LinhaDestino {
  id: string;
  eventoId: string;
  nome: string;
  quantidade: number;
  pedirMatricula: boolean;
  trava: TravaFicha;
  atualizadoPeloDestinoEm: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/** Na planilha Sigiloso: a chave do link e a lista de nomes e matrículas. */
interface LinhaSigilo {
  id: string;
  token: string;
  pessoas: PessoaCortesia[] | null;
}

const SEM_LINK = () => new ErroApi('LINK', 'Este link não vale mais. Peça um novo ao Centro de Convenções.');
const TRAVAS: TravaFicha[] = ['auto', 'travada', 'destravada'];

const linhasDestinos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaDestino>('cortesiasDestinos');
const linhasSigilo = (ctx: Contexto) => ctx.portas.repo.listar<LinhaSigilo>('cortesiasSigilo');
const novoToken = (ctx: Contexto) => paraBase64Url(ctx.portas.cripto.aleatorio(32));
const semCarimbo = <T extends { atualizadoPor?: string }>({ atualizadoPor: _p, ...l }: T) => l;

interface Destino {
  linha: LinhaDestino;
  sigilo: LinhaSigilo;
  evento: LinhaEvento;
  datas: string[];
}

function carregar(ctx: Contexto, linha: LinhaDestino): Destino {
  const sigilo = linhasSigilo(ctx).find((s) => s.id === linha.id);
  const evento = linhasEventos(ctx).find((e) => e.id === linha.eventoId);
  if (!sigilo || !evento) throw new ErroApi('NAO_ENCONTRADO', 'Destino não encontrado.');
  return { linha, sigilo, evento, datas: sessoesAtivas(ctx, evento.id).map((s) => s.data) };
}

function porId(ctx: Contexto, id: string): Destino {
  const linha = linhasDestinos(ctx).find((d) => d.id === id);
  if (!linha) throw new ErroApi('NAO_ENCONTRADO', 'Destino não encontrado.');
  return carregar(ctx, linha);
}

function porToken(ctx: Contexto, token: unknown): Destino {
  if (typeof token !== 'string' || token.length < 20) throw SEM_LINK();
  const sigilo = linhasSigilo(ctx).find((s) => s.token === token);
  const linha = sigilo && linhasDestinos(ctx).find((d) => d.id === sigilo.id);
  if (!linha) throw SEM_LINK();
  const d = carregar(ctx, linha);
  if (d.evento.status === 'cancelado') throw new ErroApi('LINK', 'Este evento foi cancelado.');
  return d;
}

function montar(ctx: Contexto, d: Destino): DestinoCortesias {
  const prazo = prazoCortesias(d.datas);
  const l = d.linha;
  return {
    id: l.id, eventoId: l.eventoId, nome: l.nome, quantidade: Number(l.quantidade), pedirMatricula: !!l.pedirMatricula, trava: l.trava,
    travada: fichaTravada({ trava: l.trava, prazo, hoje: ctx.portas.relogio.hoje() }), prazo, atualizadoPeloDestinoEm: l.atualizadoPeloDestinoEm,
    atualizadoEm: l.atualizadoEm, token: d.sigilo.token, pessoas: d.sigilo.pessoas ?? [],
  };
}

function publica(ctx: Contexto, d: Destino): CortesiasPublica {
  const m = montar(ctx, d);
  return {
    evento: { nome: d.evento.nome, datas: d.datas },
    destino: { nome: m.nome, quantidade: m.quantidade, pedirMatricula: m.pedirMatricula },
    travada: m.travada, prazo: m.prazo, pessoas: m.pessoas,
  };
}

/** Limpa, confere e grava a lista; devolve o destino atualizado. */
function gravarPessoas(ctx: Contexto, d: Destino, bruto: unknown): PessoaCortesia[] {
  const pessoas = limparPessoas(bruto, Number(d.linha.quantidade));
  const [erro] = errosCortesias(pessoas, !!d.linha.pedirMatricula);
  if (erro) throw new ErroApi('VALIDACAO', `Linha ${erro.indice + 1}: ${erro.mensagem}`);
  ctx.portas.repo.atualizar('cortesiasSigilo', { ...d.sigilo, pessoas });
  return pessoas;
}

export const handlersCortesias: Handlers = {
  'cortesias.listar': ({ eventoId }, ctx) => {
    const contratos = ctx.portas.repo
      .listar<{ id: string; eventoId: string; cortesiasQtd: number; statusContrato: string }>('contratos')
      .filter((c) => c.eventoId === eventoId && c.statusContrato !== 'Cancelado');
    return {
      destinos: linhasDestinos(ctx)
        .filter((d) => d.eventoId === eventoId)
        .map((l) => montar(ctx, carregar(ctx, l))),
      totalContrato: contratos.length ? contratos.reduce((n, c) => n + Number(c.cortesiasQtd || 0), 0) : null,
    };
  },

  'cortesias.salvarDestino': ({ id, eventoId, nome, quantidade, pedirMatricula }, ctx) => {
    const n = Math.round(Number(quantidade));
    if (!String(nome ?? '').trim()) throw new ErroApi('VALIDACAO', 'Informe o nome do destino.');
    if (!Number.isFinite(n) || n < 1 || n > MAX_CORTESIAS_DESTINO) throw new ErroApi('VALIDACAO', `A quantidade deve ser de 1 a ${MAX_CORTESIAS_DESTINO}.`);
    const campos = { nome: String(nome).trim().slice(0, 80), quantidade: n, pedirMatricula: !!pedirMatricula };
    if (id) {
      const d = porId(ctx, id);
      const lancados = (d.sigilo.pessoas ?? []).length;
      if (n < lancados) throw new ErroApi('VALIDACAO', `Já há ${lancados} nomes lançados. Peça para tirar nomes antes de baixar a quantidade.`);
      ctx.portas.repo.atualizar('cortesiasDestinos', { ...semCarimbo(d.linha), ...campos });
      registrar(ctx, 'evento', d.linha.eventoId, `alterou o destino de cortesias ${campos.nome}`, null, null);
      return montar(ctx, porId(ctx, id));
    }
    if (!linhasEventos(ctx).some((e) => e.id === eventoId)) throw new ErroApi('NAO_ENCONTRADO', 'Evento não encontrado.');
    const novo = novoId(ctx.portas, 'cort');
    ctx.portas.repo.inserir('cortesiasDestinos', { id: novo, eventoId, ...campos, trava: 'auto', atualizadoPeloDestinoEm: '' });
    ctx.portas.repo.inserir('cortesiasSigilo', { id: novo, token: novoToken(ctx), pessoas: [] });
    registrar(ctx, 'evento', eventoId, `criou o destino de cortesias ${campos.nome} (${n})`, null, null);
    return montar(ctx, porId(ctx, novo));
  },

  'cortesias.removerDestino': ({ id }, ctx) => {
    const d = porId(ctx, id);
    ctx.portas.repo.remover('cortesiasDestinos', id);
    ctx.portas.repo.remover('cortesiasSigilo', id);
    registrar(ctx, 'evento', d.linha.eventoId, `removeu o destino de cortesias ${d.linha.nome}`, null, null);
    return null;
  },

  'cortesias.novoLink': ({ id }, ctx) => {
    const d = porId(ctx, id);
    ctx.portas.repo.atualizar('cortesiasSigilo', { ...d.sigilo, token: novoToken(ctx) });
    return montar(ctx, porId(ctx, id));
  },

  'cortesias.travar': ({ id, trava }, ctx) => {
    if (!TRAVAS.includes(trava)) throw new ErroApi('VALIDACAO', 'Trava inválida.');
    const d = porId(ctx, id);
    ctx.portas.repo.atualizar('cortesiasDestinos', { ...semCarimbo(d.linha), trava });
    return montar(ctx, porId(ctx, id));
  },

  'cortesias.salvarPessoas': ({ id, pessoas }, ctx) => {
    const d = porId(ctx, id);
    gravarPessoas(ctx, d, pessoas);
    registrar(ctx, 'evento', d.linha.eventoId, `corrigiu a lista de cortesias de ${d.linha.nome}`, null, null);
    return montar(ctx, porId(ctx, id));
  },

  'cortesia.abrir': ({ token }, ctx) => publica(ctx, porToken(ctx, token)),

  'cortesia.salvar': ({ token, pessoas }, ctx) => {
    const d = porToken(ctx, token);
    const m = montar(ctx, d);
    if (m.travada) {
      throw new ErroApi('TRAVADA', `O prazo para lançar os nomes terminou (${m.prazo ? formatarData(m.prazo) : 'evento sem data'}). Fale com o Centro de Convenções.`);
    }
    gravarPessoas(ctx, d, pessoas);
    ctx.portas.repo.atualizar('cortesiasDestinos', { ...semCarimbo(d.linha), atualizadoPeloDestinoEm: ctx.portas.relogio.agora() });
    return publica(ctx, porToken(ctx, token));
  },
};
