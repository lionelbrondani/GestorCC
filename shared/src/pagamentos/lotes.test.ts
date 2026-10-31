import { describe, expect, it } from 'vitest';
import { escala, evento, sessao } from '../teste/fabricas';
import type { Lote } from '../tipos';
import { elegiveisParaLote, periodoReferencia, previaLote, valorDaSessao, type BasePagamentos } from './lotes';

function lote(id: string, status: Lote['status']): Lote {
  return { id, titulo: id, periodoReferencia: '', edital: '', iniciativa: '', incluirZerados: true, status, criadoEm: '2026-10-01', pagoEm: null };
}

describe('valorDaSessao', () => {
  it('usa a diária especial quando existe', () => {
    expect(valorDaSessao(sessao({ diaria: 12000 }), 8000)).toBe(12000);
    expect(valorDaSessao(sessao({ diaria: null }), 8000)).toBe(8000);
  });
});

describe('elegiveisParaLote', () => {
  it('aplica todas as exclusões', () => {
    const interno = evento({ id: 'ei' });
    const externo = evento({ id: 'ee', pagamento: 'externo' });
    const base: BasePagamentos = {
      eventos: [interno, externo],
      sessoes: [
        sessao({ id: 'ok', eventoId: 'ei' }),
        sessao({ id: 'cancelada', eventoId: 'ei', status: 'cancelada' }),
        sessao({ id: 'ext', eventoId: 'ee' }),
      ],
      escalas: [
        escala({ id: 'e1', sessaoId: 'ok', pessoaId: 'a', status: 'realizado' }),
        escala({ id: 'e2', sessaoId: 'ok', pessoaId: 'b', status: 'faltou' }),
        escala({ id: 'e3', sessaoId: 'ok', pessoaId: 'c', status: 'cancelado' }),
        escala({ id: 'e4', sessaoId: 'cancelada', pessoaId: 'a', status: 'realizado' }),
        escala({ id: 'e5', sessaoId: 'ext', pessoaId: 'a', status: 'realizado' }),
        escala({ id: 'e6', sessaoId: 'ok', pessoaId: 'd', status: 'realizado', loteId: 'enviado' }),
        escala({ id: 'e7', sessaoId: 'ok', pessoaId: 'e', status: 'realizado', loteId: 'cancelado' }),
        escala({ id: 'e8', sessaoId: 'ok', pessoaId: 'f', status: 'realizado', papel: 'servidor' }),
      ],
      lotes: [lote('enviado', 'enviado'), lote('cancelado', 'cancelado')],
    };
    expect(elegiveisParaLote(base).map((e) => e.id)).toEqual(['e1', 'e7']);
  });
});

describe('previaLote', () => {
  it('soma por pessoa respeitando diárias especiais', () => {
    const base: BasePagamentos = {
      eventos: [evento({ id: 'ev' })],
      sessoes: [
        sessao({ id: 's1', eventoId: 'ev' }),
        sessao({ id: 's2', eventoId: 'ev' }),
        sessao({ id: 's3', eventoId: 'ev', diaria: 12000 }),
      ],
      escalas: [
        escala({ id: 'x1', sessaoId: 's1', pessoaId: 'a', status: 'realizado' }),
        escala({ id: 'x2', sessaoId: 's2', pessoaId: 'a', status: 'realizado' }),
        escala({ id: 'x3', sessaoId: 's3', pessoaId: 'a', status: 'realizado' }),
        escala({ id: 'x4', sessaoId: 's1', pessoaId: 'b', status: 'realizado' }),
      ],
      lotes: [],
    };
    const p = previaLote(['x1', 'x2', 'x3', 'x4'], base, 8000);
    expect(p.porPessoa.find((x) => x.pessoaId === 'a')).toEqual({ pessoaId: 'a', escalaIds: ['x1', 'x2', 'x3'], qtd: 3, valor: 28000 });
    expect(p.total).toBe(36000);
  });
});

describe('periodoReferencia', () => {
  it('usa o mês da maior data e o intervalo completo', () => {
    expect(periodoReferencia(['2026-09-16', '2026-10-15', '2026-08-22'])).toBe(
      'OUTUBRO/2026 – eventos de 22/08/2026 até 15/10/2026',
    );
  });
  it('lista vazia gera texto vazio', () => expect(periodoReferencia([])).toBe(''));
});
