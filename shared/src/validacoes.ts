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
