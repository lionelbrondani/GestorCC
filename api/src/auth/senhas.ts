import type { Cripto } from '../nucleo/portas';
import { deBase64, iguais, paraBase64, utf8 } from './bytes';

export const ITERACOES_PADRAO = 2000;

/** PBKDF2-HMAC-SHA256 com um único bloco (32 bytes = tamanho do SHA-256). */
export function pbkdf2Sha256(cripto: Cripto, senha: string, sal: Uint8Array, iteracoes: number): Uint8Array {
  const chave = utf8(senha);
  const bloco = new Uint8Array(sal.length + 4);
  bloco.set(sal);
  bloco.set([0, 0, 0, 1], sal.length);
  let u = cripto.hmacSha256(chave, bloco);
  const resultado = Uint8Array.from(u);
  for (let i = 1; i < iteracoes; i++) {
    u = cripto.hmacSha256(chave, u);
    for (let k = 0; k < resultado.length; k++) resultado[k] ^= u[k];
  }
  return resultado;
}

export interface HashSenha {
  hash: string;
  sal: string;
  iteracoes: number;
}

export function criarHash(cripto: Cripto, senha: string, iteracoes = ITERACOES_PADRAO): HashSenha {
  const sal = cripto.aleatorio(16);
  return { hash: paraBase64(pbkdf2Sha256(cripto, senha, sal, iteracoes)), sal: paraBase64(sal), iteracoes };
}

export function conferirSenha(cripto: Cripto, senha: string, cred: HashSenha): boolean {
  if (!cred.hash || !cred.sal || !cred.iteracoes) return false;
  const calculado = pbkdf2Sha256(cripto, senha, deBase64(cred.sal), cred.iteracoes);
  return iguais(calculado, deBase64(cred.hash));
}
