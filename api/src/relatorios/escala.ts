import { diaDaSemanaCurto, horarioSessao, mesExtenso, type Evento, type Sessao } from '@shared';
import { paraEvento, paraSessao, type LinhaEvento, type LinhaSessao } from '../acoes/eventos';
import { nomeSessao, paraEscala, type LinhaEscala } from '../escalas/comum';
import type { Portas } from '../nucleo/portas';

interface PessoaRel {
  id: string;
  nome: string;
  nomeCurto: string;
  tipo: 'servidor' | 'bolsista';
  ativo: boolean;
  experiente: boolean;
  escalarMenos: boolean;
}

const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const porNome = (a: PessoaRel, b: PessoaRel) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
const nomeMes = (ano: number, mes: number) => `${mesExtenso(mes).toUpperCase()} ${ano}`;

/** Sessões ativas do mês em ordem, os eventos delas e as escalas visíveis à equipe (sem rascunho). */
function dadosDoMes(portas: Portas, ano: number, mes: number) {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
  const sessoes = portas.repo
    .listar<LinhaSessao>('sessoes')
    .filter((s) => s.data.startsWith(prefixo) && s.status === 'ativa')
    .map(paraSessao)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.chegada ?? '99').localeCompare(b.chegada ?? '99'));
  const ids = new Set(sessoes.map((s) => s.id));
  const eventos = new Map(portas.repo.listar<LinhaEvento>('eventos').map((e) => [e.id, paraEvento(e)]));
  const escalas = portas.repo
    .listar<LinhaEscala>('escalas')
    .map(paraEscala)
    .filter((e) => ids.has(e.sessaoId) && (e.status === 'publicado' || e.status === 'realizado' || e.status === 'faltou'));
  const pessoas = portas.repo.listar<PessoaRel>('pessoas').filter((p) => p.ativo);
  return { sessoes, eventos, escalas, pessoas };
}

const tituloColuna = (s: Sessao, e: Evento | undefined) => `${diaMes(s.data)} ${diaDaSemanaCurto(s.data)} – ${e?.nome ?? ''} – ${horarioSessao(s)}`;

/** ESCALA do mês (spec 11): servidores primeiro, bolsistas numerados, X onde está escalado, F onde faltou. */
export function escreverEscala(portas: Portas, ano: number, mes: number): string {
  const { sessoes, eventos, escalas, pessoas } = dadosDoMes(portas, ano, mes);
  const marca = (pessoaId: string, sessaoId: string) => {
    const e = escalas.find((x) => x.pessoaId === pessoaId && x.sessaoId === sessaoId);
    return !e ? '' : e.status === 'faltou' ? 'F' : 'X';
  };
  const servidores = pessoas.filter((p) => p.tipo === 'servidor').sort(porNome);
  const bolsistas = pessoas.filter((p) => p.tipo === 'bolsista').sort(porNome);
  const ordem = [...servidores, ...bolsistas];
  const linhas = [
    ['NOME', ...sessoes.map((s) => tituloColuna(s, eventos.get(s.eventoId)))],
    ['ESTAR NO CC', ...sessoes.map((s) => (s.horarioADefinir || !s.chegada ? 'a definir' : s.chegada))],
    ...servidores.map((p) => [p.nomeCurto, ...sessoes.map((s) => marca(p.id, s.id))]),
    ...bolsistas.map((p, i) => [`${i + 1}. ${p.nomeCurto}`, ...sessoes.map((s) => marca(p.id, s.id))]),
  ];
  const linhaDe = (p: PessoaRel) => ordem.indexOf(p) + 2;
  const nome = `ESCALA ${nomeMes(ano, mes)}`;
  portas.repo.escreverAbaLivre('relatorios', nome, linhas, {
    negrito: ordem.filter((p) => p.experiente).map(linhaDe),
    destaque: ordem.filter((p) => p.escalarMenos).map(linhaDe),
  });
  return nome;
}

/** CONSULTA do mês: total de escalas e eventos de cada pessoa ativa. */
export function escreverConsulta(portas: Portas, ano: number, mes: number): string {
  const { sessoes, eventos, escalas, pessoas } = dadosDoMes(portas, ano, mes);
  const sessao = new Map(sessoes.map((s) => [s.id, s]));
  const linhas = [['NOME', 'TIPO', 'ESCALAS NO MÊS', 'EVENTOS']];
  for (const p of [...pessoas].sort(porNome)) {
    const minhas = escalas.filter((e) => e.pessoaId === p.id && e.status !== 'faltou').map((e) => sessao.get(e.sessaoId)!);
    minhas.sort((a, b) => a.data.localeCompare(b.data));
    linhas.push([
      p.nome, p.tipo === 'servidor' ? 'Servidor' : 'Bolsista', String(minhas.length),
      minhas.map((s) => `${diaMes(s.data)} ${eventos.get(s.eventoId)?.nome ?? ''}`).join('\n'),
    ]);
  }
  const nome = `CONSULTA ${nomeMes(ano, mes)}`;
  portas.repo.escreverAbaLivre('relatorios', nome, linhas);
  return nome;
}

/** HISTÓRICO DE TROCAS: da mais recente para a mais antiga, a partir do histórico (entidade 'troca'). */
export function escreverTrocas(portas: Portas): string {
  type Troca = { id: string; entidade: string; entidadeId: string; quando: string; antes: { sai?: string | null } | null; depois: { entra?: string | null } | null; justificativa: string };
  const trocas = portas.repo.listar<Troca>('historico').filter((h) => h.entidade === 'troca').sort((a, b) => b.quando.localeCompare(a.quando));
  const pessoas = portas.repo.listar<PessoaRel>('pessoas');
  const curto = (id: string | null | undefined) => (id ? (pessoas.find((p) => p.id === id)?.nomeCurto ?? id) : '—');
  const sessoes = portas.repo.listar<LinhaSessao>('sessoes');
  const eventos = portas.repo.listar<LinhaEvento>('eventos');
  const quando = (q: string) => `${q.slice(8, 10)}/${q.slice(5, 7)}/${q.slice(0, 4)} ${q.slice(11, 16)}`;
  const qualSessao = (id: string) => {
    const s = sessoes.find((x) => x.id === id);
    const e = s && eventos.find((x) => x.id === s.eventoId);
    return s && e ? nomeSessao(paraEvento(e), paraSessao(s)) : id;
  };
  const linhas = [
    ['DATA/HORA', 'EVENTO/DATA', 'SAIU', 'ENTROU', 'JUSTIFICATIVA'],
    ...trocas.map((t) => [quando(t.quando), qualSessao(t.entidadeId), curto(t.antes?.sai), curto(t.depois?.entra), t.justificativa ?? '']),
  ];
  const nome = 'HISTÓRICO DE TROCAS';
  portas.repo.escreverAbaLivre('relatorios', nome, linhas);
  return nome;
}
