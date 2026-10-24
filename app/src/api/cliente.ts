import type { Acao, Entrada, Saida } from '@shared';
import { createContext, useContext } from 'react';

export interface ApiCliente {
  chamar<A extends Acao>(acao: A, dados: Entrada<A>): Promise<Saida<A>>;
  definirToken(t: string | null): void;
}

export const ApiContexto = createContext<ApiCliente | null>(null);

export function useApi(): ApiCliente {
  const api = useContext(ApiContexto);
  if (!api) throw new Error('ApiContexto não foi fornecido.');
  return api;
}
