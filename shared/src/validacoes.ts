function digitoCpf(digitos: number[], pesoInicial: number): number {
  const soma = digitos.reduce((acc, d, i) => acc + d * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function digitosCpfValidos(s: string): string | null {
  const so = s.replace(/\D/g, '');
  if (so.length !== 11 || /^(\d)\1{10}$/.test(so)) return null;
  const nums = so.split('').map(Number);
  if (digitoCpf(nums.slice(0, 9), 10) !== nums[9]) return null;
  if (digitoCpf(nums.slice(0, 10), 11) !== nums[10]) return null;
  return so;
}

export function cpfValido(s: string): boolean {
  return digitosCpfValidos(s) !== null;
}

export function normalizarCpf(s: string): string | null {
  const so = digitosCpfValidos(s);
  if (!so) return null;
  return `${so.slice(0, 3)}.${so.slice(3, 6)}.${so.slice(6, 9)}-${so.slice(9)}`;
}

export function normalizarMatricula(s: string): string | null {
  const limpo = s.trim();
  if (!/^\d{9,10}$/.test(limpo)) return null;
  return limpo;
}

/**
 * CNPJ com os dígitos verificadores certos, inclusive o alfanumérico (Receita, a partir de 2026): os 12 primeiros
 * caracteres podem ter letras, que valem o código do caractere menos 48 (A = 17); os 2 últimos são sempre dígitos.
 */
export function cnpjValido(s: string): boolean {
  const c = s.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(.)\1{13}$/.test(c)) return false;
  const valores = [...c].map((ch) => ch.charCodeAt(0) - 48);
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = pesos.reduce((acc, p, i) => acc + p * valores[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(12) === valores[12] && dv(13) === valores[13];
}
