import { agendaDoMes, mesExtenso, rotuloDiaAgenda, type Feriado, type LinhaAgendaMes } from '@shared';
import { paraEvento, paraSessao, type LinhaEvento, type LinhaSessao } from '../acoes/eventos';
import type { Portas, Propriedades } from '../nucleo/portas';

/** Meses ('AAAA-MM') cuja aba AGENDA precisa ser refeita pelo gatilho de 5 minutos (spec 11). */
const CHAVE = 'RELATORIOS_PENDENTES';
const CABECALHO = ['DIA', 'EVENTO', 'RESPONSÁVEL', 'RESP NUGAC', 'HORÁRIO'];

function pendentes(props: Propriedades): string[] {
  try {
    const v = JSON.parse(props.obter(CHAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((m) => /^\d{4}-\d{2}$/.test(m)) : [];
  } catch {
    return [];
  }
}

export function marcarAgendaPendente(props: Propriedades, meses: string[]): void {
  const atuais = pendentes(props);
  const todos = [...new Set([...atuais, ...meses.filter((m) => /^\d{4}-\d{2}$/.test(m))])].sort();
  if (todos.length !== atuais.length) props.definir(CHAVE, JSON.stringify(todos));
}

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

/** Escreve as abas AGENDA dos meses marcados e limpa a marca; devolve os nomes das abas escritas. */
export function gerarRelatoriosPendentes(portas: Portas): string[] {
  const meses = pendentes(portas.props);
  if (!meses.length) return [];
  const { repo } = portas;
  const eventos = repo.listar<LinhaEvento>('eventos').map(paraEvento);
  const sessoes = repo.listar<LinhaSessao>('sessoes').map(paraSessao);
  const feriados = repo.listar<Feriado & { id: string }>('feriados').map((f) => ({ data: f.data, nome: f.nome }));
  const pessoas = repo.listar<{ id: string; nome: string }>('pessoas');
  const nomeServidor = (id: string) => pessoas.find((p) => p.id === id)?.nome ?? '';

  const escritas = meses.map((m) => {
    const [ano, mes] = m.split('-').map(Number);
    const nome = nomeAbaAgenda(ano, mes);
    const linhas = agendaDoMes(ano, mes, { eventos, sessoes, feriados, nomeServidor }).map(linhaPlanilha);
    repo.escreverAbaLivre('relatorios', nome, [CABECALHO, ...linhas]);
    return nome;
  });
  portas.props.definir(CHAVE, '[]');
  return escritas;
}
