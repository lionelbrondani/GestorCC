import { diferencaDias } from './datas';
import type { DataISO, Ocorrencia, PrioridadeOcorrencia, StatusOcorrencia } from './tipos';

export const CATEGORIAS_INFRA = ['Hidráulica', 'Elétrica', 'Iluminação', 'Ar-condicionado', 'Civil (paredes, pisos, telhado)', 'Mobiliário', 'Som e luz cênica', 'Limpeza', 'Outros'];

export const LOCAIS_INFRA = ['Palco', 'Plateia', 'Coxias', 'Camarins', 'Hall de entrada', 'Mezanino', 'Banheiros', 'Sala VIP', 'Salas administrativas', 'Área externa', 'Outro'];

export const ROTULO_STATUS_OCORRENCIA: Record<StatusOcorrencia, string> = {
  nova: 'Nova',
  analise: 'Em análise',
  chamado: 'Chamado aberto',
  atendimento: 'Em atendimento',
  resolvida: 'Resolvida',
  naoProcede: 'Não procede',
};

export const ROTULO_PRIORIDADE: Record<PrioridadeOcorrencia, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };

const FLUXO: Record<StatusOcorrencia, StatusOcorrencia[]> = {
  nova: ['analise', 'naoProcede'],
  analise: ['chamado', 'atendimento', 'resolvida', 'naoProcede'],
  chamado: ['atendimento', 'resolvida'],
  atendimento: ['resolvida'],
  resolvida: [],
  naoProcede: [],
};

export const STATUS_ABERTOS: StatusOcorrencia[] = ['nova', 'analise', 'chamado', 'atendimento'];

export function proximosStatus(s: StatusOcorrencia): StatusOcorrencia[] {
  return FLUXO[s];
}

/** Devolve a mensagem de erro, ou null se a mudança é válida. */
export function validarTransicao(o: Ocorrencia, para: StatusOcorrencia, dados: { chamadoNumero?: string; observacao: string }): string | null {
  if (!FLUXO[o.status].includes(para)) return 'Mudança de situação não permitida.';
  if (para === 'chamado' && !(dados.chamadoNumero ?? o.chamadoNumero).trim()) return 'Informe o número do chamado aberto no sistema da UFSM.';
  if (para === 'naoProcede' && !dados.observacao.trim()) return 'Explique por que a ocorrência não procede.';
  return null;
}

export function diasEmAberto(o: Ocorrencia, hoje: DataISO): number {
  const fim = o.resolvidaEm && !STATUS_ABERTOS.includes(o.status) ? o.resolvidaEm.slice(0, 10) : hoje;
  return Math.max(0, diferencaDias(o.criadaEm.slice(0, 10), fim));
}

export function chamadosAtrasados(lista: Ocorrencia[], hoje: DataISO, limiteDias = 7): Ocorrencia[] {
  return lista.filter((o) => o.status === 'chamado' && o.chamadoAbertoEm && diferencaDias(o.chamadoAbertoEm.slice(0, 10), hoje) > limiteDias);
}
