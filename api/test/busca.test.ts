import type { Config } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersBusca } from '../src/acoes/busca';
import { handlersSistema } from '../src/acoes/sistema';
import { iaMemoria } from '../src/adaptadores/memoria';
import { lerResposta, montarPedido } from '../src/busca/gemini';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
type Resposta = { consulta: unknown; ajuda: string | null; motivo: string | null };
const chamada = (name: string, args: object) => ({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] });
const texto = (t: string) => ({ candidates: [{ content: { parts: [{ text: t }] } }] });

describe('pedido e resposta do Gemini', () => {
  it('o pedido leva só a pergunta (cortada), as funções, o manual e a data — nenhum dado do sistema', () => {
    const p = montarPedido(`quem trabalha sábado? ${'x'.repeat(600)}`, '2026-10-24', 'MANUAL DE USO');
    const corpo = JSON.stringify(p);
    const pergunta = (p as { contents: { parts: { text: string }[] }[] }).contents[0].parts[0].text;
    expect(pergunta.length).toBe(500);
    expect(corpo).toContain('escalaDoDia');
    expect(corpo).toContain('MANUAL DE USO');
    expect(corpo).toContain('2026-10-24');
  });

  it('chamada de função conhecida vira consulta; desconhecida ou inválida não', () => {
    expect(lerResposta(chamada('escalaDoDia', { data: '2026-12-05' }))).toEqual({ consulta: { nome: 'escalaDoDia', data: '2026-12-05' }, ajuda: null });
    expect(lerResposta(chamada('ocorrenciasAbertas', { termo: 'vazamento' })).consulta).toEqual({ nome: 'ocorrenciasAbertas', termo: 'vazamento' });
    expect(lerResposta(chamada('proximosEventos', {})).consulta).toEqual({ nome: 'proximosEventos' });
    expect(lerResposta(chamada('apagarTudo', {})).consulta).toBeNull();
    expect(lerResposta(chamada('escalaDoDia', { data: 'sábado' })).consulta).toBeNull();
    expect(lerResposta(chamada('saldoItem', { termo: ' ' })).consulta).toBeNull();
    expect(lerResposta({ lixo: true })).toEqual({ consulta: null, ajuda: null });
  });

  it('texto vira ajuda', () => {
    expect(lerResposta(texto('Abra Perfil e use Trocar senha.'))).toEqual({ consulta: null, ajuda: 'Abra Perfil e use Trocar senha.' });
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
    expect(amb.perguntar('onde faltam bolsistas?').dados).toEqual({ consulta: { nome: 'vagasFaltando' }, ajuda: null, motivo: null });
    expect(JSON.stringify(amb.ia.pedidos[0])).not.toMatch(/Gestora Teste|gestor@ufsm|1000000001/);
  });

  it('sem chave configurada responde indisponível', () => {
    expect(ambiente(null).perguntar('quem trabalha hoje?').dados).toEqual({ consulta: null, ajuda: null, motivo: 'indisponivel' });
  });

  it('Gemini com erro responde indisponível, sem erro para a pessoa', () => {
    expect(ambiente(new Error('HTTP 429')).perguntar('quem trabalha hoje?').dados).toEqual({ consulta: null, ajuda: null, motivo: 'indisponivel' });
  });

  it('limite diário por pessoa', () => {
    const amb = ambiente(chamada('proximosEventos', {}));
    const cfg = (amb.chamar('config.obter', null, { token: amb.gestor }) as Ok<Config>).dados;
    amb.chamar('config.salvar', { ...cfg, limitePerguntasDia: 2 }, { token: amb.gestor });
    amb.perguntar('próximos eventos?');
    amb.perguntar('próximos eventos?');
    expect(amb.perguntar('próximos eventos?').dados).toEqual({ consulta: null, ajuda: null, motivo: 'limite' });
    expect(amb.ia.pedidos).toHaveLength(2);
  });

  it('bolsista sem o módulo de busca não pergunta', () => {
    const amb = ambiente(chamada('proximosEventos', {}));
    expect(amb.chamar('busca.interpretar', { pergunta: 'x' }, { token: amb.token('p02') })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });
});
