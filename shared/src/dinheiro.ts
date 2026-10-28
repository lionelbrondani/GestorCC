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

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n: number): string {
  if (n === 100) return 'cem';
  const partes: string[] = [];
  if (n >= 100) partes.push(CENTENAS[Math.floor(n / 100)]);
  const r = n % 100;
  if (r >= 20) partes.push(r % 10 ? `${DEZENAS[Math.floor(r / 10)]} e ${UNIDADES[r % 10]}` : DEZENAS[r / 10]);
  else if (r > 0) partes.push(UNIDADES[r]);
  return partes.join(' e ');
}

/** Inteiro por extenso, como se escreve em contrato: "mil e quinhentos", "dois milhões e trezentos mil". */
export function numeroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const grupos: { valor: number; texto: string }[] = [];
  let resto = n;
  for (const [tamanho, um, varios] of [[1e9, 'um bilhão', 'bilhões'], [1e6, 'um milhão', 'milhões'], [1e3, 'mil', 'mil']] as const) {
    const q = Math.floor(resto / tamanho);
    resto %= tamanho;
    if (q) grupos.push({ valor: q, texto: q === 1 ? um : `${ate999(q)} ${varios}` });
  }
  if (resto) grupos.push({ valor: resto, texto: ate999(resto) });
  // o último grupo leva "e" quando é menor que cem ou uma centena redonda (mil e quinhentos, mil e vinte)
  const ultimo = grupos.at(-1)!;
  const juntar = grupos.length > 1 && (ultimo.valor < 100 || ultimo.valor % 100 === 0);
  return juntar ? `${grupos.slice(0, -1).map((g) => g.texto).join(' ')} e ${ultimo.texto}` : grupos.map((g) => g.texto).join(' ');
}

/** Valor em reais por extenso, para os documentos ({{VALOR_EXTENSO}}): "seis mil e trezentos reais". */
export function valorPorExtenso(c: Centavos): string {
  const abs = Math.abs(Math.round(c));
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  const partes: string[] = [];
  if (reais) {
    const texto = numeroPorExtenso(reais);
    partes.push(`${texto}${/(milhão|milhões|bilhão|bilhões)$/.test(texto) ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.join(' e ') || 'zero reais';
}
