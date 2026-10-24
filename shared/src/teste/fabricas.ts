import { MODELOS } from '../permissoes';
import type { Disponibilidade, Escala, Evento, Pessoa, Sessao } from '../tipos';

let seq = 0;
const novoId = (p: string) => `${p}${++seq}`;

export function pessoa(parcial: Partial<Pessoa> = {}): Pessoa {
  const id = parcial.id ?? novoId('p');
  return {
    id,
    nome: `Pessoa ${id}`,
    nomeCurto: `PESSOA ${id}`,
    emailAcademico: `${id}@acad.ufsm.br`,
    matricula: '2026000000',
    tipo: 'bolsista',
    vinculo: 'eventual',
    experiente: false,
    escalarMenos: false,
    ativo: true,
    permissoes: MODELOS.eventual,
    ...parcial,
  };
}

export function sessao(parcial: Partial<Sessao> = {}): Sessao {
  return {
    id: parcial.id ?? novoId('s'),
    eventoId: 'e1',
    data: '2026-11-10',
    chegada: '18:30',
    inicio: '20:00',
    fim: '22:00',
    horarioADefinir: false,
    vagasBolsistas: 8,
    vagasServidores: 1,
    diaria: null,
    minimoExperientes: 0,
    status: 'ativa',
    publicadaEm: null,
    convocacao: null,
    ...parcial,
  };
}

export function evento(parcial: Partial<Evento> = {}): Evento {
  return {
    id: parcial.id ?? novoId('e'),
    nome: 'Espetáculo Teste',
    tipo: 'Show/Concerto',
    organizador: 'Produtora Teste',
    contatoOrganizador: '',
    pagamento: 'interno',
    instrumento: 'contrato',
    status: 'ativo',
    ...parcial,
  };
}

export function escala(parcial: Partial<Escala> & Pick<Escala, 'sessaoId' | 'pessoaId'>): Escala {
  return { id: novoId('x'), papel: 'bolsista', status: 'publicado', adicaoDireta: false, loteId: null, ...parcial };
}

export function disponivel(pessoaId: string, sessaoId: string, d = true): Disponibilidade {
  return { pessoaId, sessaoId, disponivel: d, origem: 'proprio' };
}
