import type { BloqueioData, Notificacao, PedidoDatas, PedidoDatasDados } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEventos } from '../src/acoes/eventos';
import { handlersPedidos } from '../src/acoes/pedidos';
import { handlersAvisos } from '../src/acoes/avisos';
import { handlersSistema } from '../src/acoes/sistema';
import { criarAmbiente } from './apoio';
import { linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };

const pedido = (data: string): PedidoDatasDados => ({
  evento: 'Recital Exemplo', categoria: 'Concerto', categoriaOutra: '', dias: [{ data, atividade: 'evento', inicio: '19:00', fim: '21:00' }],
  observacoesHorarios: '', programacao: 'Obras para piano.', indicacao: 'Livre', pessoasEnvolvidas: 5, espacos: ['Palco'], espacoOutro: '', publico: 300,
  informacoes: '',
  solicitante: { razaoSocial: 'Produtora Exemplo Ltda', documento: '11.222.333/0001-81', endereco: 'Rua do Teste, 1', cep: '01001-000', inscricaoEstadual: 'Isento', inscricaoMunicipal: 'Isento' },
  responsavel: { nome: 'Pessoa Teste', cpf: '529.982.247-25', email: 'pessoa@exemplo.com', telefone: '(00) 99999-0000' },
});

function ambiente() {
  const amb = criarAmbiente({ handlers: { ...handlersPedidos, ...handlersEventos, ...handlersSistema, ...handlersAvisos } });
  amb.repo.inserir('eventos', linhaEvento('e1', 'Concerto Secreto'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-12-05' }));
  const gestor = amb.token('p01');
  const comoGestor = (acao: string, dados: unknown) => amb.chamar(acao as never, dados as never, { token: gestor });
  return { ...amb, gestor, comoGestor };
}

describe('calendário e bloqueios do pedido de data', () => {
  it('a página pública vê só se o dia está ocupado ou bloqueado, sem o evento nem o motivo', () => {
    const amb = ambiente();
    expect(amb.comoGestor('bloqueios.salvar', { de: '2026-12-24', ate: '2027-01-02', motivo: 'Recesso de fim de ano' })).toMatchObject({ ok: true });
    const r = amb.chamar('pedido.calendario', { de: '2026-12-01', ate: '2026-12-31' }) as Ok<{ ocupados: string[]; bloqueados: string[] }>;
    expect(r.dados.ocupados).toEqual(['2026-12-05']);
    expect(r.dados.bloqueados).toEqual(['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
    expect(JSON.stringify(r)).not.toMatch(/Concerto Secreto|Recesso/);
    expect(amb.chamar('pedido.calendario', { de: '2026-01-01', ate: '2026-12-31' })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
  });

  it('quem edita eventos bloqueia e desbloqueia datas; quem não edita, não', () => {
    const amb = ambiente();
    expect(amb.comoGestor('bloqueios.salvar', { de: '2026-12-24', ate: '2026-12-20', motivo: '' })).toMatchObject({ ok: false, erro: { mensagem: 'A data final precisa vir depois da inicial.' } });
    const b = (amb.comoGestor('bloqueios.salvar', { de: '2026-11-10', ate: '2026-11-12', motivo: 'Manutenção do palco' }) as Ok<BloqueioData>).dados;
    expect((amb.comoGestor('bloqueios.listar', null) as Ok<BloqueioData[]>).dados).toEqual([{ id: b.id, de: '2026-11-10', ate: '2026-11-12', motivo: 'Manutenção do palco' }]);
    expect(amb.chamar('bloqueios.salvar', { de: '2026-11-10', ate: '2026-11-12', motivo: '' }, { token: amb.token('p02') })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
    amb.comoGestor('bloqueios.remover', { id: b.id });
    expect((amb.comoGestor('bloqueios.listar', null) as Ok<BloqueioData[]>).dados).toEqual([]);
  });

  it('a lotação do teatro vem para a página; pedido em dia ocupado entra na lista de espera', () => {
    const amb = ambiente();
    expect((amb.chamar('pedido.abrir', null) as Ok<{ lotacao: number }>).dados.lotacao).toBe(1000);
    expect(amb.chamar('pedido.enviar', { dados: pedido('2026-12-06') })).toEqual({ ok: true, dados: { protocolo: 'PD-2026-0001', listaEspera: false } });
    expect(amb.chamar('pedido.enviar', { dados: pedido('2026-12-05') })).toEqual({ ok: true, dados: { protocolo: 'PD-2026-0002', listaEspera: true } });
    const lista = (amb.comoGestor('pedidos.listar', null) as Ok<PedidoDatas[]>).dados;
    expect(lista.map((p) => [p.protocolo, p.listaEspera])).toEqual(expect.arrayContaining([['PD-2026-0001', false], ['PD-2026-0002', true]]));
  });

  it('quando o dia fica livre, quem gerencia é avisado de que há pedido na lista de espera', () => {
    const amb = ambiente();
    amb.chamar('pedido.enviar', { dados: pedido('2026-12-05') });
    amb.comoGestor('eventos.cancelar', { eventoId: 'e1', justificativa: 'A produção desistiu.' });
    const avisos = (amb.comoGestor('notificacoes.listar', null) as Ok<Notificacao[]>).dados;
    expect(avisos.map((n) => n.texto)).toContainEqual('O dia 05/12/2026 ficou livre: o pedido PD-2026-0001 (Recital Exemplo) está na lista de espera.');
  });
});
