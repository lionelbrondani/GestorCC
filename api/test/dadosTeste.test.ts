import { describe, expect, it } from 'vitest';
import { handlersAuth } from '../src/acoes/auth';
import { criarDadosFicticios, resetarDados } from '../src/dadosTeste';
import type { NomeTabela } from '../src/nucleo/portas';
import { ESQUEMA } from '../src/tabelas/esquema';
import { criarAmbiente } from './apoio';

function ambiente() {
  const amb = criarAmbiente({ handlers: handlersAuth });
  amb.relogio.definir('2026-11-01T10:00');
  amb.repo.inserir('almoxItens', { id: '0012', cod: '0012', nomeAlmox: 'FITA CREPE', nomeComum: 'Fita crepe', unidade: 'UN', valor: 500, categoria: 'Fitas', qtdMinima: 2, sala: 'A', status: 'Ativo', saldo: 7 });
  amb.repo.inserir('feriados', { id: '2026-11-02', data: '2026-11-02', nome: 'Finados' });
  amb.repo.inserir('config', { id: 'geral', valor: { diariaPadrao: 8000 } });
  amb.repo.inserir('eventos', { id: 'e-velho', nome: 'Evento de teste antigo', status: 'ativo' });
  amb.repo.inserir('sessoes', { id: 's-velha', eventoId: 'e-velho', data: '2026-10-10', googleEventoId: 'g1', status: 'ativa' });
  amb.repo.inserir('historico', { id: 'h1', acao: 'teste' });
  return amb;
}

const contar = (amb: ReturnType<typeof ambiente>, t: NomeTabela) => amb.repo.listar(t).length;

describe('resetar os dados de teste', () => {
  it('mantém só a pessoa indicada, os itens do almoxarifado, as configurações e os feriados', () => {
    const amb = ambiente();
    const removidos: string[] = [];
    amb.portas.agenda.remover = (id: string) => void removidos.push(id);
    resetarDados(amb.portas, 'p01');
    expect(amb.repo.listar<{ id: string }>('pessoas').map((p) => p.id)).toEqual(['p01']);
    expect(amb.repo.listar<{ id: string; pessoaId: string }>('permissoes').every((p) => p.pessoaId === 'p01')).toBe(true);
    expect(amb.repo.listar<{ id: string }>('credenciais').map((c) => c.id)).toEqual(['p01']);
    expect(contar(amb, 'almoxItens')).toBe(1);
    expect(contar(amb, 'feriados')).toBe(1);
    expect(contar(amb, 'config')).toBe(1);
    for (const t of ['eventos', 'sessoes', 'historico'] as NomeTabela[]) expect(contar(amb, t)).toBe(0);
    expect(removidos).toEqual(['g1']);
  });
});

describe('dados fictícios', () => {
  it('cria bastante coisa em todas as áreas, sem ids repetidos, e o reset tira tudo de novo', () => {
    const amb = ambiente();
    resetarDados(amb.portas, 'p01');
    const resumo = criarDadosFicticios(amb.portas);
    expect(resumo.pessoas).toBeGreaterThanOrEqual(15);
    expect(resumo.eventos).toBeGreaterThanOrEqual(12);
    for (const t of ['sessoes', 'rodadas', 'disponibilidades', 'escalas', 'lotes', 'loteItens', 'contratos', 'contratantes', 'aditivos', 'fichas', 'cortesiasDestinos', 'almoxMovimentos', 'ocorrencias', 'avisos', 'avaliacoes'] as NomeTabela[]) {
      expect(contar(amb, t), t).toBeGreaterThan(0);
    }
    for (const t of Object.keys(ESQUEMA) as NomeTabela[]) {
      const ids = amb.repo.listar<{ id: string }>(t).map((x) => x.id);
      expect(new Set(ids).size, t).toBe(ids.length);
    }
    // nenhuma sessão fictícia vai para a agenda Google sozinha
    expect(amb.repo.listar<{ id: string; agendaPendente: boolean; googleEventoId: string }>('sessoes').every((s) => !s.agendaPendente && !s.googleEventoId)).toBe(true);
    // o reset volta ao que era: só os itens reais ficam no almoxarifado
    resetarDados(amb.portas, 'p01');
    expect(amb.repo.listar<{ id: string }>('pessoas').map((p) => p.id)).toEqual(['p01']);
    expect(amb.repo.listar<{ id: string }>('almoxItens').map((i) => i.id)).toEqual(['0012']);
    expect(amb.repo.listar<{ id: string; saldo: number }>('almoxItens')[0].saldo).toBe(7);
    expect(contar(amb, 'eventos')).toBe(0);
  });

  it('as pessoas fictícias entram com o e-mail e a matrícula', () => {
    const amb = ambiente();
    criarDadosFicticios(amb.portas);
    const [b] = amb.repo.listar<{ id: string; emailAcademico: string; matricula: string; tipo: string }>('pessoas').filter((p) => p.tipo === 'bolsista' && p.id.startsWith('demo-'));
    expect(b.emailAcademico).toMatch(/@teste\.invalid$/);
    expect(amb.chamar('auth.entrar', { email: b.emailAcademico, senha: b.matricula })).toMatchObject({ ok: true });
  });
});
