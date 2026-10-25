import { formatarData, formatarReais } from '@shared';
import { linhasPessoas } from '../escalas/comum';
import type { Contexto } from '../nucleo/roteador';
import type { Portas } from '../nucleo/portas';
import type { LinhaLote, LinhaLoteItem } from '../acoes/pagamentos';

/** Nome da aba: o título do lote sem os caracteres que a planilha recusa. */
export const nomeAbaLote = (titulo: string) => `PAGAMENTOS – ${titulo.replace(/[[\]*?:/\\]/g, '-')}`.slice(0, 90);

/** PAGAMENTOS – <LOTE> (spec 11): por bolsista, sem CPF nem dados bancários. */
export function escreverLote(portas: Portas, loteId: string): string | null {
  const lote = portas.repo.listar<LinhaLote>('lotes').find((l) => l.id === loteId);
  if (!lote) return null;
  const itens = portas.repo.listar<LinhaLoteItem>('loteItens').filter((i) => i.loteId === loteId);
  const ctx = { portas, eu: null, idRequisicao: '' } as Contexto;
  const pessoas = linhasPessoas(ctx);
  const porPessoa = new Map<string, number[]>();
  for (const i of itens) porPessoa.set(i.pessoaId, [...(porPessoa.get(i.pessoaId) ?? []), Number(i.valor)]);
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? id;

  const linhas = [['BOLSISTA', 'QUANTIDADE', 'VALOR UNITÁRIO', 'TOTAL']];
  for (const [pessoaId, valores] of [...porPessoa].sort((a, b) => nome(a[0]).localeCompare(nome(b[0]), 'pt-BR'))) {
    const unitario = new Set(valores).size === 1 ? formatarReais(valores[0]) : 'variado';
    linhas.push([nome(pessoaId), String(valores.length), unitario, formatarReais(valores.reduce((a, b) => a + b, 0))]);
  }
  const total = itens.reduce((a, i) => a + Number(i.valor), 0);
  linhas.push(['TOTAL DO LOTE', String(itens.length), '', formatarReais(total)]);
  const situacao = lote.status === 'pago' ? `Pago em ${formatarData(lote.pagoEm)}` : lote.status === 'cancelado' ? 'Cancelado' : 'Enviado';
  linhas.push([`SITUAÇÃO: ${situacao}`, '', '', '']);

  const aba = nomeAbaLote(lote.titulo);
  portas.repo.escreverAbaLivre('relatorios', aba, linhas);
  return aba;
}
