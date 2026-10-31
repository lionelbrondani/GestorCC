import { describe, expect, it } from 'vitest';
import { escala, evento, sessao } from '../teste/fabricas';
import type { Lote } from '../tipos';
import { meusGanhos } from './ganhos';

const lotePago: Lote = {
  id: 'L1', titulo: 'Lote 1', periodoReferencia: 'SETEMBRO/2026', edital: '', iniciativa: '',
  incluirZerados: true, status: 'pago', criadoEm: '2026-09-20', pagoEm: '2026-10-05',
};

describe('meusGanhos', () => {
  it('pessoa sem escalas tem tudo zerado', () => {
    const g = meusGanhos('ninguem', { eventos: [], sessoes: [], escalas: [], lotes: [], itens: [] }, 8000);
    expect(g).toEqual({ previsto: { qtd: 0, valor: 0 }, enviados: [], pagos: [], externos: [] });
  });

  it('separa previsto, pagos e externos', () => {
    const interno = evento({ id: 'ei', nome: 'Concerto' });
    const externo = evento({ id: 'ee', nome: 'Congresso', pagamento: 'externo', pagadorExterno: 'Organização X' });
    const g = meusGanhos(
      'a',
      {
        eventos: [interno, externo],
        sessoes: [
          sessao({ id: 's1', eventoId: 'ei', data: '2026-09-10' }),
          sessao({ id: 's2', eventoId: 'ei', data: '2026-11-10' }),
          sessao({ id: 's3', eventoId: 'ei', data: '2026-10-10' }),
          sessao({ id: 's4', eventoId: 'ee', data: '2026-10-29' }),
        ],
        escalas: [
          escala({ id: 'x1', sessaoId: 's1', pessoaId: 'a', status: 'realizado', loteId: 'L1' }),
          escala({ id: 'x2', sessaoId: 's2', pessoaId: 'a', status: 'publicado' }),
          escala({ id: 'x3', sessaoId: 's3', pessoaId: 'a', status: 'realizado' }),
          escala({ id: 'x4', sessaoId: 's4', pessoaId: 'a', status: 'realizado' }),
        ],
        lotes: [lotePago],
        itens: [{ loteId: 'L1', escalaId: 'x1', pessoaId: 'a', valor: 8000 }],
      },
      8000,
    );
    expect(g.previsto).toEqual({ qtd: 2, valor: 16000 });
    expect(g.enviados).toEqual([]);
    expect(g.pagos).toEqual([
      { loteId: 'L1', titulo: 'Lote 1', data: '2026-10-05', valor: 8000, eventos: [{ nome: 'Concerto', data: '2026-09-10' }] },
    ]);
    expect(g.externos).toEqual([{ eventoNome: 'Congresso', data: '2026-10-29', pagador: 'Organização X' }]);
  });
});
