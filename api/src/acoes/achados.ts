import { erroDaSaida, erroDoAchado, ErroApi, limparAchado, pode, type Achado, type SaidaAchado, type StatusAchado } from '@shared';
import { novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';

/** Na planilha Dados; quem retirou fica em `achadosSigilo`. */
type LinhaAchado = {
  id: string;
  numero: number;
  descricao: string;
  achadoEm: string;
  local: string;
  eventoId: string;
  guardadoEm: string;
  observacoes: string;
  status: StatusAchado;
  fotoId: string;
  registradoPorId: string;
  saidaEm: string;
  destino: string;
  dadosApagadosEm: string;
  criadoEm?: string;
  atualizadoPor?: string;
};
type LinhaSigilo = { id: string; retiradoPor: string; contatoRetirada: string };

const PASTA = 'Achados e perdidos';
const STATUS: StatusAchado[] = ['guardado', 'devolvido', 'descartado'];
const SAIDA: Record<StatusAchado, string> = { guardado: 'voltou para os guardados', devolvido: 'devolveu ao dono', descartado: 'descartou' };

const linhas = (ctx: Contexto) => ctx.portas.repo.listar<LinhaAchado>('achados');
const sigilos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaSigilo>('achadosSigilo');
const semCarimbo = ({ criadoEm: _c, atualizadoPor: _p, ...l }: LinhaAchado) => l;
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

function paraAchado(l: LinhaAchado, sigilo: LinhaSigilo | undefined, comRetirada: boolean): Achado {
  return {
    id: l.id, numero: Number(l.numero), descricao: l.descricao, achadoEm: l.achadoEm, local: l.local ?? '', eventoId: l.eventoId || null,
    guardadoEm: l.guardadoEm ?? '', observacoes: l.observacoes ?? '', status: l.status, temFoto: !!l.fotoId, registradoPorId: l.registradoPorId ?? '',
    saidaEm: l.saidaEm || null, destino: l.destino ?? '', dadosApagadosEm: l.dadosApagadosEm ?? '',
    retiradoPor: comRetirada ? (sigilo?.retiradoPor ?? '') : '',
    contatoRetirada: comRetirada ? (sigilo?.contatoRetirada ?? '') : '',
  };
}

function obter(ctx: Contexto, id: string): LinhaAchado {
  const l = linhas(ctx).find((x) => x.id === id);
  if (!l) throw new ErroApi('NAO_ENCONTRADO', 'Item não encontrado.');
  return l;
}

const reler = (ctx: Contexto, id: string) => paraAchado(obter(ctx, id), sigilos(ctx).find((s) => s.id === id), true);

function gravarSigilo(ctx: Contexto, id: string, retiradoPor: string, contatoRetirada: string): void {
  const linha = { id, retiradoPor, contatoRetirada };
  if (sigilos(ctx).some((s) => s.id === id)) ctx.portas.repo.atualizar('achadosSigilo', linha);
  else if (retiradoPor || contatoRetirada) ctx.portas.repo.inserir('achadosSigilo', linha);
}

export const handlersAchados: Handlers = {
  'achados.listar': (_d, ctx) => {
    const comRetirada = pode(ctx.eu!.permissoes, 'achados', 'editar');
    const sigilo = new Map(sigilos(ctx).map((s) => [s.id, s]));
    return linhas(ctx)
      .map((l) => paraAchado(l, sigilo.get(l.id), comRetirada))
      .sort((a, b) => a.achadoEm.localeCompare(b.achadoEm) || a.numero - b.numero);
  },

  'achados.salvar': ({ id, dados, foto }, ctx) => {
    const { repo, relogio, arquivos } = ctx.portas;
    const d = limparAchado(dados);
    const erro = erroDoAchado(d, relogio.hoje());
    if (erro) throw new ErroApi('VALIDACAO', erro);
    const anterior = id ? obter(ctx, id) : null;
    const numero = anterior ? Number(anterior.numero) : Math.max(0, ...linhas(ctx).map((l) => Number(l.numero))) + 1;

    // a foto nova vai para o Drive antes de a antiga ir para a lixeira
    let fotoId = anterior?.fotoId ?? '';
    if (foto !== undefined) {
      if (foto !== null && !(typeof foto === 'string' && foto.startsWith('data:image/'))) throw new ErroApi('VALIDACAO', 'A foto precisa ser uma imagem.');
      const nova = foto ? arquivos.salvarImagem(foto, `Achado ${numero} - ${d.descricao.slice(0, 60)}`, PASTA) : '';
      if (fotoId) arquivos.apagarImagem(fotoId);
      fotoId = nova;
    }

    if (anterior) {
      repo.atualizar('achados', { ...semCarimbo(anterior), ...d, eventoId: d.eventoId ?? '', fotoId });
      registrar(ctx, 'achado', anterior.id, `editou o achado #${numero}`, null, null);
      return reler(ctx, anterior.id);
    }
    const novo = novoId(ctx.portas, 'ac');
    repo.inserir('achados', {
      id: novo, numero, ...d, eventoId: d.eventoId ?? '', status: 'guardado', fotoId, registradoPorId: ctx.eu!.id, saidaEm: '', destino: '', dadosApagadosEm: '',
    });
    registrar(ctx, 'achado', novo, `registrou o achado #${numero}: ${d.descricao}`, null, null);
    return reler(ctx, novo);
  },

  'achados.foto': ({ id }, ctx) => {
    const l = obter(ctx, id);
    return l.fotoId ? ctx.portas.arquivos.lerImagem(l.fotoId) : null;
  },

  'achados.situacao': ({ id, status, data, retiradoPor, contatoRetirada, destino }, ctx) => {
    const l = obter(ctx, id);
    if (!STATUS.includes(status)) throw new ErroApi('VALIDACAO', 'Situação inválida.');
    const s: SaidaAchado = { status, data: texto(data, 10), retiradoPor: texto(retiradoPor, 120), contatoRetirada: texto(contatoRetirada, 120), destino: texto(destino, 120) };
    const erro = erroDaSaida(s, l, ctx.portas.relogio.hoje());
    if (erro) throw new ErroApi('VALIDACAO', erro);
    const devolvido = status === 'devolvido';
    ctx.portas.repo.atualizar('achados', { ...semCarimbo(l), status, saidaEm: status === 'guardado' ? '' : s.data, destino: status === 'descartado' ? s.destino! : '' });
    gravarSigilo(ctx, id, devolvido ? s.retiradoPor! : '', devolvido ? s.contatoRetirada! : '');
    registrar(ctx, 'achado', id, `${SAIDA[status]}: achado #${l.numero}`, null, null);
    return reler(ctx, id);
  },
};
