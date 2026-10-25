import { ErroApi, type Acao, type Entrada, type Saida } from '@shared';
import type { ApiCliente } from '../cliente';

const SEM_REDE = () => new ErroApi('REDE', 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
/** Consultas pedidas dentro desta janela vão juntas num pedido só. */
const JANELA_MS = 10;
/** O mesmo limite da API. */
const LOTE_MAX = 20;

type Corpo = { ok: boolean; dados?: unknown; erro?: { codigo: string; mensagem: string } };
type Pendente = { acao: Acao; dados: unknown; resolver: (v: unknown) => void; rejeitar: (e: unknown) => void };

function resultado(corpo: Corpo | null | undefined): unknown {
  if (!corpo || typeof corpo !== 'object') throw SEM_REDE();
  if (!corpo.ok) throw new ErroApi(corpo.erro?.codigo ?? 'INTERNO', corpo.erro?.mensagem ?? 'Algo deu errado. Tente de novo.');
  return corpo.dados;
}

/**
 * Cliente da API real (Apps Script). O corpo vai como text/plain para o navegador não fazer a
 * verificação prévia de CORS, que o Apps Script não atende.
 */
export function criarHttpCliente(url: string, opcoes: { fetch?: typeof fetch; novoId?: () => string } = {}): ApiCliente {
  const buscar = opcoes.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID());
  let token: string | null = null;
  let fila: Pendente[] = [];

  async function enviar(corpo: object): Promise<Corpo> {
    try {
      const resposta = await buscar(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(corpo),
        redirect: 'follow',
      });
      return await resposta.json();
    } catch {
      throw SEM_REDE();
    }
  }

  async function chamar<A extends Acao>(acao: A, dados: Entrada<A>): Promise<Saida<A>> {
    return resultado(await enviar({ acao, token, idRequisicao: novoId(), dados })) as Saida<A>;
  }

  /** Cada consulta recebe a sua resposta; um erro só derruba a consulta dele (ou todas, se o pedido inteiro falhar). */
  async function enviarLote(grupo: Pendente[]) {
    try {
      const respostas = resultado(await enviar({ token, lote: grupo.map((p) => ({ acao: p.acao, dados: p.dados })) }));
      if (!Array.isArray(respostas) || respostas.length !== grupo.length) throw SEM_REDE();
      grupo.forEach((p, i) => {
        try {
          p.resolver(resultado(respostas[i]));
        } catch (e) {
          p.rejeitar(e);
        }
      });
    } catch (e) {
      grupo.forEach((p) => p.rejeitar(e));
    }
  }

  function esvaziar() {
    const pedidos = fila;
    fila = [];
    if (pedidos.length === 1) {
      const [p] = pedidos;
      chamar(p.acao, p.dados as never).then(p.resolver, p.rejeitar);
      return;
    }
    for (let i = 0; i < pedidos.length; i += LOTE_MAX) void enviarLote(pedidos.slice(i, i + LOTE_MAX));
  }

  return {
    definirToken(t) {
      token = t;
    },
    chamar,
    consultar<A extends Acao>(acao: A, dados: Entrada<A>): Promise<Saida<A>> {
      return new Promise((resolver, rejeitar) => {
        if (!fila.length) setTimeout(esvaziar, JANELA_MS);
        fila.push({ acao, dados, resolver: resolver as (v: unknown) => void, rejeitar });
      });
    },
  };
}
