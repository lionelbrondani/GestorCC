// Conversões de bytes sem depender de TextEncoder/Buffer/btoa (ausentes no Apps Script).

export function utf8(texto: string): Uint8Array {
  const saida: number[] = [];
  for (const ch of texto) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) saida.push(c);
    else if (c < 0x800) saida.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) saida.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else saida.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(saida);
}

export function deUtf8(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    if (b < 0x80) (c = b), (i += 1);
    else if (b < 0xe0) (c = ((b & 31) << 6) | (bytes[i + 1] & 63)), (i += 2);
    else if (b < 0xf0) (c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)), (i += 3);
    else (c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63)), (i += 4);
    s += String.fromCodePoint(c);
  }
  return s;
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function paraBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += ALFABETO[(n >> 18) & 63] + ALFABETO[(n >> 12) & 63];
    s += i + 1 < bytes.length ? ALFABETO[(n >> 6) & 63] : '=';
    s += i + 2 < bytes.length ? ALFABETO[n & 63] : '=';
  }
  return s;
}

export function deBase64(texto: string): Uint8Array {
  const limpo = texto.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(limpo)) throw new Error('base64 inválido');
  const saida: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of limpo) {
    buffer = (buffer << 6) | ALFABETO.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      saida.push((buffer >> bits) & 255);
    }
  }
  return Uint8Array.from(saida);
}

export const paraBase64Url = (b: Uint8Array) => paraBase64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const deBase64Url = (s: string) => deBase64(s.replace(/-/g, '+').replace(/_/g, '/'));

/** Comparação em tempo constante. */
export function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}
