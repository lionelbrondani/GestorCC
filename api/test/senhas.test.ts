import { describe, expect, it } from 'vitest';
import { criptoNode } from '../src/adaptadores/node';
import { conferirSenha, criarHash, pbkdf2Sha256 } from '../src/auth/senhas';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const bytes = (s: string) => new TextEncoder().encode(s);

describe('PBKDF2-HMAC-SHA256', () => {
  it('vetor de referência com 1 iteração', () => {
    expect(hex(pbkdf2Sha256(criptoNode, 'password', bytes('salt'), 1))).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
  });
  it('vetor de referência com 2 iterações', () => {
    expect(hex(pbkdf2Sha256(criptoNode, 'password', bytes('salt'), 2))).toBe('ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43');
  });
});

describe('senhas', () => {
  it('confere a senha certa e recusa outra', () => {
    const cred = criarHash(criptoNode, 'minhaSenha123', 50);
    expect(conferirSenha(criptoNode, 'minhaSenha123', cred)).toBe(true);
    expect(conferirSenha(criptoNode, 'minhaSenha124', cred)).toBe(false);
  });
  it('mesma senha gera sal e hash diferentes', () => {
    const a = criarHash(criptoNode, 'igual', 10);
    const b = criarHash(criptoNode, 'igual', 10);
    expect(a.sal).not.toBe(b.sal);
    expect(a.hash).not.toBe(b.hash);
  });
});
