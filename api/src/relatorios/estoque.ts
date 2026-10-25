import {
  chamadosAtrasados, diasEmAberto, estoqueCritico, ROTULO_PRIORIDADE, ROTULO_STATUS_OCORRENCIA, STATUS_ABERTOS,
  type AlmoxItem, type PrioridadeOcorrencia,
} from '@shared';
import { paraOcorrencia, type LinhaOcorrencia } from '../acoes/infra';
import type { Portas } from '../nucleo/portas';

/** ESTOQUE (spec 11): itens ativos com saldo, mínimo e situação; críticos destacados. */
export function escreverEstoque(portas: Portas): string {
  const itens = portas.repo
    .listar<AlmoxItem & { id: string }>('almoxItens')
    .map((i) => ({ ...i, saldo: Number(i.saldo), qtdMinima: Number(i.qtdMinima) }))
    .filter((i) => i.status === 'Ativo')
    .sort((a, b) => a.cod.localeCompare(b.cod));
  const linhas = [
    ['COD', 'ITEM', 'CATEGORIA', 'SALA', 'SALDO', 'MÍNIMO', 'SITUAÇÃO'],
    ...itens.map((i) => [i.cod, i.nomeComum || i.nomeAlmox, i.categoria, i.sala, String(i.saldo), String(i.qtdMinima), estoqueCritico(i) ? 'Crítico' : 'OK']),
  ];
  const destaque = itens.map((i, n) => (estoqueCritico(i) ? n + 1 : -1)).filter((n) => n > 0);
  portas.repo.escreverAbaLivre('relatorios', 'ESTOQUE', linhas, { destaque });
  return 'ESTOQUE';
}

const PESO: Record<PrioridadeOcorrencia, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

/** INFRAESTRUTURA (spec 11): abertas primeiro, por prioridade; chamados atrasados destacados. */
export function escreverInfra(portas: Portas): string {
  const hoje = portas.relogio.hoje();
  const lista = portas.repo.listar<LinhaOcorrencia>('ocorrencias').map((o) => paraOcorrencia(o, []));
  const aberta = (s: string) => (STATUS_ABERTOS as string[]).includes(s);
  lista.sort((a, b) => Number(aberta(b.status)) - Number(aberta(a.status)) || PESO[a.prioridade] - PESO[b.prioridade] || b.numero - a.numero);
  const atrasados = new Set(chamadosAtrasados(lista, hoje).map((o) => o.id));
  const linhas = [
    ['Nº', 'OCORRÊNCIA', 'LOCAL', 'TIPO', 'PRIORIDADE', 'SITUAÇÃO', 'Nº DO CHAMADO UFSM', 'DIAS EM ABERTO'],
    ...lista.map((o) => [
      String(o.numero), o.titulo, o.local, o.categoria, ROTULO_PRIORIDADE[o.prioridade], ROTULO_STATUS_OCORRENCIA[o.status], o.chamadoNumero,
      String(diasEmAberto(o, hoje)),
    ]),
  ];
  const destaque = lista.map((o, n) => (atrasados.has(o.id) ? n + 1 : -1)).filter((n) => n > 0);
  portas.repo.escreverAbaLivre('relatorios', 'INFRAESTRUTURA', linhas, destaque.length ? { destaque } : undefined);
  return 'INFRAESTRUTURA';
}
