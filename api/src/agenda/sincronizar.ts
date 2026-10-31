import { paraEvento, paraSessao, type LinhaEvento, type LinhaSessao } from '../acoes/eventos';
import type { Portas } from '../nucleo/portas';
import { eventoDaAgenda } from './eventoAgenda';

/** Endereço do site para o link na descrição (propriedade opcional URL_APP). */
const linkApp = (p: Portas) => p.props.obter('URL_APP')?.trim().replace(/\/+$/, '') || null;

/**
 * Atualiza na agenda do setor as sessões indicadas. Falha do Google não desfaz a gravação no GestorCC:
 * a sessão fica com `agendaPendente` e o gatilho de 5 minutos tenta de novo.
 */
export function sincronizarAgenda(portas: Portas, sessaoIds: string[]): void {
  if (!sessaoIds.length || !portas.agenda.ligada()) return;
  const { repo } = portas;
  const eventos = repo.listar<LinhaEvento>('eventos');
  const pessoas = repo.listar<{ id: string; nome: string }>('pessoas');
  const sessoes = repo.listar<LinhaSessao>('sessoes');
  const link = linkApp(portas);

  for (const id of new Set(sessaoIds)) {
    const linha = sessoes.find((s) => s.id === id);
    const ev = linha && eventos.find((e) => e.id === linha.eventoId);
    if (!linha || !ev) continue;
    const evento = paraEvento(ev);
    const responsavel = (evento.servidorResponsavelId && pessoas.find((p) => p.id === evento.servidorResponsavelId)?.nome) || '';
    const dados = eventoDaAgenda(evento, paraSessao(linha), { responsavel, linkApp: link, convidados: convidadosDaSessao(portas, id) });
    let atualizada: LinhaSessao;
    try {
      atualizada = { ...linha, googleEventoId: portas.agenda.salvar(linha.googleEventoId || null, dados), agendaPendente: false };
    } catch {
      atualizada = { ...linha, agendaPendente: true };
    }
    if (atualizada.googleEventoId !== linha.googleEventoId || atualizada.agendaPendente !== !!linha.agendaPendente) {
      repo.atualizar('sessoes', atualizada);
    }
  }
}

/** Tira da agenda os eventos de sessões apagadas. Melhor esforço: se o Google falhar, o evento fica lá. */
export function removerDaAgenda(portas: Portas, googleIds: string[]): void {
  if (!portas.agenda.ligada()) return;
  for (const id of googleIds.filter(Boolean)) {
    try {
      portas.agenda.remover(id);
    } catch {
      // sem pendência: uma sessão apagada não tem mais linha para guardar a marca
    }
  }
}

/** Tenta de novo as sessões que ficaram pendentes; devolve quantas ficaram certas. */
export function sincronizarPendentes(portas: Portas): number {
  const pendentes = portas.repo.listar<LinhaSessao>('sessoes').filter((s) => s.agendaPendente).map((s) => s.id);
  sincronizarAgenda(portas, pendentes);
  const ainda = new Set(portas.repo.listar<LinhaSessao>('sessoes').filter((s) => s.agendaPendente).map((s) => s.id));
  return pendentes.filter((id) => !ainda.has(id)).length;
}

/**
 * Convidados do evento no Google (spec 7.11 B): quem está publicado na sessão, ativo e com os convites
 * ligados no Perfil. Escala cancelada sai da lista, e o evento perde o convidado.
 */
export function convidadosDaSessao(portas: Portas, sessaoId: string): string[] {
  const escalados = new Set(
    portas.repo
      .listar<{ id: string; sessaoId: string; pessoaId: string; status: string }>('escalas')
      .filter((e) => e.sessaoId === sessaoId && (e.status === 'publicado' || e.status === 'realizado'))
      .map((e) => e.pessoaId),
  );
  return portas.repo
    .listar<{ id: string; ativo: boolean; convitesAgenda: string }>('pessoas')
    .filter((p) => escalados.has(p.id) && p.ativo && p.convitesAgenda)
    .map((p) => p.convitesAgenda);
}
