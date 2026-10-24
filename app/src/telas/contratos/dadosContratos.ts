import { alertasContrato, type Contrato, type DataISO } from '@shared';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import type { TomEtiqueta } from '../../componentes';
import { hoje, janela } from '../../util/hoje';

export const INVALIDAR_CONTRATOS = ['contratos.listar', 'historico.listar'] as const;

export function tomStatus(valor: string): TomEtiqueta {
  if (['Pago', 'Paga', 'Assinado', 'Ok', 'Distribuídas'].includes(valor)) return 'sucesso';
  if (valor === 'Isento') return 'neutro';
  if (valor === 'Cancelado') return 'erro';
  if (valor.startsWith('Enviad') || valor === 'Recebidas') return 'info';
  return 'aviso';
}

export function useDadosContratos() {
  const { de, ate } = janela(400, 400);
  const periodo = usePeriodo(de, ate);
  const q = useConsulta('contratos.listar', null);
  const config = useConsulta('config.obter', null);
  const primeiraData = (c: Contrato): DataISO =>
    periodo.sessoes
      .filter((s) => s.eventoId === c.eventoId)
      .map((s) => s.data)
      .sort()[0] ?? '9999-12-31';
  return {
    carregando: periodo.isLoading || q.isLoading || config.isLoading,
    periodo,
    contratos: q.data?.contratos ?? [],
    aditivos: q.data?.aditivos ?? [],
    contratantes: q.data?.contratantes ?? [],
    config: config.data,
    primeiraData,
    alertas: (c: Contrato) => alertasContrato(c, primeiraData(c), hoje()),
  };
}
