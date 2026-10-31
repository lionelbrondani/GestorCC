import { ehGestor, ErroApi, pode, type Aviso, type Notificacao } from '@shared';
import { exigirVersao, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';

type LinhaAviso = Omit<Aviso, 'leituras'> & { atualizadoPor?: string };
type LinhaLeitura = { id: string; avisoId: string; pessoaId: string; lidoEm: string };
type LinhaNotificacao = { id: string; pessoaId: string; texto: string; link: string; lida: boolean; criadoEm: string };

function montarAvisos(ctx: Contexto): Aviso[] {
  const leituras = ctx.portas.repo.listar<LinhaLeitura>('avisosLeituras');
  return ctx.portas.repo.listar<LinhaAviso>('avisos').map(({ atualizadoPor: _p, ...a }) => {
    const { criadoEm, ...resto } = a as LinhaAviso & { criadoEm: string };
    return {
      ...resto,
      criadoEm,
      pessoasIds: resto.pessoasIds ?? [],
      validoAte: resto.validoAte || null,
      leituras: leituras.filter((l) => l.avisoId === a.id).map((l) => l.pessoaId),
    };
  });
}

const nomeDe = (ctx: Contexto) => (id: string) =>
  ctx.portas.repo.listar<{ id: string; nome: string }>('pessoas').find((p) => p.id === id)?.nome ?? 'Outra pessoa';

export const handlersAvisos: Handlers = {
  'avisos.listar': (_d, ctx) => {
    const eu = ctx.eu!;
    const hoje = ctx.portas.relogio.hoje();
    const editor = pode(eu.permissoes, 'mural', 'editar');
    const gestor = ehGestor(eu.permissoes);
    return montarAvisos(ctx)
      .filter((a) => editor || !a.validoAte || a.validoAte >= hoje)
      .filter(
        (a) =>
          editor ||
          a.publico === 'todos' ||
          (a.publico === 'gestores' && gestor) ||
          (a.publico === 'bolsistas' && eu.tipo === 'bolsista') ||
          (a.publico === 'pessoas' && a.pessoasIds.includes(eu.id)),
      )
      .sort((a, b) => Number(b.fixado) - Number(a.fixado) || b.criadoEm.localeCompare(a.criadoEm));
  },

  'avisos.salvar': (a, ctx) => {
    if (!a.titulo?.trim()) throw new ErroApi('TITULO', 'Informe o título do aviso.');
    const { repo } = ctx.portas;
    const anterior = a.id ? repo.listar<LinhaAviso>('avisos').find((x) => x.id === a.id) : undefined;
    if (a.id && !anterior) throw new ErroApi('NAO_ENCONTRADO', 'Aviso não encontrado.');
    if (anterior) exigirVersao(anterior, a.atualizadoEm, nomeDe(ctx));
    const linha = {
      id: anterior?.id ?? novoId(ctx.portas, 'a'),
      titulo: a.titulo.trim(), texto: a.texto ?? '', publico: a.publico, pessoasIds: a.pessoasIds ?? [], fixado: !!a.fixado,
      validoAte: a.validoAte ?? '', pedeConfirmacao: !!a.pedeConfirmacao, autorId: anterior?.autorId || ctx.eu!.id,
    };
    if (anterior) repo.atualizar('avisos', linha);
    else repo.inserir('avisos', linha);
    registrar(ctx, 'aviso', linha.id, anterior ? 'alterou aviso' : 'publicou aviso', null, { titulo: linha.titulo, publico: linha.publico });
    return montarAvisos(ctx).find((x) => x.id === linha.id)!;
  },

  'avisos.confirmarLeitura': ({ avisoId }, ctx) => {
    const id = `${avisoId}:${ctx.eu!.id}`;
    if (!ctx.portas.repo.listar<LinhaLeitura>('avisosLeituras').some((l) => l.id === id)) {
      ctx.portas.repo.inserir('avisosLeituras', { id, avisoId, pessoaId: ctx.eu!.id, lidoEm: ctx.portas.relogio.agora() });
    }
    return null;
  },

  'notificacoes.listar': (_d, ctx): Notificacao[] =>
    ctx.portas.repo
      .listar<LinhaNotificacao>('notificacoes')
      .filter((n) => n.pessoaId === ctx.eu!.id)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, 100)
      .map((n) => ({ id: n.id, pessoaId: n.pessoaId, texto: n.texto, link: n.link, criadaEm: n.criadoEm, lida: n.lida })),

  'notificacoes.marcarLidas': (_d, ctx) => {
    for (const n of ctx.portas.repo.listar<LinhaNotificacao>('notificacoes')) {
      if (n.pessoaId === ctx.eu!.id && !n.lida) ctx.portas.repo.atualizar('notificacoes', { ...n, lida: true });
    }
    return null;
  },
};
