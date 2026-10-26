import type { AlertaContrato, Contrato } from '@shared';

/** Cor de cada etapa: verde feito, azul andamento, amarelo pendente, laranja atenção, vermelho atrasado, cinza isento. */
export type EstadoEtapa = 'feito' | 'andamento' | 'pendente' | 'atencao' | 'atrasado' | 'isento' | 'cancelado';
export type IdEtapa = 'contrato' | 'fatura' | 'ecad' | 'iss' | 'fundep' | 'cortesias';

export interface Etapa {
  id: IdEtapa;
  rotulo: string;
  valor: string;
  estado: EstadoEtapa;
}

export const ROTULO_ESTADO: Record<EstadoEtapa, string> = {
  feito: 'Concluído',
  andamento: 'Em andamento',
  pendente: 'A fazer',
  atencao: 'Atenção: prazo perto',
  atrasado: 'Atrasado',
  isento: 'Isento',
  cancelado: 'Cancelado',
};

const FEITO = ['Pago', 'Paga', 'Assinado', 'Ok', 'Distribuídas'];
const ANDAMENTO = ['Enviado', 'Enviada p/ emissão', 'Enviado ao PEN-SIE', 'Enviado p/ processamento', 'Não paga', 'Não pago', 'Recebidas'];

function estadoDe(valor: string): EstadoEtapa {
  if (FEITO.includes(valor)) return 'feito';
  if (valor === 'Isento') return 'isento';
  if (ANDAMENTO.includes(valor)) return 'andamento';
  return 'pendente';
}

/** As seis etapas do contrato, em ordem, com a cor de cada uma (os alertas do contrato pesam na etapa certa). */
export function etapasDoContrato(c: Contrato, alertas: AlertaContrato[]): Etapa[] {
  const etapas: Etapa[] = [
    { id: 'contrato', rotulo: 'Contrato', valor: c.statusContrato, estado: estadoDe(c.statusContrato) },
    { id: 'fatura', rotulo: 'Fatura', valor: c.statusFatura, estado: estadoDe(c.statusFatura) },
    { id: 'ecad', rotulo: 'ECAD', valor: c.statusEcad, estado: estadoDe(c.statusEcad) },
    { id: 'iss', rotulo: 'ISS', valor: c.statusIss, estado: estadoDe(c.statusIss) },
    { id: 'fundep', rotulo: 'FUNDEP', valor: c.statusFundep, estado: estadoDe(c.statusFundep) },
    { id: 'cortesias', rotulo: 'Cortesias', valor: c.statusCortesias, estado: estadoDe(c.statusCortesias) },
  ];
  if (c.statusContrato === 'Cancelado') return etapas.map((e) => ({ ...e, estado: 'cancelado' }));
  const marcar = (id: IdEtapa, estado: EstadoEtapa) => {
    const e = etapas.find((x) => x.id === id)!;
    if (e.estado !== 'feito' && e.estado !== 'isento') e.estado = estado;
  };
  if (alertas.includes('faturaVencida')) marcar('fatura', 'atrasado');
  else if (alertas.includes('faturaVencendo')) marcar('fatura', 'atencao');
  if (alertas.includes('naoAssinado')) marcar('contrato', 'atencao');
  if (alertas.includes('ecadIssPendente')) {
    marcar('ecad', 'atencao');
    marcar('iss', 'atencao');
  }
  if (alertas.includes('cortesiasPendentes')) marcar('cortesias', 'atencao');
  return etapas.map((e) => (e.id === 'fatura' && alertas.includes('faturaVencida') ? { ...e, valor: 'Vencida' } : e));
}

/** Etapa que ainda pede ação (para o resumo e o filtro do topo). */
export const pedeAcao = (e: Etapa) => e.estado === 'pendente' || e.estado === 'atencao' || e.estado === 'atrasado';
