import type { Escala, Evento, Pessoa, Sessao } from '@shared';
import { describe, expect, it } from 'vitest';
import { levantamentoMensal, type BaseLevantamento } from './levantamento';

const pessoa = (id: string, tipo: Pessoa['tipo'] = 'bolsista'): Pessoa =>
  ({ id, nome: `Pessoa ${id}`, nomeCurto: id.toUpperCase(), tipo, vinculo: 'eventual', ativo: true, permissoes: {} }) as unknown as Pessoa;
const evento = (id: string, pagamento: Evento['pagamento'], p: Partial<Evento> = {}): Evento =>
  ({ id, nome: `Evento ${id}`, tipo: 'Outro', organizador: '', contatoOrganizador: '', pagamento, instrumento: 'nenhum', status: 'ativo', ...p }) as Evento;
const sessao = (id: string, eventoId: string, data: string, diaria: number | null = null): Sessao =>
  ({ id, eventoId, data, chegada: null, inicio: null, fim: null, horarioADefinir: true, vagasBolsistas: 4, vagasServidores: 1, diaria, minimoExperientes: 0, status: 'ativa', publicadaEm: 'x', convocacao: null }) as Sessao;
const escala = (id: string, sessaoId: string, pessoaId: string, status: Escala['status'], loteId: string | null = null, papel: Escala['papel'] = 'bolsista'): Escala =>
  ({ id, sessaoId, pessoaId, papel, status, adicaoDireta: false, loteId });

function base(p: Partial<BaseLevantamento> = {}): BaseLevantamento {
  return {
    mes: '2026-11',
    eventos: [evento('e1', 'interno', { publicoEstimado: 300 }), evento('e2', 'externo', { publicoEstimado: 100 }), evento('e3', 'interno')],
    sessoes: [sessao('s1', 'e1', '2026-11-05'), sessao('s2', 'e1', '2026-11-06', 10000), sessao('s3', 'e2', '2026-11-10'), sessao('s4', 'e3', '2026-12-01')],
    escalas: [
      escala('x1', 's1', 'ana', 'realizado', 'l1'),
      escala('x2', 's2', 'ana', 'realizado'),
      escala('x3', 's3', 'ana', 'realizado'),
      escala('x4', 's1', 'bia', 'faltou'),
      escala('x5', 's1', 'srv', 'realizado', null, 'servidor'),
      escala('x6', 's4', 'ana', 'realizado'),
    ],
    pessoas: [pessoa('ana'), pessoa('bia'), pessoa('srv', 'servidor')],
    diariaPadrao: 8000,
    lotes: [{ id: 'l1', titulo: 'Lote', periodoReferencia: '2026-11', edital: '', iniciativa: '', incluirZerados: false, status: 'enviado', criadoEm: '2026-11-20T10:00', pagoEm: null }],
    loteItens: [{ loteId: 'l1', escalaId: 'x1', pessoaId: 'ana', valor: 8000 }],
    contratos: [], aditivos: [], fichas: [], movimentos: [], itensAlmox: [], ocorrencias: [],
    ...p,
  };
}

describe('levantamento mensal', () => {
  it('direito de cada pessoa: diárias internas (com a diária da sessão), externas, faltas e o que já está em lote', () => {
    const r = levantamentoMensal(base());
    const ana = r.direitos.find((d) => d.pessoa.id === 'ana')!;
    expect(ana).toMatchObject({ escalas: 3, realizadas: 3, faltas: 0, diariasInternas: 2, valorInterno: 18000, valorEmLote: 8000, diariasExternas: 1 });
    expect(r.direitos.find((d) => d.pessoa.id === 'bia')).toMatchObject({ faltas: 1, valorInterno: 0 });
    expect(r.direitos.find((d) => d.pessoa.id === 'srv')).toMatchObject({ realizadas: 1, valorInterno: 0, diariasExternas: 0 });
    expect(r.direitos.map((d) => d.pessoa.id)).toEqual(['ana', 'bia', 'srv']);
  });

  it('resumo só com o que é do mês', () => {
    const r = levantamentoMensal(base());
    expect(r.resumo).toMatchObject({ eventos: 2, sessoes: 3, publicoEstimado: 400, valorDiarias: 18000, realizadas: 4, faltas: 1 });
    expect(r.lotes).toEqual([expect.objectContaining({ itens: 1, valor: 8000 })]);
  });

  it('almoxarifado soma as saídas do mês por item', () => {
    const r = levantamentoMensal(base({
      itensAlmox: [{ cod: '0012', nomeAlmox: 'FITA', nomeComum: 'Fita', unidade: 'UN', valor: 500, categoria: '', qtdMinima: 0, sala: '', status: 'Ativo', saldo: 3 }],
      movimentos: [
        { id: 'm1', quando: '2026-11-03T10:00', tipo: 'saida', cod: '0012', qtd: -2, valorUnitario: 500 },
        { id: 'm2', quando: '2026-11-09T10:00', tipo: 'saida', cod: '0012', qtd: -1, valorUnitario: 500 },
        { id: 'm3', quando: '2026-10-30T10:00', tipo: 'saida', cod: '0012', qtd: -5, valorUnitario: 500 },
      ],
    }));
    expect(r.almox).toEqual([{ cod: '0012', nome: 'Fita', qtd: 3, valor: 1500 }]);
    expect(r.resumo.saidasAlmox).toBe(1500);
  });
});
