import { ErroApi, type Acao, type Entrada, type Saida } from '@shared';
import type { ApiCliente } from '../cliente';

const SEM_REDE = () => new ErroApi('REDE', 'Sem conexão com o servidor. Verifique a internet e tente de novo.');

/**
 * Cliente da API real (Apps Script). O corpo vai como text/plain para o navegador não fazer a
 * verificação prévia de CORS, que o Apps Script não atende.
 */
export function criarHttpCliente(url: string, opcoes: { fetch?: typeof fetch; novoId?: () => string } = {}): ApiCliente {
  const buscar = opcoes.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID());
  let token: string | null = null;

  return {
    definirToken(t) {
      token = t;
    },
    async chamar<A extends Acao>(acao: A, dados: Entrada<A>): Promise<Saida<A>> {
      let corpo: { ok: boolean; dados?: Saida<A>; erro?: { codigo: string; mensagem: string } };
      try {
        const resposta = await buscar(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ acao, token, idRequisicao: novoId(), dados }),
          redirect: 'follow',
        });
        corpo = await resposta.json();
      } catch {
        throw SEM_REDE();
      }
      if (!corpo || typeof corpo !== 'object') throw SEM_REDE();
      if (!corpo.ok) throw new ErroApi(corpo.erro?.codigo ?? 'INTERNO', corpo.erro?.mensagem ?? 'Algo deu errado. Tente de novo.');
      return corpo.dados as Saida<A>;
    },
  };
}
