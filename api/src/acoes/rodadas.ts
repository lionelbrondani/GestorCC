import { ErroApi, pode, type Disponibilidade, type Rodada } from '@shared';
import { linhasDisponibilidades, linhasEscalas, linhasPessoas, type LinhaDisponibilidade } from '../escalas/comum';
import { notificar, registrar, novoId, type Contexto, type Handlers } from '../nucleo/roteador';
import { linhasSessoes } from './eventos';

interface LinhaRodada {
  id: string;
  nome: string;
  prazo: string;
  status: Rodada['status'];
}
interface LinhaRodadaSessao {
  id: string;
  rodadaId: string;
  sessaoId: string;
  nova: boolean;
}

const PRAZO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const linhasRodadas = (ctx: Contexto) => ctx.portas.repo.listar<LinhaRodada>('rodadas');
const linhasRodadaSessoes = (ctx: Contexto) => ctx.portas.repo.listar<LinhaRodadaSessao>('rodadaSessoes');
const validacao = (mensagem: string) => new ErroApi('VALIDACAO', mensagem);

function paraRodada(ctx: Contexto, r: LinhaRodada): Rodada {
  const ligadas = linhasRodadaSessoes(ctx).filter((x) => x.rodadaId === r.id);
  return {
    id: r.id, nome: r.nome, prazo: r.prazo, status: r.status,
    sessaoIds: ligadas.map((x) => x.sessaoId), sessoesNovas: ligadas.filter((x) => x.nova).map((x) => x.sessaoId),
  };
}

/** Por que a sessão aceita disponibilidade agora (spec 7.2 e 7.6); `null` se não aceita. */
export function sessaoAbertaPara(ctx: Contexto, sessaoId: string): 'rodada' | 'convocacao' | null {
  const agora = ctx.portas.relogio.agora();
  const sessao = linhasSessoes(ctx).find((s) => s.id === sessaoId);
  if (!sessao || sessao.status !== 'ativa') return null;
  const naRodada = new Set(linhasRodadaSessoes(ctx).filter((x) => x.sessaoId === sessaoId).map((x) => x.rodadaId));
  if (linhasRodadas(ctx).some((r) => naRodada.has(r.id) && r.status === 'aberta' && r.prazo >= agora)) return 'rodada';
  if (sessao.convocacaoAbertaAte && sessao.convocacaoAbertaAte >= agora) return 'convocacao';
  return null;
}

/** Sessão criada com rodada aberta do mesmo mês entra nela com o selo "nova" (spec 7.2.3). */
export function incluirEmRodadaAberta(ctx: Contexto, sessaoIds: string[]): void {
  if (!sessaoIds.length) return;
  const agora = ctx.portas.relogio.agora();
  const sessoes = linhasSessoes(ctx);
  const ligadas = linhasRodadaSessoes(ctx);
  const mesDe = (id: string) => sessoes.find((s) => s.id === id)?.data.slice(0, 7);
  for (const r of linhasRodadas(ctx).filter((x) => x.status === 'aberta' && x.prazo >= agora)) {
    const meses = new Set(ligadas.filter((x) => x.rodadaId === r.id).map((x) => mesDe(x.sessaoId)));
    for (const id of sessaoIds) {
      if (meses.has(mesDe(id)) && !ligadas.some((x) => x.rodadaId === r.id && x.sessaoId === id)) {
        ctx.portas.repo.inserir('rodadaSessoes', { id: `${r.id}:${id}`, rodadaId: r.id, sessaoId: id, nova: true });
      }
    }
  }
}

export const handlersRodadas: Handlers = {
  'rodadas.listar': (_d, ctx) => linhasRodadas(ctx).map((r) => paraRodada(ctx, r)),

  'rodadas.salvar': (r, ctx) => {
    const { repo } = ctx.portas;
    if (!r.nome?.trim()) throw validacao('Informe o nome da rodada.');
    if (!PRAZO.test(r.prazo ?? '')) throw validacao('Informe o prazo da rodada.');
    if (!r.sessaoIds?.length) throw validacao('Escolha ao menos uma sessão.');
    const ativas = new Set(linhasSessoes(ctx).filter((s) => s.status === 'ativa').map((s) => s.id));
    if (r.sessaoIds.some((id) => !ativas.has(id))) throw validacao('Sessão não encontrada ou cancelada.');
    const apoio = new Set(linhasSessoes(ctx).filter((s) => s.atividade && s.atividade !== 'evento').map((s) => s.id));
    if (r.sessaoIds.some((id) => apoio.has(id))) throw validacao('Atividades de apoio (montagem, passagem de som…) não entram na rodada de disponibilidade.');

    const anterior = r.id ? linhasRodadas(ctx).find((x) => x.id === r.id) : undefined;
    if (r.id && !anterior) throw new ErroApi('NAO_ENCONTRADO', 'Rodada não encontrada.');
    const id = anterior?.id ?? novoId(ctx.portas, 'r');
    const linha: LinhaRodada = { id, nome: r.nome.trim(), prazo: r.prazo, status: r.status === 'fechada' ? 'fechada' : 'aberta' };
    if (anterior) repo.atualizar('rodadas', linha);
    else repo.inserir('rodadas', linha);

    const ligadas = linhasRodadaSessoes(ctx).filter((x) => x.rodadaId === id);
    for (const x of ligadas) if (!r.sessaoIds.includes(x.sessaoId)) repo.remover('rodadaSessoes', x.id);
    for (const sessaoId of r.sessaoIds) {
      if (!ligadas.some((x) => x.sessaoId === sessaoId)) repo.inserir('rodadaSessoes', { id: `${id}:${sessaoId}`, rodadaId: id, sessaoId, nova: false });
    }

    if (anterior) {
      registrar(ctx, 'rodada', id, `alterou a rodada (${linha.status})`, anterior, linha);
    } else {
      const quando = `${linha.prazo.slice(8, 10)}/${linha.prazo.slice(5, 7)} às ${linha.prazo.slice(11, 16)}`;
      const ativos = linhasPessoas(ctx).filter((p) => p.ativo).map((p) => p.id);
      notificar(ctx, ativos, `Rodada de disponibilidade aberta: ${linha.nome}. Responda até ${quando}.`, '/disponibilidade');
      registrar(ctx, 'rodada', id, 'abriu a rodada', null, linha);
    }
    return paraRodada(ctx, linha);
  },

  'disponibilidades.listar': ({ sessaoIds }, ctx) => {
    const todas = pode(ctx.eu!.permissoes, 'escalas', 'ver');
    return linhasDisponibilidades(ctx)
      .filter((d) => sessaoIds.includes(d.sessaoId) && (todas || d.pessoaId === ctx.eu!.id))
      .map(({ pessoaId, sessaoId, disponivel, origem }): Disponibilidade => ({ pessoaId, sessaoId, disponivel: !!disponivel, origem }));
  },

  'disponibilidades.marcar': ({ sessaoId, disponivel, pessoaId }, ctx) => {
    const [d] = marcarVarias(ctx, pessoaId, [{ sessaoId, disponivel }]);
    if (d.origem === 'gestor') registrar(ctx, 'sessao', sessaoId, `marcou disponibilidade por outra pessoa (${disponivel ? 'Sim' : 'Não'})`, null, { pessoaId: d.pessoaId });
    return d;
  },

  /** Várias marcações numa ida só (a tela junta os cliques): confere todas antes de gravar qualquer uma. */
  'disponibilidades.marcarVarios': ({ pessoaId, itens }, ctx) => {
    if (!Array.isArray(itens) || !itens.length || itens.length > 200) throw new ErroApi('VALIDACAO', 'Mande de 1 a 200 marcações.');
    const feitas = marcarVarias(ctx, pessoaId, itens);
    if (feitas[0].origem === 'gestor') {
      registrar(ctx, 'sessao', itens.map((i) => i.sessaoId).join(','), `marcou disponibilidade por outra pessoa em ${feitas.length} sessão(ões)`, null, { pessoaId: feitas[0].pessoaId, itens });
    }
    return feitas;
  },
};

/** Confere cada marcação (permissão, prazo, já escalado) e só então grava todas. */
function marcarVarias(ctx: Contexto, pessoaId: string | undefined, itens: { sessaoId: string; disponivel: boolean }[]): Disponibilidade[] {
  const eu = ctx.eu!;
  const alvo = pessoaId ?? eu.id;
  const porOutro = alvo !== eu.id;
  if (porOutro) {
    if (!pode(eu.permissoes, 'escalas', 'editar')) throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    if (!linhasPessoas(ctx).some((p) => p.id === alvo && p.ativo)) throw new ErroApi('NAO_ENCONTRADO', 'Pessoa não encontrada ou inativa.');
  }
  const sessoes = new Set(linhasSessoes(ctx).map((s) => s.id));
  const conferidas = itens.map(({ sessaoId, disponivel }) => {
    let origem: Disponibilidade['origem'] = 'gestor';
    if (porOutro) {
      if (!sessoes.has(sessaoId)) throw new ErroApi('NAO_ENCONTRADO', 'Sessão não encontrada.');
    } else {
      const aberta = sessaoAbertaPara(ctx, sessaoId);
      if (!aberta) throw new ErroApi('PRAZO', 'O prazo para marcar disponibilidade nesta sessão terminou.');
      if (aberta === 'convocacao' && linhasEscalas(ctx).some((e) => e.sessaoId === sessaoId && e.pessoaId === alvo && e.status !== 'cancelado')) {
        throw new ErroApi('JA_ESCALADO', 'Você já está escalado(a) nesta sessão.');
      }
      origem = aberta === 'convocacao' ? 'convocacao' : 'proprio';
    }
    return { pessoaId: alvo, sessaoId, disponivel: !!disponivel, origem };
  });
  const existentes = new Set(linhasDisponibilidades(ctx).map((d) => d.id));
  const novas: LinhaDisponibilidade[] = [];
  for (const d of conferidas) {
    const linha: LinhaDisponibilidade = { id: `${alvo}:${d.sessaoId}`, ...d, respondidoEm: ctx.portas.relogio.agora() };
    if (existentes.has(linha.id)) ctx.portas.repo.atualizar('disponibilidades', linha);
    else if (!novas.some((n) => n.id === linha.id)) novas.push(linha);
  }
  ctx.portas.repo.inserirVarios('disponibilidades', novas);
  return conferidas;
}
