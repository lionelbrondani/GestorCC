import type { Acao, Entrada, Saida } from '@shared';
import { createContext, useContext } from 'react';

export interface ApiCliente {
  chamar<A extends Acao>(acao: A, dados: Entrada<A>): Promise<Saida<A>>;
  /** Só para leituras: consultas feitas ao mesmo tempo podem ir juntas num pedido só. Sem ele, usa `chamar`. */
  consultar?<A extends Acao>(acao: A, dados: Entrada<A>): Promise<Saida<A>>;
  definirToken(t: string | null): void;
}

export const ApiContexto = createContext<ApiCliente | null>(null);

export function useApi(): ApiCliente {
  const api = useContext(ApiContexto);
  if (!api) throw new Error('ApiContexto não foi fornecido.');
  return api;
}

/** Leitura que pode ir em lote com as outras feitas ao mesmo tempo. */
export function consultar<A extends Acao>(api: ApiCliente, acao: A, dados: Entrada<A>): Promise<Saida<A>> {
  return api.consultar ? api.consultar(acao, dados) : api.chamar(acao, dados);
}
