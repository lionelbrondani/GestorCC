import type { Evento, Sessao } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEventos } from '../src/acoes/eventos';
import { criarAmbiente } from './apoio';

type Ok<T> = { ok: true; dados: T };
type Salvo = { evento: Evento; sessoes: Sessao[] };

const evNovo = (p: Partial<Evento> = {}): Evento => ({
  id: '', nome: 'Formatura Teste', tipo: 'Formatura', organizador: 'Comissão Teste', contatoOrganizador: '(55) 90000-0000',
  pagamento: 'interno', instrumento: 'contrato', status: 'ativo', ...p,
});
const sesNova = (p: Partial<Sessao> = {}): Sessao => ({
  id: '', eventoId: '', data: '2026-12-05', rotulo: 'Manhã', chegada: '07:30', inicio: '08:00', fim: '12:00', horarioADefinir: false,
  vagasBolsistas: 8, vagasServidores: 1, diaria: null, minimoExperientes: 1, status: 'ativa', publicadaEm: null, convocacao: null, ...p,
});

function ambiente() {
  const amb = criarAmbiente({ handlers: handlersEventos });
  const gestor = amb.token('p01');
  const salvar = (evento: Evento, sessoes: Sessao[], token = gestor) => amb.chamar('eventos.salvar', { evento, sessoes }, { token });
  const criar = (evento = evNovo(), sessoes = [sesNova()]) => (salvar(evento, sessoes) as Ok<Salvo>).dados;
  const listar = (de = '2026-12-01', ate = '2026-12-31', token = gestor) => (amb.chamar('eventos.listar', { de, ate }, { token }) as Ok<Salvo & { eventos: Evento[] }>).dados;
  return { ...amb, gestor, salvar, criar, listar };
}

describe('eventos.salvar e eventos.listar', () => {
  it('cria evento com duas sessões e devolve o que ficou gravado', () => {
    const amb = ambiente();
    const r = amb.criar(evNovo(), [sesNova(), sesNova({ data: '2026-12-06', rotulo: '', horarioADefinir: true, chegada: null, inicio: null, fim: null })]);
    expect(r.evento.id).toBeTruthy();
    expect(r.evento.status).toBe('ativo');
    expect(r.sessoes.map((s) => s.id).every(Boolean)).toBe(true);
    expect(r.sessoes.every((s) => s.eventoId === r.evento.id)).toBe(true);

    const l = amb.listar();
    expect(l.eventos).toHaveLength(1);
    expect(l.sessoes).toHaveLength(2);
    const aDefinir = l.sessoes.find((s) => s.data === '2026-12-06')!;
    expect(aDefinir.inicio).toBeNull();
    expect(aDefinir.rotulo).toBeUndefined();
    expect(l.eventos[0]).not.toHaveProperty('publicoReal');
    expect(l.eventos[0].atualizadoEm).toBe('2026-10-24T10:00');
    for (const s of l.sessoes) {
      expect(s).not.toHaveProperty('googleEventoId');
      expect(s).not.toHaveProperty('agendaPendente');
    }
  });

  it('listar traz só sessões do período e os eventos delas', () => {
    const amb = ambiente();
    amb.criar(evNovo({ nome: 'Dezembro' }), [sesNova({ data: '2026-12-05' })]);
    amb.criar(evNovo({ nome: 'Janeiro' }), [sesNova({ data: '2027-01-10' })]);
    const l = amb.listar('2026-12-01', '2026-12-31');
    expect(l.eventos.map((e) => e.nome)).toEqual(['Dezembro']);
    expect(l.sessoes.map((s) => s.data)).toEqual(['2026-12-05']);
  });

  it('recusa com a mensagem da validação', () => {
    expect(ambiente().salvar(evNovo({ nome: ' ' }), [sesNova()])).toEqual({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Informe o nome do evento.' } });
  });

  it('segundo gestor com versão antiga recebe CONFLITO', () => {
    const amb = ambiente();
    const r = amb.criar();
    amb.relogio.avancarMinutos(5);
    expect(amb.salvar({ ...r.evento, nome: 'Primeira edição' }, r.sessoes).ok).toBe(true);
    expect(amb.salvar({ ...r.evento, nome: 'Edição atrasada' }, r.sessoes)).toEqual({
      ok: false,
      erro: { codigo: 'CONFLITO', mensagem: 'Gestora Teste alterou este registro às 10:05. Recarregue a tela antes de salvar.' },
    });
  });

  it('sessão de outro evento é recusada e não muda de evento', () => {
    const amb = ambiente();
    const a = amb.criar(evNovo({ nome: 'A' }));
    const b = amb.criar(evNovo({ nome: 'B' }));
    expect(amb.salvar(b.evento, [...b.sessoes, { ...a.sessoes[0] }])).toEqual({
      ok: false,
      erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Sessão não encontrada neste evento.' },
    });
    expect(amb.listar().sessoes.filter((s) => s.eventoId === a.evento.id)).toHaveLength(1);
  });

  it('sessão retirada do formulário é apagada; publicada não', () => {
    const amb = ambiente();
    const r = amb.criar(evNovo(), [sesNova({ data: '2026-12-05' }), sesNova({ data: '2026-12-06' })]);
    const [s5, s6] = [...r.sessoes].sort((x, y) => x.data.localeCompare(y.data));
    const atual = amb.listar().eventos[0];
    expect(amb.salvar(atual, [s5]).ok).toBe(true);
    expect(amb.listar().sessoes.map((s) => s.data)).toEqual(['2026-12-05']);

    const linha = amb.repo.listar<{ id: string }>('sessoes').find((s) => s.id === s5.id)!;
    amb.repo.atualizar('sessoes', { ...linha, publicadaEm: '2026-11-20T09:00' });
    const depois = amb.listar().eventos[0];
    expect(amb.salvar(depois, [sesNova({ data: '2026-12-07' })])).toEqual({
      ok: false,
      erro: { codigo: 'SESSAO_PUBLICADA', mensagem: 'A sessão de 05/12 já foi publicada. Cancele-a em vez de remover.' },
    });
    expect(s6.id).toBeTruthy();
  });

  it('evento cancelado não pode ser editado', () => {
    const amb = ambiente();
    const r = amb.criar();
    const linha = amb.repo.listar<{ id: string }>('eventos')[0];
    amb.repo.atualizar('eventos', { ...linha, status: 'cancelado' });
    const atual = amb.listar().eventos[0];
    expect(amb.salvar({ ...atual, nome: 'Outro nome' }, r.sessoes)).toEqual({
      ok: false,
      erro: { codigo: 'EVENTO_CANCELADO', mensagem: 'Este evento foi cancelado e não pode ser alterado.' },
    });
  });

  it('bolsista lista, mas não salva', () => {
    const amb = ambiente();
    amb.criar();
    const bolsista = amb.token('p02');
    expect(amb.listar('2026-12-01', '2026-12-31', bolsista).sessoes).toHaveLength(1);
    expect(amb.salvar(evNovo(), [sesNova()], bolsista)).toMatchObject({ erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('histórico registra quem criou e quem alterou', () => {
    const amb = ambiente();
    const r = amb.criar();
    amb.salvar({ ...r.evento, nome: 'Novo nome' }, r.sessoes);
    const acoes = amb.repo.listar<{ id: string; acao: string; quemId: string; entidade: string }>('historico').filter((h) => h.entidade === 'evento');
    expect(acoes.map((h) => h.acao)).toEqual(['criou evento', 'alterou evento']);
    expect(acoes.every((h) => h.quemId === 'p01')).toBe(true);
  });
});
