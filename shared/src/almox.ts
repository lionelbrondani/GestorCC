import type { AlmoxItem, AlmoxMovimento } from './tipos';

export function formatarCod(cod: string | number): string {
  return String(cod).trim().padStart(4, '0');
}

export function saldoDosMovimentos(movs: AlmoxMovimento[], cod: string): number {
  const alvo = formatarCod(cod);
  return movs.filter((m) => formatarCod(m.cod) === alvo).reduce((acc, m) => acc + m.qtd, 0);
}

export function estoqueCritico(i: AlmoxItem): boolean {
  return i.status === 'Ativo' && i.saldo <= i.qtdMinima;
}

export function quantidadeSugerida(i: AlmoxItem): number {
  return Math.max(1, 2 * i.qtdMinima - i.saldo);
}

export function validarRetirada(
  itens: { cod: string; qtd: number }[],
  estoque: AlmoxItem[],
): { cod: string; erro: string }[] {
  const totalPorCod = new Map<string, number>();
  for (const i of itens) totalPorCod.set(formatarCod(i.cod), (totalPorCod.get(formatarCod(i.cod)) ?? 0) + i.qtd);

  const erros: { cod: string; erro: string }[] = [];
  for (const [cod, qtd] of totalPorCod) {
    const item = estoque.find((e) => formatarCod(e.cod) === cod);
    if (!item) erros.push({ cod, erro: 'Item não encontrado' });
    else if (!(qtd > 0)) erros.push({ cod, erro: 'Quantidade deve ser maior que zero' });
    else if (item.status !== 'Ativo') erros.push({ cod, erro: 'Item inativo' });
    else if (qtd > item.saldo) erros.push({ cod, erro: `Saldo insuficiente (disponível: ${item.saldo})` });
  }
  return erros;
}
