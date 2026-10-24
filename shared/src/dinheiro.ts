import type { Centavos } from './tipos';

export function formatarReais(c: Centavos): string {
  const negativo = c < 0;
  const abs = Math.abs(Math.round(c));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}R$ ${reais},${centavos}`;
}
