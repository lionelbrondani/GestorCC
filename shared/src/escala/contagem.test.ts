import { describe, expect, it } from 'vitest';
import { escala, sessao } from '../teste/fabricas';
import { contarNoMes } from './contagem';

describe('contarNoMes', () => {
  it('ignora faltou, cancelado e outros meses', () => {
    const s1 = sessao({ id: 'a', data: '2026-11-01' });
    const s2 = sessao({ id: 'b', data: '2026-11-02' });
    const s3 = sessao({ id: 'c', data: '2026-12-01' });
    const escalas = [
      escala({ sessaoId: 'a', pessoaId: 'p', status: 'realizado' }),
      escala({ sessaoId: 'b', pessoaId: 'p', status: 'faltou' }),
      escala({ sessaoId: 'b', pessoaId: 'q', status: 'cancelado' }),
      escala({ sessaoId: 'c', pessoaId: 'p', status: 'rascunho' }),
    ];
    const c = contarNoMes(escalas, [s1, s2, s3], '2026-11');
    expect(c.get('p')).toBe(1);
    expect(c.get('q') ?? 0).toBe(0);
  });
});
