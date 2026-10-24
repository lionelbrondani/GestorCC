import { describe, expect, it } from 'vitest';
import { formatarReais } from './dinheiro';

describe('formatarReais', () => {
  it('diária', () => expect(formatarReais(8000)).toBe('R$ 80,00'));
  it('milhar', () => expect(formatarReais(608000)).toBe('R$ 6.080,00'));
  it('zero', () => expect(formatarReais(0)).toBe('R$ 0,00'));
});
