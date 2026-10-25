import manual from '../../../docs/manual/uso.md?raw';
import type { Handlers } from '../nucleo/roteador';
import { lerResposta, montarPedido } from '../busca/gemini';
import { configAtual } from './sistema';

const UM_DIA_S = 24 * 60 * 60;

/** Perguntas da barra de busca (spec 10.3): o Gemini só interpreta; a consulta roda no app com as permissões de quem perguntou. */
export const handlersBusca: Handlers = {
  'busca.interpretar': ({ pergunta }, ctx) => {
    const { cache, relogio, ia } = ctx.portas;
    const chave = `busca:${ctx.eu!.id}:${relogio.hoje()}`;
    const feitas = Number(cache.obter(chave) ?? '0');
    if (feitas >= configAtual(ctx).limitePerguntasDia) return { consulta: null, ajuda: null, motivo: 'limite' };
    let resposta: unknown;
    try {
      resposta = ia.gerar(montarPedido(String(pergunta ?? ''), relogio.hoje(), manual));
    } catch {
      return { consulta: null, ajuda: null, motivo: 'indisponivel' };
    }
    if (resposta === null) return { consulta: null, ajuda: null, motivo: 'indisponivel' };
    cache.guardar(chave, String(feitas + 1), UM_DIA_S);
    return { ...lerResposta(resposta), motivo: null };
  },
};
