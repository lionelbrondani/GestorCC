// Cripto com o crypto do Node — usado só nos testes.
import { createHmac, randomBytes } from 'node:crypto';
import type { Cripto } from '../nucleo/portas';

export const criptoNode: Cripto = {
  hmacSha256: (chave, msg) => new Uint8Array(createHmac('sha256', chave).update(msg).digest()),
  aleatorio: (bytes) => new Uint8Array(randomBytes(bytes)),
};
