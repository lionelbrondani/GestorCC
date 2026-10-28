import { errosDoPedido, ErroApi, eventoDoPedido, formatarData, limparPedido, pode, type Evento, type PedidoDatas, type PedidoDatasDados } from '@shared';
import { comPermissoes, notificar, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { handlersContratos } from './contratos';
import { handlersEventos } from './eventos';
import { configAtual } from './sistema';

/** Na planilha Dados: o pedido sem os dados pessoais (que ficam em `pedidosSigilo`). */
type LinhaPedido = {
  id: string;
  protocolo: string;
  status: PedidoDatas['status'];
  dados: Omit<PedidoDatasDados, 'solicitante' | 'responsavel'>;
  recebidoEm: string;
  decididoEm: string;
  decididoPor: string;
  motivoRecusa: string;
  eventoId: string;
  dadosApagadosEm?: string;
  atualizadoPor?: string;
};
type LinhaSigilo = { id: string; solicitante: PedidoDatasDados['solicitante']; responsavel: PedidoDatasDados['responsavel'] };

/** Mais que isso num dia, pela página pública, é robô ou engano. */
const PEDIDOS_POR_DIA = 30;

const linhasPedidos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaPedido>('pedidos');
const semCarimbo = <T extends { atualizadoPor?: string }>({ atualizadoPor: _p, ...l }: T) => l;
const digitos = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

function montar(linha: LinhaPedido, sigilo: LinhaSigilo | undefined): PedidoDatas {
  return {
    ...(linha.dados as Omit<PedidoDatasDados, 'solicitante' | 'responsavel'>),
    solicitante: sigilo?.solicitante ?? { razaoSocial: '', documento: '', endereco: '', cep: '', inscricaoEstadual: '', inscricaoMunicipal: '' },
    responsavel: sigilo?.responsavel ?? { nome: '', cpf: '', email: '', telefone: '' },
    id: linha.id,
    protocolo: linha.protocolo,
    status: linha.status,
    recebidoEm: linha.recebidoEm,
    decididoEm: linha.decididoEm || '',
    motivoRecusa: linha.motivoRecusa || '',
    eventoId: linha.eventoId || null,
  };
}

function obter(ctx: Contexto, id: string): { linha: LinhaPedido; pedido: PedidoDatas } {
  const linha = linhasPedidos(ctx).find((l) => l.id === id);
  if (!linha) throw new ErroApi('NAO_ENCONTRADO', 'Pedido não encontrado.');
  return { linha, pedido: montar(linha, ctx.portas.repo.listar<LinhaSigilo>('pedidosSigilo').find((s) => s.id === id)) };
}

function decidir(ctx: Contexto, linha: LinhaPedido, mudanca: Partial<LinhaPedido>): void {
  if (linha.status !== 'novo') throw new ErroApi('DECIDIDO', 'Este pedido já foi decidido.');
  ctx.portas.repo.atualizar('pedidos', { ...semCarimbo(linha), ...mudanca, decididoEm: ctx.portas.relogio.agora(), decididoPor: ctx.eu!.id });
}

/** O solicitante vira contratante, para o contrato; se já existe um com o mesmo documento, fica o que já existe. */
function cadastrarContratante(ctx: Contexto, p: PedidoDatas): void {
  const doc = digitos(p.solicitante.documento);
  if (!doc || ctx.portas.repo.listar<{ id: string; documento: string }>('contratantes').some((k) => digitos(k.documento) === doc)) return;
  const s = p.solicitante;
  const r = p.responsavel;
  handlersContratos['contratantes.salvar']!(
    {
      id: '', razaoSocial: s.razaoSocial, documento: s.documento, inscricaoMunicipal: s.inscricaoMunicipal, inscricaoEstadual: s.inscricaoEstadual,
      endereco: s.endereco, cep: s.cep, representanteNome: r.nome, email: r.email, contatoFaturaNome: r.nome, contatoFaturaEmail: r.email, contatoFaturaTelefone: r.telefone,
    },
    ctx,
  );
}

export const handlersPedidos: Handlers = {
  'pedido.abrir': (_d, ctx) => ({ diasGuardarDados: configAtual(ctx).diasGuardarFicha }),

  'pedido.enviar': ({ dados, antiRobo, site }, ctx) => {
    const { repo, relogio, props } = ctx.portas;
    // armadilha: o campo "site" fica escondido na página; só robô preenche. Ele recebe "sucesso" e nada é gravado.
    if (site) return { protocolo: 'PD-0000-0000' };
    const segredo = props.obter('TURNSTILE_SECRET');
    if (segredo && !(typeof antiRobo === 'string' && antiRobo && ctx.portas.antiRobo.verificar(antiRobo, segredo))) {
      throw new ErroApi('ANTI_ROBO', 'Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.');
    }
    const hoje = relogio.hoje();
    const linhas = linhasPedidos(ctx);
    if (linhas.filter((l) => String(l.recebidoEm).startsWith(hoje)).length >= PEDIDOS_POR_DIA) {
      throw new ErroApi('LIMITE', 'Recebemos muitos pedidos hoje. Tente amanhã ou fale com o Centro de Convenções.');
    }
    const d = limparPedido(dados);
    const [erro] = errosDoPedido(d, hoje);
    if (erro) throw new ErroApi('VALIDACAO', erro.mensagem);

    const ano = hoje.slice(0, 4);
    const protocolo = `PD-${ano}-${String(linhas.filter((l) => String(l.protocolo).startsWith(`PD-${ano}-`)).length + 1).padStart(4, '0')}`;
    const id = novoId(ctx.portas, 'pd');
    const { solicitante, responsavel, ...publico } = d;
    repo.inserir('pedidos', { id, protocolo, status: 'novo', dados: publico, recebidoEm: relogio.agora(), decididoEm: '', decididoPor: '', motivoRecusa: '', eventoId: '' });
    repo.inserir('pedidosSigilo', { id, solicitante, responsavel });

    // aviso no sininho de quem cuida dos eventos (nenhum e-mail sai sozinho)
    const permissoes = repo.listar<{ id: string; pessoaId: string; modulo: string; nivel: 'nenhum' | 'ver' | 'editar' }>('permissoes');
    const gestores = repo
      .listar<{ id: string; ativo: boolean }>('pessoas')
      .filter((p) => p.ativo)
      .map((p) => comPermissoes(p as never, permissoes))
      .filter((p) => pode(p.permissoes, 'eventos', 'editar'))
      .map((p) => p.id);
    const primeira = [...d.dias].sort((a, b) => a.data.localeCompare(b.data))[0];
    notificar(ctx, gestores, `Novo pedido de data: ${d.evento} (${formatarData(primeira.data)})`, '/pedidos');
    registrar(ctx, 'pedido', id, `recebeu o pedido ${protocolo}`, null, null);
    return { protocolo };
  },

  'pedidos.listar': (_d, ctx) => {
    const sigilos = new Map(ctx.portas.repo.listar<LinhaSigilo>('pedidosSigilo').map((s) => [s.id, s]));
    const primeira = (p: PedidoDatas) => [...p.dias].map((d) => d.data).sort()[0] ?? '';
    const todos = linhasPedidos(ctx).map((l) => montar(l, sigilos.get(l.id)));
    // os que esperam decisão primeiro, pela data pedida; depois os decididos, do mais recente
    return [
      ...todos.filter((p) => p.status === 'novo').sort((a, b) => primeira(a).localeCompare(primeira(b))),
      ...todos.filter((p) => p.status !== 'novo').sort((a, b) => b.decididoEm.localeCompare(a.decididoEm)),
    ];
  },

  'pedidos.aprovar': ({ id }, ctx) => {
    const { linha, pedido } = obter(ctx, id);
    if (linha.status !== 'novo') throw new ErroApi('DECIDIDO', 'Este pedido já foi decidido.');
    const cfg = configAtual(ctx);
    const { evento, sessoes } = eventoDoPedido(pedido, { vagasBolsistas: cfg.vagasBolsistasPadrao, vagasServidores: cfg.vagasServidoresPadrao, minimoExperientes: cfg.minimoExperientesPadrao });
    // o mesmo caminho do "Novo evento": confere, grava, entra na agenda Google e na rodada aberta
    const criado = handlersEventos['eventos.salvar']!({ evento, sessoes }, ctx) as { evento: Evento };
    if (pode(ctx.eu!.permissoes, 'contratos', 'editar')) cadastrarContratante(ctx, pedido);
    decidir(ctx, linha, { status: 'aprovado', eventoId: criado.evento.id });
    registrar(ctx, 'pedido', id, `aprovou o pedido ${linha.protocolo} e criou o evento`, null, null);
    return { pedido: obter(ctx, id).pedido, eventoId: criado.evento.id };
  },

  'pedidos.recusar': ({ id, motivo }, ctx) => {
    const texto = String(motivo ?? '').trim();
    if (!texto) throw new ErroApi('VALIDACAO', 'Informe o motivo da recusa.');
    const { linha } = obter(ctx, id);
    decidir(ctx, linha, { status: 'recusado', motivoRecusa: texto.slice(0, 500) });
    registrar(ctx, 'pedido', id, `recusou o pedido ${linha.protocolo}`, null, null, texto);
    return obter(ctx, id).pedido;
  },
};
