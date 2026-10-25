import { ErroApi, type Avaliacao } from '@shared';
import { linhasPessoas } from '../escalas/comum';
import { registrar, type Handlers } from '../nucleo/roteador';

interface LinhaAvaliacao extends Avaliacao {
  id: string;
  autorId: string;
}

/** Nota mensal de 1 a 5 por bolsista, visível só para quem tem acesso a Escalas (spec 7.9). */
export const handlersAvaliacoes: Handlers = {
  'avaliacoes.listar': ({ mes }, ctx) =>
    ctx.portas.repo
      .listar<LinhaAvaliacao>('avaliacoes')
      .filter((a) => a.mes === mes)
      .map(({ pessoaId, mes: m, nota, observacao }) => ({ pessoaId, mes: m, nota: Number(nota) as Avaliacao['nota'], observacao: observacao ?? '' })),

  'avaliacoes.salvar': (a, ctx) => {
    if (!Number.isInteger(a.nota) || a.nota < 1 || a.nota > 5) throw new ErroApi('NOTA', 'A nota vai de 1 a 5.');
    if (!/^\d{4}-\d{2}$/.test(a.mes ?? '')) throw new ErroApi('VALIDACAO', 'Mês inválido.');
    if (!linhasPessoas(ctx).some((p) => p.id === a.pessoaId)) throw new ErroApi('NAO_ENCONTRADO', 'Pessoa não encontrada.');
    const id = `${a.pessoaId}:${a.mes}`;
    const linha: LinhaAvaliacao = { id, pessoaId: a.pessoaId, mes: a.mes, nota: a.nota, observacao: (a.observacao ?? '').trim(), autorId: ctx.eu!.id };
    const existe = ctx.portas.repo.listar<LinhaAvaliacao>('avaliacoes').some((x) => x.id === id);
    if (existe) ctx.portas.repo.atualizar('avaliacoes', linha);
    else ctx.portas.repo.inserir('avaliacoes', linha);
    registrar(ctx, 'pessoa', a.pessoaId, 'avaliou', null, { mes: a.mes, nota: a.nota });
    return { pessoaId: linha.pessoaId, mes: linha.mes, nota: linha.nota, observacao: linha.observacao };
  },
};
