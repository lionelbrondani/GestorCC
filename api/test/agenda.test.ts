import type { Evento, Sessao } from '@shared';
import { describe, expect, it } from 'vitest';
import { evento, sessao } from '../../shared/src/teste/fabricas';
import { handlersEventos } from '../src/acoes/eventos';
import { agendaMemoria } from '../src/adaptadores/memoria';
import { eventoDaAgenda } from '../src/agenda/eventoAgenda';
import { sincronizarPendentes } from '../src/agenda/sincronizar';
import { criarAmbiente } from './apoio';

const ev = (p: Partial<Evento> = {}) =>
  evento({ id: 'e1', nome: 'Formatura Medicina', organizador: 'Comissão Teste', contatoOrganizador: '(55) 91234-5678', ...p });
const ses = (p: Partial<Sessao> = {}) =>
  sessao({ eventoId: 'e1', data: '2026-12-05', rotulo: 'Manhã', chegada: '07:30', inicio: '08:00', fim: '12:00', ...p });
const opcoes = { responsavel: 'Servidora Teste', linkApp: 'https://gestorcc.exemplo.app', convidados: [] };

describe('eventoDaAgenda', () => {
  it('título, horário e descrição sem dados pessoais', () => {
    const g = eventoDaAgenda(ev(), ses(), opcoes);
    expect(g.titulo).toBe('Formatura Medicina – Manhã');
    expect(g.quando).toEqual({ diaInteiro: false, inicio: '2026-12-05T08:00', fim: '2026-12-05T12:00' });
    expect(g.descricao).toBe(
      'Organizador: Comissão Teste\nServidor responsável: Servidora Teste\nChegada da equipe: 07:30\nVer no GestorCC: https://gestorcc.exemplo.app/agenda/e1',
    );
    expect(g.descricao).not.toContain('91234');
    expect(g.convidados).toEqual([]);
  });

  it('horário a definir vira dia inteiro', () => {
    const g = eventoDaAgenda(ev(), ses({ horarioADefinir: true, chegada: null, inicio: null, fim: null }), { ...opcoes, linkApp: null });
    expect(g.titulo).toBe('Formatura Medicina – Manhã (horário a definir)');
    expect(g.quando).toEqual({ diaInteiro: true, dia: '2026-12-05' });
    expect(g.descricao).toContain('Chegada da equipe: a definir');
    expect(g.descricao).not.toContain('Ver no GestorCC');
  });

  it('sessão que passa da meia-noite termina no dia seguinte', () => {
    const g = eventoDaAgenda(ev(), ses({ inicio: '22:00', fim: '01:00' }), opcoes);
    expect(g.quando).toEqual({ diaInteiro: false, inicio: '2026-12-05T22:00', fim: '2026-12-06T01:00' });
  });

  it('sem fim dura 1 hora; sem início usa a chegada', () => {
    expect(eventoDaAgenda(ev(), ses({ fim: null }), opcoes).quando).toEqual({ diaInteiro: false, inicio: '2026-12-05T08:00', fim: '2026-12-05T09:00' });
    expect(eventoDaAgenda(ev(), ses({ inicio: null, fim: null }), opcoes).quando).toEqual({
      diaInteiro: false, inicio: '2026-12-05T07:30', fim: '2026-12-05T08:30',
    });
    expect(eventoDaAgenda(ev(), ses({ inicio: '23:30', fim: null }), opcoes).quando).toEqual({
      diaInteiro: false, inicio: '2026-12-05T23:30', fim: '2026-12-06T00:30',
    });
  });

  it('cancelado ganha o prefixo', () => {
    expect(eventoDaAgenda(ev(), ses({ status: 'cancelada' }), opcoes).titulo).toBe('CANCELADO – Formatura Medicina – Manhã');
    expect(eventoDaAgenda(ev({ status: 'cancelado' }), ses({ rotulo: undefined }), opcoes).titulo).toBe('CANCELADO – Formatura Medicina');
  });
});

describe('sincronização com a agenda do setor', () => {
  const evNovo = (p: Partial<Evento> = {}): Evento => ({ ...ev(p), id: '', ...p }) as Evento;
  const sesNova = (p: Partial<Sessao> = {}): Sessao => ({ ...ses(p), id: '', eventoId: '' });

  function ambiente(ligada = true) {
    const agenda = agendaMemoria(ligada);
    const amb = criarAmbiente({ handlers: handlersEventos, agenda });
    const token = amb.token('p01');
    const salvar = (e: Evento, s: Sessao[]) => amb.chamar('eventos.salvar', { evento: e, sessoes: s }, { token }) as { ok: true; dados: { evento: Evento; sessoes: Sessao[] } };
    const linhas = () => amb.repo.listar<{ id: string; googleEventoId: string; agendaPendente: boolean }>('sessoes');
    return { ...amb, agenda, token, salvar, linhas };
  }

  it('salvar evento cria um evento por sessão e guarda o id do Google', () => {
    const amb = ambiente();
    amb.salvar(evNovo(), [sesNova(), sesNova({ data: '2026-12-06' })]);
    expect(amb.agenda.eventos.size).toBe(2);
    expect(amb.linhas().every((l) => l.googleEventoId && !l.agendaPendente)).toBe(true);
  });

  it('alterar a sessão atualiza o mesmo evento, sem criar outro', () => {
    const amb = ambiente();
    const r = amb.salvar(evNovo(), [sesNova()]).dados;
    const gid = amb.linhas()[0].googleEventoId;
    amb.salvar(r.evento, [{ ...r.sessoes[0], inicio: '09:00' }]);
    expect(amb.agenda.eventos.size).toBe(1);
    expect(amb.agenda.eventos.get(gid)!.quando).toMatchObject({ inicio: '2026-12-05T09:00' });
  });

  it('cancelar evento atualiza o título no Google', () => {
    const amb = ambiente();
    const r = amb.salvar(evNovo(), [sesNova()]).dados;
    amb.chamar('eventos.cancelar', { eventoId: r.evento.id, justificativa: 'Chuva' }, { token: amb.token });
    expect([...amb.agenda.eventos.values()][0].titulo).toBe('CANCELADO – Formatura Medicina – Manhã');
  });

  it('sessão removida some do Google', () => {
    const amb = ambiente();
    const r = amb.salvar(evNovo(), [sesNova(), sesNova({ data: '2026-12-06' })]).dados;
    const fica = r.sessoes.find((s) => s.data === '2026-12-05')!;
    amb.salvar(r.evento, [fica]);
    expect(amb.agenda.eventos.size).toBe(1);
  });

  it('Google fora do ar: a gravação vale e a sessão fica pendente até o gatilho', () => {
    const amb = ambiente();
    amb.agenda.falhar = true;
    expect(amb.salvar(evNovo(), [sesNova()]).ok).toBe(true);
    expect(amb.linhas()[0].agendaPendente).toBe(true);
    amb.agenda.falhar = false;
    expect(sincronizarPendentes(amb.portas)).toBe(1);
    expect(amb.linhas()[0]).toMatchObject({ agendaPendente: false });
    expect(amb.agenda.eventos.size).toBe(1);
  });

  it('agenda não criada: nada é enviado e nada fica pendente', () => {
    const amb = ambiente(false);
    amb.salvar(evNovo(), [sesNova()]);
    expect(amb.agenda.eventos.size).toBe(0);
    expect(amb.linhas()[0].agendaPendente).toBe(false);
  });
});
