import type { PedidoDatas, PedidoDatasDados } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersContratos } from '../src/acoes/contratos';
import { handlersEventos } from '../src/acoes/eventos';
import { handlersPedidos } from '../src/acoes/pedidos';
import { antiRoboMemoria } from '../src/adaptadores/memoria';
import { limparDadosPessoais } from '../src/lgpd';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };

const dados: PedidoDatasDados = {
  evento: 'Festival de Dança Exemplo', categoria: 'Show musical', categoriaOutra: '',
  dias: [
    { data: '2026-12-04', atividade: 'montagem', inicio: '08:00', fim: '18:00' },
    { data: '2026-12-05', atividade: 'evento', inicio: '20:00', fim: '22:30' },
  ],
  observacoesHorarios: '', programacao: 'Apresentações das escolas.', indicacao: 'Livre', pessoasEnvolvidas: 40,
  espacos: ['Palco', 'Plateia'], espacoOutro: '', publico: 800, informacoes: '',
  solicitante: { razaoSocial: 'Produtora Exemplo Ltda', documento: '11.222.333/0001-81', endereco: 'Rua do Teste, 10 - Centro, Santa Maria/RS', cep: '97010-000', inscricaoEstadual: 'Isento', inscricaoMunicipal: '123' },
  responsavel: { nome: 'Pessoa Responsável', cpf: '529.982.247-25', email: 'responsavel@exemplo.com', telefone: '(55) 99999-0000' },
};

function ambiente(aceitaRobo = true) {
  const amb = criarAmbiente({ handlers: { ...handlersPedidos, ...handlersEventos, ...handlersContratos }, antiRobo: antiRoboMemoria(aceitaRobo) });
  const gestor = amb.token('p01');
  const enviar = (extra: Record<string, unknown> = {}) => amb.chamar('pedido.enviar', { dados, ...extra });
  const listar = () => (amb.chamar('pedidos.listar', null, { token: gestor }) as Ok<PedidoDatas[]>).dados;
  return { ...amb, gestor, enviar, listar };
}

describe('pedido de datas pela página pública', () => {
  it('quem pede recebe o protocolo; quem gerencia eventos é avisado; CPF, e-mail e telefone ficam na planilha sigilosa', () => {
    const amb = ambiente();
    expect(amb.enviar()).toEqual({ ok: true, dados: { protocolo: 'PD-2026-0001' } });
    expect(amb.enviar()).toEqual({ ok: true, dados: { protocolo: 'PD-2026-0002' } });
    const [p] = amb.listar();
    expect(p).toMatchObject({ protocolo: 'PD-2026-0001', status: 'novo', evento: 'Festival de Dança Exemplo', responsavel: { cpf: '529.982.247-25' }, eventoId: null });
    expect(JSON.stringify(amb.repo.listar('pedidos'))).not.toContain('529.982.247-25');
    expect(JSON.stringify(amb.repo.listar('pedidosSigilo'))).toContain('529.982.247-25');
    expect(amb.repo.listar<{ id: string; pessoaId: string; texto: string }>('notificacoes')).toContainEqual(
      expect.objectContaining({ pessoaId: 'p01', texto: 'Novo pedido de data: Festival de Dança Exemplo (04/12/2026)' }),
    );
  });

  it('confere os dados de novo no servidor', () => {
    const amb = ambiente();
    expect(amb.chamar('pedido.enviar', { dados: { ...dados, responsavel: { ...dados.responsavel, cpf: '123' } } })).toEqual({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Informe um CPF válido.' } });
  });

  it('robô que preenche o campo escondido recebe resposta de sucesso, mas nada é gravado', () => {
    const amb = ambiente();
    expect(amb.enviar({ site: 'http://spam.exemplo' })).toMatchObject({ ok: true });
    expect(amb.repo.listar('pedidos')).toEqual([]);
  });

  it('com o Turnstile ligado, exige a verificação da Cloudflare', () => {
    const amb = ambiente(false);
    amb.portas.props.definir('TURNSTILE_SECRET', 'segredo-de-teste');
    expect(amb.enviar({ antiRobo: 'token-recusado' })).toMatchObject({ ok: false, erro: { codigo: 'ANTI_ROBO' } });
    const ok = ambiente(true);
    ok.portas.props.definir('TURNSTILE_SECRET', 'segredo-de-teste');
    expect(ok.enviar()).toMatchObject({ ok: false, erro: { codigo: 'ANTI_ROBO' } });
    expect(ok.enviar({ antiRobo: 'token-bom' })).toMatchObject({ ok: true });
  });

  it('no máximo 30 pedidos por dia', () => {
    const amb = ambiente();
    for (let i = 0; i < 30; i++) amb.repo.inserir('pedidos', { id: `x${i}`, protocolo: `PD-2026-${i}`, status: 'novo', recebidoEm: '2026-10-24T09:00', dados: {} } as never);
    expect(amb.enviar()).toMatchObject({ ok: false, erro: { codigo: 'LIMITE' } });
  });

  it('bolsista não vê os pedidos', () => {
    const amb = ambiente();
    expect(amb.chamar('pedidos.listar', null, { token: amb.token('p02') })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('decidir o pedido', () => {
  it('aprovar cria o evento com uma sessão por dia e cadastra o contratante (uma vez só por documento)', () => {
    const amb = ambiente();
    amb.enviar();
    const [p] = amb.listar();
    const r = amb.chamar('pedidos.aprovar', { id: p.id }, { token: amb.gestor }) as Ok<{ pedido: PedidoDatas; eventoId: string }>;
    expect(r.dados.pedido).toMatchObject({ status: 'aprovado', eventoId: r.dados.eventoId });
    expect(amb.repo.listar<{ id: string; nome: string; tipo: string }>('eventos')).toContainEqual(expect.objectContaining({ id: r.dados.eventoId, nome: 'Festival de Dança Exemplo', tipo: 'Show/Concerto' }));
    const sessoes = amb.repo.listar<{ id: string; eventoId: string; data: string; atividade: string }>('sessoes').filter((s) => s.eventoId === r.dados.eventoId);
    expect(sessoes.map((s) => [s.data, s.atividade || 'evento'])).toEqual([['2026-12-04', 'montagem'], ['2026-12-05', 'evento']]);
    expect(amb.repo.listar<{ id: string; documento: string; email: string }>('contratantes')).toEqual([expect.objectContaining({ documento: '11.222.333/0001-81', email: 'responsavel@exemplo.com' })]);
    expect(amb.chamar('pedidos.aprovar', { id: p.id }, { token: amb.gestor })).toMatchObject({ ok: false, erro: { codigo: 'DECIDIDO' } });

    amb.enviar();
    const segundo = amb.listar().find((x) => x.status === 'novo')!;
    amb.chamar('pedidos.aprovar', { id: segundo.id }, { token: amb.gestor });
    expect(amb.repo.listar('contratantes')).toHaveLength(1);
  });

  it('recusar pede o motivo; depois do prazo da LGPD, os dados pessoais do recusado são apagados', () => {
    const amb = ambiente();
    amb.enviar();
    const [p] = amb.listar();
    expect(amb.chamar('pedidos.recusar', { id: p.id, motivo: ' ' }, { token: amb.gestor })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
    expect((amb.chamar('pedidos.recusar', { id: p.id, motivo: 'Teatro ocupado nas datas.' }, { token: amb.gestor }) as Ok<PedidoDatas>).dados).toMatchObject({ status: 'recusado', motivoRecusa: 'Teatro ocupado nas datas.' });

    const ctx = { portas: amb.portas, eu: null, idRequisicao: '' };
    expect(limparDadosPessoais(ctx).pedidos).toBe(0);
    amb.relogio.definir('2027-05-01T10:00');
    expect(limparDadosPessoais(ctx).pedidos).toBe(1);
    const [depois] = (amb.chamar('pedidos.listar', null, { token: amb.token('p01') }) as Ok<PedidoDatas[]>).dados;
    expect(depois).toMatchObject({ solicitante: { razaoSocial: 'Produtora Exemplo Ltda', documento: '' }, responsavel: { nome: 'Pessoa Responsável', cpf: '', email: '', telefone: '' } });
  });
});
