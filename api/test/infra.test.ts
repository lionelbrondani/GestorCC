import type { Ocorrencia } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersInfra } from '../src/acoes/infra';
import { arquivosMemoria, formularioMemoria } from '../src/adaptadores/memoria';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
const FOTO = 'data:image/jpeg;base64,QUJD';

function ambiente(respostas: Record<string, unknown>[] | null = null) {
  const arquivos = arquivosMemoria();
  const formulario = formularioMemoria(respostas);
  const amb = criarAmbiente({ handlers: handlersInfra, arquivos, formulario });
  // terceira pessoa, sem acesso a infraestrutura
  amb.repo.inserir('pessoas', { ...amb.repo.listar<{ id: string }>('pessoas').find((p) => p.id === 'p02')!, id: 'p03', nome: 'Outra Pessoa', nomeCurto: 'OUTRA', emailAcademico: 'outra@acad.ufsm.br' });
  amb.repo.inserir('credenciais', { id: 'p03', hash: '', sal: '', iteracoes: 1, senhaInicial: false, versaoToken: 1, falhas: 0, bloqueadoAte: '' });
  const gestor = amb.token('p01');
  const bolsista = amb.token('p02');
  const relatar = (p: Record<string, unknown> = {}, token = bolsista) =>
    amb.chamar('infra.relatar', { titulo: 'Torneira pingando', descricao: 'No banheiro masculino', categoria: 'Hidráulica', local: 'Banheiros', prioridade: 'media', foto: FOTO, ...p } as never, { token });
  const atualizar = (d: Record<string, unknown>) => amb.chamar('infra.atualizar', { observacao: '', ...d } as never, { token: gestor });
  const avisos = (pessoaId: string) => amb.repo.listar<{ id: string; pessoaId: string; texto: string; link: string }>('notificacoes').filter((n) => n.pessoaId === pessoaId);
  return { ...amb, arquivos, formulario, gestor, bolsista, relatar, atualizar, avisos };
}

describe('ocorrências do prédio', () => {
  it('relatar cria #1 com foto no Drive, avisa quem gerencia e aparece em Meus relatos', () => {
    const amb = ambiente();
    const o = (amb.relatar() as Ok<Ocorrencia>).dados;
    expect(o).toMatchObject({ numero: 1, status: 'nova', origem: 'app', relatorPessoaId: 'p02', relatorNome: 'Bolsista Teste', foto: null, temFoto: true });
    expect(amb.arquivos.arquivos.size).toBe(1);
    expect(amb.avisos('p01')[0]).toMatchObject({ texto: 'Nova ocorrência #1: Torneira pingando (Banheiros).', link: `/infra/${o.id}` });
    expect((amb.relatar({ titulo: 'Lâmpada queimada', foto: null }) as Ok<Ocorrencia>).dados.numero).toBe(2);
    expect((amb.chamar('infra.listar', null, { token: amb.bolsista }) as Ok<Ocorrencia[]>).dados).toHaveLength(2);
    expect((amb.chamar('infra.listar', null, { token: amb.token('p03') }) as Ok<Ocorrencia[]>).dados).toHaveLength(0);
    expect((amb.chamar('infra.listar', null, { token: amb.gestor }) as Ok<Ocorrencia[]>).dados).toHaveLength(2);
  });

  it('relato exige o que aconteceu e onde', () => {
    const amb = ambiente();
    expect(amb.relatar({ titulo: ' ' })).toMatchObject({ erro: { codigo: 'TITULO', mensagem: 'Conte em poucas palavras o que aconteceu.' } });
    expect(amb.relatar({ local: '' })).toMatchObject({ erro: { codigo: 'LOCAL', mensagem: 'Informe onde está o problema.' } });
  });

  it('a foto vai para o gestor e para quem relatou, não para os outros', () => {
    const amb = ambiente();
    const o = (amb.relatar() as Ok<Ocorrencia>).dados;
    expect(amb.chamar('infra.foto', { id: o.id }, { token: amb.gestor })).toEqual({ ok: true, dados: FOTO });
    expect(amb.chamar('infra.foto', { id: o.id }, { token: amb.bolsista })).toEqual({ ok: true, dados: FOTO });
    expect(amb.chamar('infra.foto', { id: o.id }, { token: amb.token('p03') })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('transições validadas, com histórico e aviso a quem relatou', () => {
    const amb = ambiente();
    const o = (amb.relatar() as Ok<Ocorrencia>).dados;
    expect(amb.atualizar({ id: o.id, para: 'analise' }).ok).toBe(true);
    expect(amb.atualizar({ id: o.id, para: 'chamado' })).toMatchObject({ erro: { codigo: 'TRANSICAO' } });
    const r = amb.atualizar({ id: o.id, para: 'chamado', chamadoNumero: '2026/123' }) as Ok<Ocorrencia>;
    expect(r.dados).toMatchObject({ status: 'chamado', chamadoNumero: '2026/123', chamadoAbertoEm: '2026-10-24T10:00' });
    expect(r.dados.historico.map((h) => [h.de, h.para])).toEqual([['nova', 'analise'], ['analise', 'chamado']]);
    expect(amb.avisos('p02').map((n) => n.texto).join(' ')).toContain('Sua ocorrência #1 (Torneira pingando) agora está:');
    const outra = (amb.relatar({ titulo: 'Outra' }) as Ok<Ocorrencia>).dados;
    expect(amb.atualizar({ id: outra.id, para: 'naoProcede', observacao: ' ' })).toMatchObject({ erro: { codigo: 'TRANSICAO' } });
  });

  it('quem gerencia corrige prioridade, tipo e local; bolsista não', () => {
    const amb = ambiente();
    const o = (amb.relatar() as Ok<Ocorrencia>).dados;
    expect((amb.atualizar({ id: o.id, prioridade: 'urgente', categoria: 'Elétrica', local: 'Palco' }) as Ok<Ocorrencia>).dados).toMatchObject({ prioridade: 'urgente', categoria: 'Elétrica', local: 'Palco', status: 'nova' });
    expect(amb.chamar('infra.atualizar', { id: o.id, observacao: 'x' }, { token: amb.bolsista })).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('formulário de problemas', () => {
  const respostas = [
    { 'Carimbo de data/hora': '24/10/2026 09:12:00', 'Nome completo': 'Visitante Teste', 'E-mail': 'visitante@exemplo.com', 'Local do problema': 'Plateia', 'Tipo de problema': 'Iluminação', 'Descreva o problema': 'Lâmpada piscando na fileira C', 'É urgente?': 'Não' },
    { 'Carimbo de data/hora': '24/10/2026 09:30:00', 'Nome completo': 'Outro Visitante', 'E-mail': '', 'Local do problema': 'Hall de entrada', 'Tipo de problema': 'Hidráulica', 'Descreva o problema': 'Vazamento perto do bebedouro', 'É urgente?': 'Sim' },
  ];

  it('importa respostas novas uma única vez', () => {
    const amb = ambiente(respostas);
    expect(amb.chamar('infra.importarFormulario', null, { token: amb.gestor })).toEqual({ ok: true, dados: { importadas: 2 } });
    expect(amb.chamar('infra.importarFormulario', null, { token: amb.gestor })).toEqual({ ok: true, dados: { importadas: 0 } });
    const lista = (amb.chamar('infra.listar', null, { token: amb.gestor }) as Ok<Ocorrencia[]>).dados;
    const vazamento = lista.find((o) => o.local === 'Hall de entrada')!;
    expect(vazamento).toMatchObject({ origem: 'formulario', relatorNome: 'Outro Visitante', categoria: 'Hidráulica', prioridade: 'urgente', titulo: 'Vazamento perto do bebedouro' });
    expect(lista.find((o) => o.local === 'Plateia')).toMatchObject({ prioridade: 'media', relatorContato: 'visitante@exemplo.com' });
  });

  it('sem planilha configurada, o botão avisa', () => {
    const amb = ambiente(null);
    expect(amb.chamar('infra.importarFormulario', null, { token: amb.gestor })).toEqual({
      ok: false, erro: { codigo: 'FORMULARIO', mensagem: 'Configure a planilha do formulário (propriedade FORMULARIO_INFRA_ID).' },
    });
  });
});
