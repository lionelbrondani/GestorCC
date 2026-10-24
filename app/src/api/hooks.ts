import type { Acao, Entrada, ErroApi, Saida } from '@shared';
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { useApi } from './cliente';

export function useConsulta<A extends Acao>(
  acao: A,
  dados: Entrada<A>,
  opcoes: { habilitada?: boolean } = {},
): UseQueryResult<Saida<A>, ErroApi> {
  const api = useApi();
  return useQuery<Saida<A>, ErroApi>({
    queryKey: [acao, dados],
    queryFn: () => api.chamar(acao, dados),
    enabled: opcoes.habilitada ?? true,
  });
}

export function useMutacao<A extends Acao>(
  acao: A,
  invalidar: Acao[],
): UseMutationResult<Saida<A>, ErroApi, Entrada<A>> {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Saida<A>, ErroApi, Entrada<A>>({
    mutationFn: (dados) => api.chamar(acao, dados),
    onSuccess: () => {
      void qc.invalidateQueries({ predicate: (q) => invalidar.includes(q.queryKey[0] as Acao) });
    },
  });
}
