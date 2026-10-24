import { describe, expect, it } from 'vitest';
import { deBase64, deUtf8, paraBase64, paraBase64Url, utf8 } from '../src/auth/bytes';

describe('bytes', () => {
  const texto = 'Senha-ção ü 😀 São Paulo';
  it('UTF-8 igual ao do Node, ida e volta', () => {
    expect(Buffer.from(utf8(texto)).equals(Buffer.from(texto, 'utf8'))).toBe(true);
    expect(deUtf8(utf8(texto))).toBe(texto);
  });
  it('base64 igual ao do Node, ida e volta, todos os tamanhos de sobra', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 31, 32]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);
      expect(paraBase64(b)).toBe(Buffer.from(b).toString('base64'));
      expect(Array.from(deBase64(paraBase64(b)))).toEqual(Array.from(b));
      expect(paraBase64Url(b)).toBe(Buffer.from(b).toString('base64url'));
    }
  });
});
