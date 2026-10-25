import { contaNaEscala, ErroApi, pode, type Escala } from '@shared';
import { sincronizarAgenda } from '../agenda/sincronizar';
import { exigirSemConflito, linhasDisponibilidades, linhasEscalas, linhasPessoas, nomeSessao, paraEscala, type LinhaEscala } from '../escalas/comum';
import { notificar, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
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
    return null;
  },
};
