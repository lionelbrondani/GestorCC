import { describe, expect, it } from 'vitest';
import { VERSAO } from './index';

describe('sanidade', () => {
  it('exporta a versão do pacote compartilhado', () => {
    expect(VERSAO).toBe('0.0.0');
  });
});
