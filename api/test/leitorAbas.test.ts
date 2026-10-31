import { describe, expect, it } from 'vitest';
import { cacheMemoria, propriedadesMemoria, relogioFixo } from '../src/adaptadores/memoria';
import type { NomeTabela, Planilha } from '../src/nucleo/portas';
import { cabecalhos, ESQUEMA } from '../src/tabelas/esquema';
import { criarLeitorAbas, novaEpocaCache, type LerPlanilha } from '../src/tabelas/leitorAbas';
import { objetoParaLinha } from '../src/tabelas/serializacao';

type Obj = Record<string, unknown> & { id: string };

function folha(t: NomeTabela, objs: Obj[]): unknown[][] {
  return [cabecalhos(t), ...objs.map((o) => objetoParaLinha(t, cabecalhos(t), o))];
}

/** Planilhas de mentira: guarda os valores de cada aba e cada chamada de leitura. */
function ambiente(inicial: Partial<Record<NomeTabela, Obj[]>> = {}) {
  const abas: Partial<Record<NomeTabela, unknown[][]>> = {};
  for (const [t, objs] of Object.entries(inicial)) abas[t as NomeTabela] = folha(t as NomeTabela, objs!);
  const chamadas: { planilha: Planilha; abas: NomeTabela[] }[] = [];
  const ler: LerPlanilha = (planilha, pedidas) => {
    chamadas.push({ planilha, abas: [...pedidas] });
    const r: Partial<Record<NomeTabela, unknown[][]>> = {};
    for (const t of pedidas) if (abas[t] && ESQUEMA[t].planilha === planilha) r[t] = JSON.parse(JSON.stringify(abas[t]));
    return r;
  };
  const cache = cacheMemoria();
  const props = propriedadesMemoria();
  const relogio = relogioFixo('2026-10-25T10:00');
  const leitor = () => criarLeitorAbas({ cache, props, agoraMs: relogio.agoraMs, ler, versaoApi: '9.9.9' });
  const lidas = (t: NomeTabela) => chamadas.filter((c) => c.abas.includes(t)).length;
  return { abas, chamadas, cache, props, relogio, leitor, lidas, epoca: () => novaEpocaCache(props, relogio.agoraMs) };
}

const ana = { id: 'p1', nome: 'Ana', ativo: true };
const bia = { id: 'p2', nome: 'Bia', ativo: true };

describe('leitor de abas com cache', () => {
  it('a segunda requisição lê do cache, sem abrir a planilha', () => {
    const amb = ambiente({ pessoas: [ana] });
    amb.epoca();
    expect(amb.leitor().aba('pessoas').linhas.map((p) => p.nome)).toEqual(['Ana']);
    const segunda = amb.leitor().aba('pessoas');
    expect(segunda.linhas).toEqual([expect.objectContaining({ id: 'p1', nome: 'Ana', ativo: true })]);
    expect(segunda.cab).toEqual(cabecalhos('pessoas'));
    expect(amb.lidas('pessoas')).toBe(1);
  });

  it('na primeira leitura, as abas que faltam da mesma planilha vêm numa chamada só (menos o histórico)', () => {
    const amb = ambiente({ pessoas: [ana], eventos: [], historico: [] });
    amb.epoca();
    const l = amb.leitor();
    l.aba('pessoas');
    l.aba('eventos');
    expect(amb.chamadas).toHaveLength(1);
    expect(amb.chamadas[0].abas).toEqual(expect.arrayContaining(['pessoas', 'eventos', 'sessoes', 'escalas']));
    expect(amb.chamadas[0].abas).not.toContain('historico');
    expect(amb.chamadas[0].abas).not.toContain('credenciais'); // outra planilha
  });

  it('depois de uma escrita, a próxima requisição vê o dado novo sem reler a planilha', () => {
    const amb = ambiente({ pessoas: [ana] });
    amb.epoca();
    amb.leitor().aba('pessoas');
    const w = amb.leitor();
    w.descartar();
    const a = w.aba('pessoas');
    w.antesDeEscrever('pessoas');
    a.linhas.push({ ...bia, numero: 'campo fora do esquema' });
    w.concluirEscrita();
    const depois = amb.leitor().aba('pessoas').linhas;
    expect(depois.map((p) => p.nome)).toEqual(['Ana', 'Bia']);
    expect(depois[1]).not.toHaveProperty('numero');
    expect(amb.lidas('pessoas')).toBe(1);
  });

  it('a gravação devolvida ao cache fica como a planilha devolveria (texto, número, json)', () => {
    const amb = ambiente({ lotes: [] });
    amb.epoca();
    const w = amb.leitor();
    const a = w.aba('lotes');
    w.antesDeEscrever('lotes');
    a.linhas.push({ id: 'l1', titulo: 2026 });
    w.concluirEscrita();
    expect(amb.leitor().aba('lotes').linhas[0].titulo).toBe('2026');
  });

  it('leitura feita enquanto outra requisição escreve não vai para o cache', () => {
    const amb = ambiente({ eventos: [], credenciais: [] });
    amb.epoca();
    const w = amb.leitor();
    w.aba('credenciais');
    w.antesDeEscrever('credenciais');
    amb.leitor().aba('eventos');
    amb.leitor().aba('eventos');
    expect(amb.lidas('eventos')).toBe(2);
  });

  it('marca de escrita esquecida há mais de 6 minutos é ignorada', () => {
    const amb = ambiente({ eventos: [], credenciais: [] });
    amb.epoca();
    const w = amb.leitor();
    w.aba('credenciais');
    w.antesDeEscrever('credenciais'); // nunca conclui (a execução caiu)
    amb.relogio.avancarMinutos(7);
    amb.leitor().aba('eventos');
    amb.leitor().aba('eventos');
    expect(amb.lidas('eventos')).toBe(1);
  });

  it('descartar faz reler a versão: a escrita de outra requisição aparece', () => {
    const amb = ambiente({ pessoas: [ana] });
    amb.epoca();
    const r = amb.leitor();
    r.aba('pessoas');
    const w = amb.leitor();
    const a = w.aba('pessoas');
    w.antesDeEscrever('pessoas');
    a.linhas.push(bia);
    w.concluirEscrita();
    expect(r.aba('pessoas').linhas).toHaveLength(1); // mesma requisição: o que já leu
    r.descartar();
    expect(r.aba('pessoas').linhas).toHaveLength(2);
  });

  it('sem época (antes do instalar) nada vai para o cache e só a aba pedida é lida', () => {
    const amb = ambiente({ pessoas: [ana] });
    amb.leitor().aba('pessoas');
    amb.leitor().aba('pessoas');
    expect(amb.chamadas).toEqual([
      { planilha: 'dados', abas: ['pessoas'] },
      { planilha: 'dados', abas: ['pessoas'] },
    ]);
  });

  it('dados pessoais e contratantes nunca vão para o cache', () => {
    const amb = ambiente({ dadosPessoais: [{ id: 'p1', cpf: '01234567890' }], contratantes: [], credenciais: [] });
    amb.epoca();
    amb.leitor().aba('dadosPessoais');
    amb.leitor().aba('dadosPessoais');
    amb.leitor().aba('contratantes');
    amb.leitor().aba('contratantes');
    expect(amb.lidas('dadosPessoais')).toBe(2);
    expect(amb.lidas('contratantes')).toBe(2);
    expect(amb.lidas('credenciais')).toBe(1);
  });

  it('aba grande vai em pedaços e volta inteira', () => {
    const muitas = Array.from({ length: 300 }, (_, i) => ({ id: `e${i}`, nome: `Evento ${i} `.padEnd(600, 'ç') }));
    const amb = ambiente({ eventos: muitas });
    amb.epoca();
    amb.leitor().aba('eventos');
    const de_novo = amb.leitor().aba('eventos').linhas;
    expect(de_novo).toHaveLength(300);
    expect(de_novo[299].nome).toBe(muitas[299].nome.trim());
    expect(amb.lidas('eventos')).toBe(1);
  });

  it('nova época (edição direto na planilha) invalida tudo', () => {
    const amb = ambiente({ pessoas: [ana] });
    amb.epoca();
    amb.leitor().aba('pessoas');
    amb.abas.pessoas = folha('pessoas', [{ ...ana, nome: 'Ana Maria' }]);
    amb.epoca();
    expect(amb.leitor().aba('pessoas').linhas[0].nome).toBe('Ana Maria');
  });

  it('aba que não existe na planilha é erro claro', () => {
    const amb = ambiente();
    expect(() => amb.leitor().aba('pessoas')).toThrow('Aba "pessoas" não encontrada (rode instalar()).');
  });

  it('aba vazia (sem cabeçalho) usa o cabeçalho do esquema', () => {
    const amb = ambiente();
    amb.abas.feriados = [];
    expect(amb.leitor().aba('feriados')).toEqual({ cab: cabecalhos('feriados'), linhas: [] });
  });
});
