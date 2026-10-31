import type { BasePagamentos } from '@shared';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { janela } from '../../util/hoje';

export const INVALIDAR_PAGAMENTOS = ['lotes.listar', 'escalas.listar', 'ganhos.meus', 'historico.listar'] as const;

/** Eventos, sessões, escalas e lotes de um ano para trás e um à frente. */
export function useDadosPagamentos() {
  const { de, ate } = janela(400, 400);
  const periodo = usePeriodo(de, ate);
  const escalas = useConsulta('escalas.listar', { de, ate });
  const lotes = useConsulta('lotes.listar', null);
  const config = useConsulta('config.obter', null);
  const pessoas = usePessoas();
  const base: BasePagamentos = {
    eventos: periodo.eventos,
    sessoes: periodo.sessoes,
    escalas: escalas.data ?? [],
    lotes: lotes.data?.lotes ?? [],
  };
  return {
    carregando: periodo.isLoading || escalas.isLoading || lotes.isLoading || config.isLoading || pessoas.isLoading,
    periodo,
    pessoas,
    base,
    itens: lotes.data?.itens ?? [],
    config: config.data,
    diaria: config.data?.diariaPadrao ?? 8000,
  };
}
