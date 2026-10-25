import { agendaDoMes, mesExtenso, rotuloDiaAgenda, type Feriado, type LinhaAgendaMes } from '@shared';
import { paraEvento, paraSessao, type LinhaEvento, type LinhaSessao } from '../acoes/eventos';
import type { Portas } from '../nucleo/portas';

const CABECALHO = ['DIA', 'EVENTO', 'RESPONSÁVEL', 'RESP NUGAC', 'HORÁRIO'];

export const nomeAbaAgenda = (ano: number, mes: number) => `AGENDA ${mesExtenso(mes).toUpperCase()} ${ano}`;

function linhaPlanilha(l: LinhaAgendaMes): string[] {
  const dia = rotuloDiaAgenda(l.dia);
  if (l.feriado !== null && !l.eventos.length) return [dia, `FERIADO${l.feriado ? ` – ${l.feriado}` : ''}`, '', '', ''];
  const juntar = (lista: string[]) => lista.join('\n');
  return [
    dia,
    juntar(l.eventos.map((e) => e.nome)),
    juntar(l.eventos.map((e) => e.responsavel)),
    juntar(l.eventos.map((e) => e.respNugac)),
    juntar(l.horarios),
  ];
}

/** Reescreve a aba AGENDA do mês (spec 11), no mesmo formato da impressão; devolve o nome da aba. */
export function escreverAgenda(portas: Portas, ano: number, mes: number): string {
  const { repo } = portas;
  const eventos = repo.listar<LinhaEvento>('eventos').map(paraEvento);
  const sessoes = repo.listar<LinhaSessao>('sessoes').map(paraSessao);
  const feriados = repo.listar<Feriado & { id: string }>('feriados').map((f) => ({ data: f.data, nome: f.nome }));
  const pessoas = repo.listar<{ id: string; nome: string }>('pessoas');
  const nomeServidor = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? '';
  const nome = nomeAbaAgenda(ano, mes);
  const linhas = agendaDoMes(ano, mes, { eventos, sessoes, feriados, nomeServidor }).map(linhaPlanilha);
  repo.escreverAbaLivre('relatorios', nome, [CABECALHO, ...linhas]);
  return nome;
}
