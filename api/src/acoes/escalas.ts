import { contaNaEscala, ErroApi, pode, type Escala } from '@shared';
import { sincronizarAgenda } from '../agenda/sincronizar';
import { exigirSemConflito, linhasDisponibilidades, linhasEscalas, linhasPessoas, nomeSessao, paraEscala, type LinhaEscala } from '../escalas/comum';
import { notificar, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { marcarEscalaPendente, marcarRelatorios } from '../relatorios/pendentes';
import { linhasEventos, linhasSessoes, paraEvento, paraSessao, type LinhaSessao } from './eventos';

export function sessaoOuErro(ctx: Contexto, sessaoId: string): LinhaSessao {
  const s = linhasSessoes(ctx).find((x) => x.id === sessaoId);
  if (!s) throw new ErroApi('NAO_ENCONTRADO', 'Sessão não encontrada.');
  return s;
}

export function exigirSessaoAtiva(s: LinhaSessao): void {
  if (s.status === 'cancelada') throw new ErroApi('SESSAO_CANCELADA', 'Esta sessão foi cancelada.');
}

export function nomeDaSessao(ctx: Contexto, s: LinhaSessao): string {
  const ev = linhasEventos(ctx).find((e) => e.id === s.eventoId);
  return ev ? nomeSessao(paraEvento(ev), paraSessao(s)) : s.data;
}

export const estaDisponivel = (ctx: Contexto, pessoaId: string, sessaoId: string) =>
  linhasDisponibilidades(ctx).some((d) => d.pessoaId === pessoaId && d.sessaoId === sessaoId && d.disponivel);

const mesesDe = (ctx: Contexto, sessaoIds: string[]) => linhasSessoes(ctx).filter((s) => sessaoIds.includes(s.id)).map((s) => s.data.slice(0, 7));
const PAPEL_ERRADO = () => new ErroApi('PAPEL', 'Servidor só ocupa vaga de servidor, e bolsista, vaga de bolsista.');
const escalasDaSessao = (ctx: Contexto, sessaoId: string): Escala[] => linhasEscalas(ctx).filter((e) => e.sessaoId === sessaoId).map(paraEscala);

export const handlersEscalas: Handlers = {
  'escalas.listar': ({ de, ate }, ctx) => {
    const doPeriodo = new Set(linhasSessoes(ctx).filter((s) => s.data >= de && s.data <= ate).map((s) => s.id));
    const escalas = linhasEscalas(ctx).filter((e) => doPeriodo.has(e.sessaoId)).map(paraEscala);
    if (pode(ctx.eu!.permissoes, 'escalas', 'ver')) return escalas;
    // quem não monta escala vê só as próprias sessões publicadas, com os colegas (spec 7.4)
    const visiveis = escalas.filter((e) => e.status !== 'rascunho');
    const minhas = new Set(visiveis.filter((e) => e.pessoaId === ctx.eu!.id).map((e) => e.sessaoId));
    return visiveis.filter((e) => minhas.has(e.sessaoId));
  },

  'escalas.salvarRascunho': ({ sessaoId, itens }, ctx) => {
    const sessao = sessaoOuErro(ctx, sessaoId);
    exigirSessaoAtiva(sessao);
    const pessoas = linhasPessoas(ctx);
    const atuais = linhasEscalas(ctx).filter((e) => e.sessaoId === sessaoId);
    const jaNaSessao = new Set(atuais.filter((e) => e.status !== 'rascunho' && contaNaEscala(paraEscala(e))).map((e) => e.pessoaId));

    const validos = itens.filter((i) => !jaNaSessao.has(i.pessoaId));
    for (const i of validos) {
      const p = pessoas.find((x) => x.id === i.pessoaId && x.ativo);
      if (!p) throw new ErroApi('NAO_ENCONTRADO', 'Pessoa não encontrada ou inativa.');
      if (p.tipo !== i.papel) throw PAPEL_ERRADO();
      exigirSemConflito(ctx, i.pessoaId, paraSessao(sessao));
    }

    for (const e of atuais.filter((x) => x.status === 'rascunho')) ctx.portas.repo.remover('escalas', e.id);
    for (const i of validos) {
      const adicaoDireta = !estaDisponivel(ctx, i.pessoaId, sessaoId);
      const linha: LinhaEscala = { id: novoId(ctx.portas, 'x'), sessaoId, pessoaId: i.pessoaId, papel: i.papel, status: 'rascunho', adicaoDireta, loteId: '' };
      ctx.portas.repo.inserir('escalas', linha);
      if (adicaoDireta) {
        const nome = pessoas.find((x) => x.id === i.pessoaId)!.nomeCurto;
        registrar(ctx, 'sessao', sessaoId, `escalou ${nome} sem disponibilidade`, null, { pessoaId: i.pessoaId });
      }
    }
    registrar(ctx, 'sessao', sessaoId, `salvou rascunho (${validos.length} pessoa(s))`, null, null);
    return escalasDaSessao(ctx, sessaoId);
  },

  'escalas.publicar': ({ sessaoIds }, ctx) => {
    const { repo } = ctx.portas;
    const agora = ctx.portas.relogio.agora();
    const rascunhos = linhasEscalas(ctx).filter((e) => sessaoIds.includes(e.sessaoId) && e.status === 'rascunho');
    for (const e of rascunhos) repo.atualizar('escalas', { ...e, status: 'publicado' });
    const publicadas = [...new Set(rascunhos.map((e) => e.sessaoId))];
    for (const s of linhasSessoes(ctx).filter((x) => publicadas.includes(x.id))) repo.atualizar('sessoes', { ...s, publicadaEm: agora });
    notificar(ctx, rascunhos.map((e) => e.pessoaId), 'Sua escala foi publicada. Confira os horários.', '/minhas-escalas');
    registrar(ctx, 'escala', sessaoIds.join(','), `publicou ${publicadas.length} sessão(ões)`, null, null);
    sincronizarAgenda(ctx.portas, publicadas);
    marcarEscalaPendente(ctx.portas.props, mesesDe(ctx, publicadas));
    return null;
  },

  /** Toda mudança depois de publicada é uma troca com justificativa (spec 7.5). */
  'escalas.trocar': ({ sessaoId, sai, entra, justificativa }, ctx) => {
    const motivo = (justificativa ?? '').trim();
    if (!motivo) throw new ErroApi('JUSTIFICATIVA', 'Informe a justificativa da troca.');
    if (!sai && !entra) throw new ErroApi('TROCA_VAZIA', 'Escolha quem sai e/ou quem entra.');
    const sessao = sessaoOuErro(ctx, sessaoId);
    exigirSessaoAtiva(sessao);
    const pessoas = linhasPessoas(ctx);
    const daSessao = linhasEscalas(ctx).filter((e) => e.sessaoId === sessaoId && (e.status === 'publicado' || e.status === 'rascunho'));
    const saindo = sai ? daSessao.find((e) => e.pessoaId === sai) : undefined;
    if (sai && !saindo) throw new ErroApi('NAO_ENCONTRADO', 'Esta pessoa não está escalada nesta sessão.');

    const quemEntra = entra ? pessoas.find((p) => p.id === entra && p.ativo) : undefined;
    if (entra && !quemEntra) throw new ErroApi('NAO_ENCONTRADO', 'Pessoa não encontrada ou inativa.');
    const papel = saindo?.papel ?? quemEntra!.tipo;
    if (quemEntra) {
      if (quemEntra.tipo !== papel) throw new ErroApi('PAPEL', 'Servidor só pode ser trocado por servidor, e bolsista por bolsista.');
      if (daSessao.some((e) => e.pessoaId === entra)) throw new ErroApi('DUPLICADO', 'Esta pessoa já está escalada nesta sessão.');
      exigirSemConflito(ctx, quemEntra.id, paraSessao(sessao));
    }

    if (saindo) ctx.portas.repo.remover('escalas', saindo.id);
    if (quemEntra) {
      ctx.portas.repo.inserir('escalas', {
        id: novoId(ctx.portas, 'x'), sessaoId, pessoaId: quemEntra.id, papel, status: saindo?.status ?? 'publicado',
        adicaoDireta: !estaDisponivel(ctx, quemEntra.id, sessaoId), loteId: '',
      } satisfies LinhaEscala);
    }

    const nome = nomeDaSessao(ctx, sessao);
    if (sai) notificar(ctx, [sai], `Você foi retirado(a) da escala: ${nome}.`, '/minhas-escalas');
    if (entra) notificar(ctx, [entra], `Você foi escalado(a): ${nome}.`, '/minhas-escalas');
    const curto = (id: string | null) => (id ? (pessoas.find((p) => p.id === id)?.nomeCurto ?? id) : '—');
    registrar(ctx, 'troca', sessaoId, `troca: sai ${curto(sai)}, entra ${curto(entra)}`, { sai }, { entra }, motivo);
    sincronizarAgenda(ctx.portas, [sessaoId]);
    marcarRelatorios(ctx.portas.props, [`escala:${sessao.data.slice(0, 7)}`, 'trocas']);
    return escalasDaSessao(ctx, sessaoId);
  },

  /** Mais vagas numa sessão publicada; reabre a disponibilidade só para quem está fora (spec 7.6). */
  'escalas.convocar': ({ sessaoId, vagas, abertaAte }, ctx) => {
    const sessao = sessaoOuErro(ctx, sessaoId);
    exigirSessaoAtiva(sessao);
    if (!sessao.publicadaEm) throw new ErroApi('NAO_PUBLICADA', 'Publique a escala desta sessão antes de abrir convocação extra.');
    if (!Number.isInteger(vagas) || vagas < 1) throw new ErroApi('VAGAS', 'Informe ao menos 1 vaga extra.');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(abertaAte ?? '') || abertaAte <= ctx.portas.relogio.agora()) {
      throw new ErroApi('PRAZO', 'O prazo da convocação precisa ser no futuro.');
    }
    const atualizada: LinhaSessao = { ...sessao, vagasBolsistas: Number(sessao.vagasBolsistas) + vagas, convocacaoAbertaAte: abertaAte, convocacaoVagas: vagas };
    ctx.portas.repo.atualizar('sessoes', atualizada);

    const naSessao = new Set(linhasEscalas(ctx).filter((e) => e.sessaoId === sessaoId && e.status !== 'cancelado').map((e) => e.pessoaId));
    const alvos = linhasPessoas(ctx).filter((p) => p.ativo && p.tipo === 'bolsista' && !naSessao.has(p.id)).map((p) => p.id);
    notificar(ctx, alvos, `Precisamos de mais ${vagas} bolsista(s): ${nomeDaSessao(ctx, sessao)}. Marque se puder.`, '/disponibilidade');
    registrar(ctx, 'sessao', sessaoId, `abriu convocação extra (+${vagas})`, null, { vagas, abertaAte }, 'convocação extra');
    return paraSessao(atualizada);
  },

  /** Presente → realizado; ausente → faltou (spec 7.7). Pode ser refeita para corrigir, enquanto não houver lote. */
  'escalas.confirmarPresenca': ({ sessaoId, faltaram }, ctx) => {
    const sessao = sessaoOuErro(ctx, sessaoId);
    if (sessao.data > ctx.portas.relogio.hoje()) throw new ErroApi('FUTURA', 'Esta sessão ainda não aconteceu.');
    const confirmaveis = linhasEscalas(ctx).filter(
      (e) => e.sessaoId === sessaoId && !e.loteId && (e.status === 'publicado' || e.status === 'realizado' || e.status === 'faltou'),
    );
    for (const e of confirmaveis) {
      const status = faltaram.includes(e.pessoaId) ? 'faltou' : 'realizado';
      if (status === e.status) continue;
      ctx.portas.repo.atualizar('escalas', { ...e, status });
      if (status === 'faltou') registrar(ctx, 'pessoa', e.pessoaId, 'faltou', null, { sessaoId });
    }
    const faltas = confirmaveis.filter((e) => faltaram.includes(e.pessoaId)).length;
    registrar(ctx, 'sessao', sessaoId, `confirmou presença (${faltas} falta(s))`, null, null);
    marcarEscalaPendente(ctx.portas.props, [sessao.data.slice(0, 7)]);
    return escalasDaSessao(ctx, sessaoId);
  },
};
