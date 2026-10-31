import { describe, expect, it } from 'vitest';
import { criptoNode } from '../src/adaptadores/node';
import { emitirToken, lerToken, VALIDADE_TOKEN_MS } from '../src/auth/tokens';

const SEGREDO = 'segredo-de-teste';
const AGORA = Date.parse('2026-10-24T10:00:00-03:00');

describe('tokens de sessão', () => {
  const token = emitirToken(criptoNode, SEGREDO, 'p01', 3, AGORA);

  it('token válido devolve a pessoa e a versão', () => {
    expect(lerToken(criptoNode, SEGREDO, token, AGORA + 1000)).toEqual({ pessoaId: 'p01', versaoToken: 3 });
  });
  it('token adulterado é recusado', () => {
    const i = Math.floor(token.length / 3);
    const adulterado = token.slice(0, i) + (token[i] === 'A' ? 'B' : 'A') + token.slice(i + 1);
    expect(lerToken(criptoNode, SEGREDO, adulterado, AGORA)).toBeNull();
  });
  it('outro segredo não valida', () => {
    expect(lerToken(criptoNode, 'outro', token, AGORA)).toBeNull();
  });
  it('token vencido é recusado', () => {
    expect(lerToken(criptoNode, SEGREDO, token, AGORA + VALIDADE_TOKEN_MS + 1)).toBeNull();
  });
  it('lixo é recusado sem lançar erro', () => {
    expect(lerToken(criptoNode, SEGREDO, 'nada.disso', AGORA)).toBeNull();
    expect(lerToken(criptoNode, SEGREDO, '', AGORA)).toBeNull();
  });
});
