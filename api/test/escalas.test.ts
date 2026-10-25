import type { Escala } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersEscalas } from '../src/acoes/escalas';
import { handlersEventos } from '../src/acoes/eventos';
import { handlersPessoas } from '../src/acoes/pessoas';
import { handlersRodadas } from '../src/acoes/rodadas';
import { agendaMemoria } from '../src/adaptadores/memoria';
import { criarAmbiente } from './apoio';
import { linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };
type Item = { pessoaId: string; papel: 'bolsista' | 'servidor'; adicaoDireta: boolean };

export function ambienteEscalas() {
  const agenda = agendaMemoria();
  const amb = criarAmbiente({ handlers: { ...handlersEventos, ...handlersRodadas, ...handlersEscalas, ...handlersPessoas }, agenda });
  amb.repo.inserir('eventos', linhaEvento('e1'));
  amb.repo.inserir('eventos', linhaEvento('e2', 'Outro Evento'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-12-05' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's2', eventoId: 'e2', data: '2026-12-05', chegada: '10:00', inicio: '10:00', fim: '14:00' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's3', eventoId: 'e1', data: '2026-12-06' }));
  const gestor = amb.token('p01');
  const bolsista = amb.token('p02');
  const rascunho = (sessaoId: string, itens: Item[]) => amb.chamar('escalas.salvarRascunho', { sessaoId, itens }, { token: gestor });
  const publicar = (sessaoIds: string[]) => amb.chamar('escalas.publicar', { sessaoIds }, { token: gestor });
  const listar = (token = gestor) => (amb.chamar('escalas.listar', { de: '2026-12-01', ate: '2026-12-31' }, { token }) as Ok<Escala[]>).dados;
  const disponivel = (pessoaId: string, sessaoId: string) => amb.chamar('disponibilidades.marcar', { sessaoId, disponivel: true, pessoaId }, { token: gestor });
  const avisos = (pessoaId: string) => amb.repo.listar<{ id: string; pessoaId: string; texto: string }>('notificacoes').filter((n) => n.pessoaId === pessoaId).map((n) => n.texto);
  return { ...amb, agenda, gestor, bolsista, rascunho, publicar, listar, disponivel, avisos };
}

const BOLSISTA: Item = { pessoaId: 'p02', papel: 'bolsista', adicaoDireta: false };
const SERVIDOR: Item = { pessoaId: 'p01', papel: 'servidor', adicaoDireta: false };

describe('montar e publicar', () => {
  it('gestor monta rascunho; bolsista não vê rascunho', () => {
    const amb = ambienteEscalas();
    amb.disponivel('p02', 's1');
    const r = amb.rascunho('s1', [BOLSISTA, SERVIDOR]) as Ok<Escala[]>;
    expect(r.dados.map((e) => [e.pessoaId, e.status]).sort()).toEqual([['p01', 'rascunho'], ['p02', 'rascunho']]);
    expect(amb.listar()).toHaveLength(2);
    expect(amb.listar(amb.bolsista)).toEqual([]);
    amb.rascunho('s1', [BOLSISTA]);
    expect(amb.listar().map((e) => e.pessoaId)).toEqual(['p02']);
  });

  it('servidor em vaga de bolsista é recusado', () => {
    expect(ambienteEscalas().rascunho('s1', [{ ...SERVIDOR, papel: 'bolsista' }])).toEqual({
      ok: false, erro: { codigo: 'PAPEL', mensagem: 'Servidor só ocupa vaga de servidor, e bolsista, vaga de bolsista.' },
    });
  });

  it('conflito de horário com outro evento bloqueia no servidor', () => {
    const amb = ambienteEscalas();
    amb.rascunho('s1', [BOLSISTA]);
    expect(amb.rascunho('s2', [BOLSISTA])).toEqual({
      ok: false, erro: { codigo: 'CONFLITO_HORARIO', mensagem: 'BOLSISTA já está escalado(a) em outra sessão no mesmo horário (05/12).' },
    });
  });

  it('escalar indisponível marca adição direta e registra', () => {
    const amb = ambienteEscalas();
    const r = amb.rascunho('s3', [BOLSISTA]) as Ok<Escala[]>;
    expect(r.dados[0].adicaoDireta).toBe(true);
    expect(amb.repo.listar<{ id: string; acao: string }>('historico').map((h) => h.acao)).toContain('escalou BOLSISTA sem disponibilidade');
  });

  it('publicar avisa no app e mostra os colegas da sessão ao escalado', () => {
    const amb = ambienteEscalas();
    amb.rascunho('s1', [BOLSISTA, SERVIDOR]);
    amb.rascunho('s3', [SERVIDOR]);
    expect(amb.publicar(['s1'])).toEqual({ ok: true, dados: null });
    expect(amb.avisos('p02')).toContain('Sua escala foi publicada. Confira os horários.');
    const doBolsista = amb.listar(amb.bolsista);
    expect(doBolsista.map((e) => e.pessoaId).sort()).toEqual(['p01', 'p02']);
    expect(doBolsista.every((e) => e.sessaoId === 's1' && e.status === 'publicado')).toBe(true);
    expect(amb.repo.listar<{ id: string; publicadaEm: string }>('sessoes').find((s) => s.id === 's1')!.publicadaEm).toBe('2026-10-24T10:00');
  });

  it('publicar põe no Google quem ativou os convites, sem expor os outros', () => {
    const amb = ambienteEscalas();
    const p02 = amb.repo.listar<{ id: string }>('pessoas').find((p) => p.id === 'p02')!;
    amb.repo.atualizar('pessoas', { ...p02, convitesAgenda: 'bolsista.pessoal@exemplo.com' });
    amb.rascunho('s1', [BOLSISTA, SERVIDOR]);
    amb.publicar(['s1']);
    const gid = amb.repo.listar<{ id: string; googleEventoId: string }>('sessoes').find((s) => s.id === 's1')!.googleEventoId;
    expect(amb.agenda.eventos.get(gid)!.convidados).toEqual(['bolsista.pessoal@exemplo.com']);
  });

  it('sessão cancelada não aceita rascunho', () => {
    const amb = ambienteEscalas();
    const s1 = amb.repo.listar<{ id: string }>('sessoes').find((s) => s.id === 's1')!;
    amb.repo.atualizar('sessoes', { ...s1, status: 'cancelada' });
    expect(amb.rascunho('s1', [BOLSISTA])).toEqual({ ok: false, erro: { codigo: 'SESSAO_CANCELADA', mensagem: 'Esta sessão foi cancelada.' } });
  });
});

describe('depois de publicada', () => {
  function publicado() {
    const amb = ambienteEscalas();
    amb.rascunho('s1', [BOLSISTA, SERVIDOR]);
    amb.publicar(['s1']);
    const novo = { ...amb.repo.listar<{ id: string }>('pessoas').find((p) => p.id === 'p02')!, id: 'p03', nome: 'Outra Bolsista', nomeCurto: 'OUTRA', emailAcademico: 'outra@acad.ufsm.br' };
    amb.repo.inserir('pessoas', novo);
    const trocar = (d: { sai: string | null; entra: string | null; justificativa?: string; sessaoId?: string }) =>
      amb.chamar('escalas.trocar', { sessaoId: d.sessaoId ?? 's1', sai: d.sai, entra: d.entra, justificativa: d.justificativa ?? 'Prova na faculdade' }, { token: amb.gestor });
    return { ...amb, trocar };
  }

  it('troca sai/entra com justificativa avisa os dois e fica no histórico de trocas', () => {
    const amb = publicado();
    const r = amb.trocar({ sai: 'p02', entra: 'p03' }) as Ok<Escala[]>;
    expect(r.dados.filter((e) => e.papel === 'bolsista').map((e) => [e.pessoaId, e.status])).toEqual([['p03', 'publicado']]);
    expect(r.dados.find((e) => e.pessoaId === 'p03')!.adicaoDireta).toBe(true);
    expect(amb.avisos('p02')).toContain('Você foi retirado(a) da escala: Formatura Teste (05/12).');
    expect(amb.avisos('p03')).toContain('Você foi escalado(a): Formatura Teste (05/12).');
    const troca = amb.repo.listar<{ id: string; entidade: string; entidadeId: string; antes: unknown; depois: unknown; justificativa: string }>('historico').find((h) => h.entidade === 'troca')!;
    expect(troca).toMatchObject({ entidadeId: 's1', antes: { sai: 'p02' }, depois: { entra: 'p03' }, justificativa: 'Prova na faculdade' });
  });

  it('troca só entra (convocação extra) e só sai', () => {
    const amb = publicado();
    expect((amb.trocar({ sai: null, entra: 'p03', justificativa: 'convocação extra' }) as Ok<Escala[]>).dados.filter((e) => e.papel === 'bolsista')).toHaveLength(2);
    expect((amb.trocar({ sai: 'p02', entra: null }) as Ok<Escala[]>).dados.filter((e) => e.papel === 'bolsista').map((e) => e.pessoaId)).toEqual(['p03']);
  });

  it('troca recusa justificativa vazia, papel diferente, duplicado, conflito e sessão cancelada', () => {
    const amb = publicado();
    expect(amb.trocar({ sai: 'p02', entra: 'p03', justificativa: ' ' })).toMatchObject({ erro: { codigo: 'JUSTIFICATIVA', mensagem: 'Informe a justificativa da troca.' } });
    expect(amb.trocar({ sai: null, entra: null })).toMatchObject({ erro: { codigo: 'TROCA_VAZIA' } });
    expect(amb.trocar({ sai: 'p02', entra: 'p01' })).toMatchObject({ erro: { codigo: 'PAPEL', mensagem: 'Servidor só pode ser trocado por servidor, e bolsista por bolsista.' } });
    expect(amb.trocar({ sai: null, entra: 'p02' })).toMatchObject({ erro: { codigo: 'DUPLICADO' } });
    expect(amb.trocar({ sai: 'p03', entra: null })).toMatchObject({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Esta pessoa não está escalada nesta sessão.' } });
    amb.rascunho('s2', [{ pessoaId: 'p03', papel: 'bolsista', adicaoDireta: false }]);
    expect(amb.trocar({ sai: null, entra: 'p03' })).toMatchObject({ erro: { codigo: 'CONFLITO_HORARIO' } });
    const s1 = amb.repo.listar<{ id: string }>('sessoes').find((s) => s.id === 's1')!;
    amb.repo.atualizar('sessoes', { ...s1, status: 'cancelada' });
    expect(amb.trocar({ sai: 'p02', entra: null })).toMatchObject({ erro: { codigo: 'SESSAO_CANCELADA' } });
  });

  it('convocação aumenta as vagas e avisa só bolsistas fora da sessão', () => {
    const amb = publicado();
    const r = amb.chamar('escalas.convocar', { sessaoId: 's1', vagas: 3, abertaAte: '2026-10-24T18:00' }, { token: amb.gestor }) as Ok<{ vagasBolsistas: number; convocacao: unknown }>;
    expect(r.dados.vagasBolsistas).toBe(11);
    expect(r.dados.convocacao).toEqual({ abertaAte: '2026-10-24T18:00', vagas: 3 });
    expect(amb.avisos('p03')).toContain('Precisamos de mais 3 bolsista(s): Formatura Teste (05/12). Marque se puder.');
    expect(amb.avisos('p02')).not.toContain('Precisamos de mais 3 bolsista(s): Formatura Teste (05/12). Marque se puder.');
  });

  it('convocação recusa sessão não publicada, vagas 0 e prazo no passado', () => {
    const amb = publicado();
    const convocar = (sessaoId: string, vagas: number, abertaAte: string) => amb.chamar('escalas.convocar', { sessaoId, vagas, abertaAte }, { token: amb.gestor });
    expect(convocar('s3', 2, '2026-10-24T18:00')).toMatchObject({ erro: { codigo: 'NAO_PUBLICADA', mensagem: 'Publique a escala desta sessão antes de abrir convocação extra.' } });
    expect(convocar('s1', 0, '2026-10-24T18:00')).toMatchObject({ erro: { codigo: 'VAGAS', mensagem: 'Informe ao menos 1 vaga extra.' } });
    expect(convocar('s1', 2, '2026-10-24T09:00')).toMatchObject({ erro: { codigo: 'PRAZO', mensagem: 'O prazo da convocação precisa ser no futuro.' } });
  });

  it('presença: desmarcados viram faltou; confirmar de novo corrige a falta', () => {
    const amb = publicado();
    amb.relogio.definir('2026-12-05T13:00');
    const token = amb.token('p01'); // o token de antes da mudança de data já venceu (7 dias)
    const confirmar = (faltaram: string[]) => (amb.chamar('escalas.confirmarPresenca', { sessaoId: 's1', faltaram }, { token }) as Ok<Escala[]>).dados;
    const status = (lista: Escala[]) => Object.fromEntries(lista.map((e) => [e.pessoaId, e.status]));
    expect(status(confirmar(['p02']))).toEqual({ p01: 'realizado', p02: 'faltou' });
    expect(status(confirmar([]))).toEqual({ p01: 'realizado', p02: 'realizado' });
    const faltas = amb.repo.listar<{ id: string; entidade: string; entidadeId: string; acao: string }>('historico').filter((h) => h.entidade === 'pessoa' && h.acao === 'faltou');
    expect(faltas.map((h) => h.entidadeId)).toEqual(['p02']);
  });

  it('presença de sessão futura é recusada', () => {
    const amb = publicado();
    expect(amb.chamar('escalas.confirmarPresenca', { sessaoId: 's1', faltaram: [] }, { token: amb.gestor })).toEqual({
      ok: false, erro: { codigo: 'FUTURA', mensagem: 'Esta sessão ainda não aconteceu.' },
    });
  });
});
