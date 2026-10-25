import {
  ErroApi, pode, ROTULO_STATUS_OCORRENCIA, validarTransicao,
  type Ocorrencia, type PrioridadeOcorrencia, type StatusOcorrencia,
} from '@shared';
import { linhasPessoas } from '../escalas/comum';
import { comPermissoes, notificar, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { dataParaTexto } from '../tabelas/serializacao';
import { marcarRelatorios } from '../relatorios/pendentes';

export interface LinhaOcorrencia {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  categoria: string;
  local: string;
  prioridade: PrioridadeOcorrencia;
  status: StatusOcorrencia;
  origem: 'formulario' | 'app';
  relatorNome: string;
  relatorPessoaId: string;
  relatorContato: string;
  eventoId: string;
  fotoId: string;
  chamadoNumero: string;
  chamadoLink: string;
  chamadoAbertoEm: string;
  resolvidaEm: string;
  respostaFormularioId: string;
  criadoEm?: string;
}
type LinhaHistorico = { id: string; ocorrenciaId: string; quando: string; quemId: string; de: string; para: StatusOcorrencia; observacao: string };

const PRIORIDADES: PrioridadeOcorrencia[] = ['baixa', 'media', 'alta', 'urgente'];
export const linhasOcorrencias = (ctx: Contexto) => ctx.portas.repo.listar<LinhaOcorrencia>('ocorrencias');
const historicoDe = (ctx: Contexto) => ctx.portas.repo.listar<LinhaHistorico>('ocorrenciasHistorico');

export function paraOcorrencia(l: LinhaOcorrencia, historico: LinhaHistorico[]): Ocorrencia {
  const o: Ocorrencia = {
    id: l.id, numero: Number(l.numero), titulo: l.titulo, descricao: l.descricao ?? '', categoria: l.categoria, local: l.local,
    prioridade: l.prioridade, status: l.status, origem: l.origem, relatorNome: l.relatorNome ?? '', criadaEm: l.criadoEm ?? '',
    foto: null, temFoto: !!l.fotoId, chamadoNumero: l.chamadoNumero ?? '', chamadoLink: l.chamadoLink ?? '',
    chamadoAbertoEm: l.chamadoAbertoEm || null, resolvidaEm: l.resolvidaEm || null,
    historico: historico
      .filter((h) => h.ocorrenciaId === l.id)
      .sort((a, b) => a.quando.localeCompare(b.quando))
      .map((h) => ({ quando: h.quando, quemId: h.quemId, de: (h.de || null) as StatusOcorrencia | null, para: h.para, observacao: h.observacao ?? '' })),
  };
  if (l.relatorPessoaId) o.relatorPessoaId = l.relatorPessoaId;
  if (l.relatorContato) o.relatorContato = l.relatorContato;
  if (l.eventoId) o.eventoId = l.eventoId;
  return o;
}

const reler = (ctx: Contexto, id: string) => paraOcorrencia(linhasOcorrencias(ctx).find((o) => o.id === id)!, historicoDe(ctx));
const marcarInfra = (ctx: Contexto) => marcarRelatorios(ctx.portas.props, ['infra']);

/** Cria a ocorrência com o próximo número e avisa quem gerencia a infraestrutura (spec 10.4). */
function criarOcorrencia(ctx: Contexto, dados: Omit<LinhaOcorrencia, 'id' | 'numero' | 'status' | 'chamadoNumero' | 'chamadoLink' | 'chamadoAbertoEm' | 'resolvidaEm'>): LinhaOcorrencia {
  const numero = Math.max(0, ...linhasOcorrencias(ctx).map((o) => Number(o.numero))) + 1;
  const linha: LinhaOcorrencia = {
    ...dados, id: novoId(ctx.portas, 'oc'), numero, status: 'nova', chamadoNumero: '', chamadoLink: '', chamadoAbertoEm: '', resolvidaEm: '',
  };
  ctx.portas.repo.inserir('ocorrencias', linha);
  const permissoes = ctx.portas.repo.listar<never>('permissoes');
  const responsaveis = linhasPessoas(ctx)
    .filter((p) => p.ativo && pode(comPermissoes(p, permissoes).permissoes, 'infraestrutura', 'editar'))
    .map((p) => p.id);
  notificar(ctx, responsaveis, `Nova ocorrência #${numero}: ${linha.titulo} (${linha.local}).`, `/infra/${linha.id}`);
  marcarInfra(ctx);
  return linha;
}

/** Resposta do Google Form → ocorrência, reconhecendo as colunas pelo cabeçalho; null se não dá para ler. */
export function respostaParaOcorrencia(r: Record<string, unknown>): { id: string; titulo: string; descricao: string; local: string; categoria: string; prioridade: PrioridadeOcorrencia; relatorNome: string; relatorContato: string } | null {
  const texto = (v: unknown) => (v instanceof Date ? dataParaTexto(v) : String(v ?? '').trim());
  // as palavras valem em ordem de prioridade, e uma coluna já usada não serve para outro campo
  // ("Local do problema" é o local, não a descrição)
  const usadas = new Set<string>();
  const campo = (...chaves: string[]) => {
    for (const c of chaves) {
      const achada = Object.keys(r).find((k) => !usadas.has(k) && k.toLowerCase().includes(c));
      if (achada) {
        usadas.add(achada);
        return texto(r[achada]);
      }
    }
    return '';
  };
  const quando = campo('carimbo', 'timestamp');
  const local = campo('local', 'onde');
  const categoria = campo('tipo', 'categoria');
  const urgente = /\b(sim|urgente)\b/i.test(campo('urgen', 'prioridade'));
  const contato = campo('e-mail', 'email', 'telefone', 'contato');
  const nome = campo('nome');
  const descricao = campo('descri', 'aconteceu', 'problema');
  if (!quando || !descricao) return null;
  return {
    id: `${quando}|${descricao.slice(0, 30)}`,
    titulo: descricao.slice(0, 80), descricao, local: local || 'Outro', categoria: categoria || 'Outros',
    prioridade: urgente ? 'urgente' : 'media', relatorNome: nome || 'Formulário', relatorContato: contato,
  };
}

/** Lê as respostas novas do formulário; devolve quantas viraram ocorrência, ou null se não está configurado. */
export function importarRespostas(ctx: Contexto): number | null {
  const respostas = ctx.portas.formulario.respostasInfra();
  if (!respostas) return null;
  const ja = new Set(linhasOcorrencias(ctx).map((o) => o.respostaFormularioId).filter(Boolean));
  let n = 0;
  for (const r of respostas) {
    const o = respostaParaOcorrencia(r);
    if (!o || ja.has(o.id)) continue;
    criarOcorrencia(ctx, {
      titulo: o.titulo, descricao: o.descricao, categoria: o.categoria, local: o.local, prioridade: o.prioridade, origem: 'formulario',
      relatorNome: o.relatorNome, relatorPessoaId: '', relatorContato: o.relatorContato, eventoId: '', fotoId: '', respostaFormularioId: o.id,
    });
    ja.add(o.id);
    n++;
  }
  return n;
}

export const handlersInfra: Handlers = {
  'infra.listar': (_d, ctx) => {
    const todas = pode(ctx.eu!.permissoes, 'infraestrutura', 'ver');
    const historico = historicoDe(ctx);
    return linhasOcorrencias(ctx)
      .filter((o) => todas || o.relatorPessoaId === ctx.eu!.id)
      .map((o) => paraOcorrencia(o, historico))
      .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm) || b.numero - a.numero);
  },

  'infra.relatar': (d, ctx) => {
    if (!d.titulo?.trim()) throw new ErroApi('TITULO', 'Conte em poucas palavras o que aconteceu.');
    if (!d.local?.trim()) throw new ErroApi('LOCAL', 'Informe onde está o problema.');
    const fotoId = d.foto && d.foto.startsWith('data:image/') ? ctx.portas.arquivos.salvarImagem(d.foto, `ocorrencia-${ctx.portas.relogio.agora()}`) : '';
    const linha = criarOcorrencia(ctx, {
      titulo: d.titulo.trim(), descricao: d.descricao?.trim() ?? '', categoria: d.categoria || 'Outros', local: d.local.trim(),
      prioridade: PRIORIDADES.includes(d.prioridade) ? d.prioridade : 'media', origem: 'app', relatorNome: ctx.eu!.nome,
      relatorPessoaId: ctx.eu!.id, relatorContato: '', eventoId: d.eventoId ?? '', fotoId, respostaFormularioId: '',
    });
    registrar(ctx, 'ocorrencia', linha.id, `relatou a ocorrência #${linha.numero}`, null, null);
    return reler(ctx, linha.id);
  },

  'infra.foto': ({ id }, ctx) => {
    const o = linhasOcorrencias(ctx).find((x) => x.id === id);
    if (!o) throw new ErroApi('NAO_ENCONTRADO', 'Ocorrência não encontrada.');
    if (!pode(ctx.eu!.permissoes, 'infraestrutura', 'ver') && o.relatorPessoaId !== ctx.eu!.id) {
      throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    }
    return o.fotoId ? ctx.portas.arquivos.lerImagem(o.fotoId) : null;
  },

  'infra.atualizar': (d, ctx) => {
    const anterior = linhasOcorrencias(ctx).find((x) => x.id === d.id);
    if (!anterior) throw new ErroApi('NAO_ENCONTRADO', 'Ocorrência não encontrada.');
    const o: LinhaOcorrencia = { ...anterior };
    if (d.chamadoNumero !== undefined) o.chamadoNumero = d.chamadoNumero.trim();
    if (d.chamadoLink !== undefined) o.chamadoLink = d.chamadoLink.trim();
    if (d.prioridade && PRIORIDADES.includes(d.prioridade)) o.prioridade = d.prioridade;
    if (d.categoria) o.categoria = d.categoria;
    if (d.local) o.local = d.local;
    const observacao = (d.observacao ?? '').trim();
    const agora = ctx.portas.relogio.agora();
    if (d.para) {
      const problema = validarTransicao(paraOcorrencia(anterior, []), d.para, { chamadoNumero: o.chamadoNumero, observacao });
      if (problema) throw new ErroApi('TRANSICAO', problema);
      ctx.portas.repo.inserir('ocorrenciasHistorico', { id: novoId(ctx.portas, 'oh'), ocorrenciaId: o.id, quando: agora, quemId: ctx.eu!.id, de: anterior.status, para: d.para, observacao });
      o.status = d.para;
      if (d.para === 'chamado') o.chamadoAbertoEm = agora;
      if (d.para === 'resolvida' || d.para === 'naoProcede') o.resolvidaEm = agora;
      if (o.relatorPessoaId) {
        notificar(ctx, [o.relatorPessoaId], `Sua ocorrência #${o.numero} (${o.titulo}) agora está: ${ROTULO_STATUS_OCORRENCIA[d.para]}.`, '/relatar');
      }
    } else if (observacao) {
      ctx.portas.repo.inserir('ocorrenciasHistorico', { id: novoId(ctx.portas, 'oh'), ocorrenciaId: o.id, quando: agora, quemId: ctx.eu!.id, de: '', para: o.status, observacao });
    }
    const { criadoEm: _c, ...semCarimbo } = o;
    ctx.portas.repo.atualizar('ocorrencias', semCarimbo);
    registrar(ctx, 'ocorrencia', o.id, d.para ? `situação: ${ROTULO_STATUS_OCORRENCIA[d.para]}` : 'atualizou a ocorrência', null, null, observacao);
    marcarInfra(ctx);
    return reler(ctx, o.id);
  },

  'infra.importarFormulario': (_d, ctx) => {
    const importadas = importarRespostas(ctx);
    if (importadas === null) throw new ErroApi('FORMULARIO', 'Configure a planilha do formulário (propriedade FORMULARIO_INFRA_ID).');
    registrar(ctx, 'ocorrencia', 'formulario', `importou ${importadas} resposta(s) do formulário`, null, null);
    return { importadas };
  },
};
