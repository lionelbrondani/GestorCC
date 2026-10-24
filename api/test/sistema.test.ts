import type { Config, Feriado, RegistroHistorico } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersAvisos } from '../src/acoes/avisos';
import { CONFIG_PADRAO, handlersSistema } from '../src/acoes/sistema';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
const ambiente = () => criarAmbiente({ handlers: { ...handlersSistema, ...handlersAvisos } });

describe('configurações', () => {
  it('sem nada salvo devolve o padrão do spec; depois devolve o salvo', () => {
    const amb = ambiente();
    const t = amb.token('p01');
    const padrao = (amb.chamar('config.obter', null, { token: t }) as Ok<Config>).dados;
    expect(padrao).toMatchObject({ diariaPadrao: 8000, vagasBolsistasPadrao: 8, vagasServidoresPadrao: 1, minimoExperientesPadrao: 1, projetoFundep: '30055' });
    expect(padrao.agendaSetor.conectada).toBe(false);
    amb.chamar('config.salvar', { ...padrao, diariaPadrao: 9000 }, { token: t });
    expect((amb.chamar('config.obter', null, { token: t }) as Ok<Config>).dados.diariaPadrao).toBe(9000);
    expect(CONFIG_PADRAO.diariaPadrao).toBe(8000);
  });

  it('bolsista não altera configurações', () => {
    const amb = ambiente();
    expect(amb.chamar('config.salvar', CONFIG_PADRAO, { token: amb.token('p02') })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('feriados', () => {
  it('salvar substitui só os feriados do ano', () => {
    const amb = ambiente();
    const t = amb.token('p01');
    amb.chamar('feriados.salvar', { ano: 2027, feriados: [{ data: '2027-01-01', nome: 'Confraternização' }] }, { token: t });
    amb.chamar('feriados.salvar', { ano: 2026, feriados: [{ data: '2026-11-02', nome: 'Finados' }, { data: '2026-11-15', nome: 'República' }] }, { token: t });
    amb.chamar('feriados.salvar', { ano: 2026, feriados: [{ data: '2026-11-02', nome: 'Finados' }] }, { token: t });
    const de = (ano: number) => (amb.chamar('feriados.listar', { ano }, { token: t }) as Ok<Feriado[]>).dados;
    expect(de(2026)).toEqual([{ data: '2026-11-02', nome: 'Finados' }]);
    expect(de(2027)).toHaveLength(1);
  });
});

describe('histórico e ping', () => {
  it('histórico só para quem gerencia, mais recentes primeiro', () => {
    const amb = ambiente();
    const t = amb.token('p01');
    amb.chamar('feriados.salvar', { ano: 2026, feriados: [] }, { token: t });
    amb.relogio.avancarMinutos(1);
    amb.chamar('config.salvar', CONFIG_PADRAO, { token: t });
    const h = (amb.chamar('historico.listar', {}, { token: t }) as Ok<RegistroHistorico[]>).dados;
    expect(h[0].acao).toBe('alterou configurações');
    expect(amb.chamar('historico.listar', {}, { token: amb.token('p02') })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('ping responde sem login', () => {
    const amb = ambiente();
    expect(amb.chamar('sistema.ping', null)).toEqual({ ok: true, dados: { versao: '0.1.1' } });
  });
});
