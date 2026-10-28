import type { Config } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersBusca } from '../src/acoes/busca';
import { handlersSistema } from '../src/acoes/sistema';
import { iaMemoria } from '../src/adaptadores/memoria';
import { lerResposta, montarPedido } from '../src/busca/gemini';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
type Resposta = { consulta: unknown; consultas: unknown[]; ajuda: string | null; motivo: string | null };
const chamadas = (...lista: [string, object][]) => ({ candidates: [{ content: { parts: lista.map(([name, args]) => ({ functionCall: { name, args } })) } }] });
const chamada = (name: string, args: object) => chamadas([name, args]);
const texto = (t: string) => ({ candidates: [{ content: { parts: [{ text: t }] } }] });

describe('pedido e resposta do Gemini', () => {
  it('o pedido leva só a pergunta (cortada), as funções, o manual, as informações do setor e a data — nenhum dado do sistema', () => {
    const p = montarPedido(`quem trabalha sábado? ${'x'.repeat(600)}`, '2026-10-24', 'MANUAL DE USO', 'O teatro tem 1.170 lugares.');
    const corpo = JSON.stringify(p);
    const pergunta = (p as { contents: { parts: { text: string }[] }[] }).contents[0].parts[0].text;
    expect(pergunta.length).toBe(500);
    expect(corpo).toContain('escalaDoDia');
    expect(corpo).toContain('"analise"');
    expect(corpo).toContain('MANUAL DE USO');
    expect(corpo).toContain('O teatro tem 1.170 lugares.');
    expect(corpo).toContain('2026-10-24');
    const longo = JSON.stringify(montarPedido('x', '2026-10-24', 'M', 'y'.repeat(3000)));
    expect(longo).toContain('y'.repeat(2000));
    expect(longo).not.toContain('y'.repeat(2001));
  });

  it('chamada de função conhecida vira consulta; desconhecida ou inválida não', () => {
    expect(lerResposta(chamada('escalaDoDia', { data: '2026-12-05' }))).toEqual({
      consulta: { nome: 'escalaDoDia', data: '2026-12-05' }, consultas: [{ nome: 'escalaDoDia', data: '2026-12-05' }], ajuda: null,
    });
    expect(lerResposta(chamada('ocorrenciasAbertas', { termo: 'vazamento' })).consulta).toEqual({ nome: 'ocorrenciasAbertas', termo: 'vazamento' });
    expect(lerResposta(chamada('proximosEventos', {})).consulta).toEqual({ nome: 'proximosEventos' });
    expect(lerResposta(chamada('apagarTudo', {})).consulta).toBeNull();
    expect(lerResposta(chamada('escalaDoDia', { data: 'sábado' })).consulta).toBeNull();
    expect(lerResposta(chamada('saldoItem', { termo: ' ' })).consulta).toBeNull();
    expect(lerResposta({ lixo: true })).toEqual({ consulta: null, consultas: [], ajuda: null });
  });

  it('perguntas complexas: análise montável, e até 3 consultas numa pergunta com várias partes', () => {
    const r = lerResposta(chamadas(['analise', { assunto: 'escalas', agrupar: 'pessoa', de: '2026-10-01', ate: '2026-10-31' }], ['analise', { assunto: 'pagamentos', agrupar: 'mes' }]));
    expect(r.consultas).toEqual([
      expect.objectContaining({ nome: 'analise', assunto: 'escalas', agrupar: 'pessoa', de: '2026-10-01' }),
      expect.objectContaining({ nome: 'analise', assunto: 'pagamentos', agrupar: 'mes', medida: 'valor' }),
    ]);
    expect(r.consulta).toEqual(r.consultas[0]);
    const muitas = lerResposta(chamadas(['proximosEventos', {}], ['vagasFaltando', {}], ['estoqueCritico', {}], ['lotesEmAberto', {}]));
    expect(muitas.consultas).toHaveLength(3);
  });

  it('texto vira ajuda', () => {
    expect(lerResposta(texto('Abra Perfil e use Trocar senha.'))).toEqual({ consulta: null, consultas: [], ajuda: 'Abra Perfil e use Trocar senha.' });
  });
});

describe('busca.interpretar', () => {
  function ambiente(resposta: unknown) {
    const ia = iaMemoria(resposta);
    const amb = criarAmbiente({ handlers: { ...handlersBusca, ...handlersSistema }, ia });
    const gestor = amb.token('p01');
    const perguntar = (pergunta: string) => amb.chamar('busca.interpretar', { pergunta }, { token: gestor }) as Ok<Resposta>;
    return { ...amb, ia, gestor, perguntar };
  }

  it('devolve a consulta do Gemini', () => {
    const amb = ambiente(chamada('vagasFaltando', {}));
    expect(amb.perguntar('onde faltam bolsistas?').dados).toEqual({ consulta: { nome: 'vagasFaltando' }, consultas: [{ nome: 'vagasFaltando' }], ajuda: null, motivo: null });
    expect(JSON.stringify(amb.ia.pedidos[0])).not.toMatch(/Gestora Teste|gestor@ufsm|1000000001/);
  });

  it('as informações do setor, de Configurações, vão junto para responder perguntas sobre o Centro de Convenções', () => {
    const amb = ambiente(texto('O teatro tem 1.170 lugares.'));
    const cfg = (amb.chamar('config.obter', null, { token: amb.gestor }) as Ok<Config>).dados;
    amb.chamar('config.salvar', { ...cfg, informacoesSetor: 'Capacidade do teatro: 1.170 lugares.' }, { token: amb.gestor });
    expect(amb.perguntar('qual a capacidade do teatro?').dados.ajuda).toBe('O teatro tem 1.170 lugares.');
    expect(JSON.stringify(amb.ia.pedidos[0])).toContain('Capacidade do teatro: 1.170 lugares.');
  });

  it('sem chave configurada responde indisponível', () => {
    expect(ambiente(null).perguntar('quem trabalha hoje?').dados).toEqual({ consulta: null, consultas: [], ajuda: null, motivo: 'indisponivel' });
  });

  it('Gemini com erro responde indisponível, sem erro para a pessoa', () => {
    expect(ambiente(new Error('HTTP 429')).perguntar('quem trabalha hoje?').dados).toEqual({ consulta: null, consultas: [], ajuda: null, motivo: 'indisponivel' });
  });

  it('limite diário por pessoa', () => {
    const amb = ambiente(chamada('proximosEventos', {}));
    const cfg = (amb.chamar('config.obter', null, { token: amb.gestor }) as Ok<Config>).dados;
    amb.chamar('config.salvar', { ...cfg, limitePerguntasDia: 2 }, { token: amb.gestor });
    amb.perguntar('próximos eventos?');
    amb.perguntar('próximos eventos?');
    expect(amb.perguntar('próximos eventos?').dados).toEqual({ consulta: null, consultas: [], ajuda: null, motivo: 'limite' });
    expect(amb.ia.pedidos).toHaveLength(2);
  });

  it('bolsista sem o módulo de busca não pergunta', () => {
    const amb = ambiente(chamada('proximosEventos', {}));
    expect(amb.chamar('busca.interpretar', { pergunta: 'x' }, { token: amb.token('p02') })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });
});
