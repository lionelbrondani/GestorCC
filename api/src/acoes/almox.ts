import { ErroApi, formatarCod, pode, validarRetirada, type AlmoxItem, type AlmoxMovimento, type AlmoxPedido } from '@shared';
import { linhasPessoas } from '../escalas/comum';
import { novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { marcarRelatorios } from '../relatorios/pendentes';

type LinhaItem = AlmoxItem & { id: string };
type LinhaMovimento = Omit<AlmoxMovimento, 'quando'> & { quando: string };
type LinhaAutorizado = { id: string; nome: string; ativo: boolean };
type LinhaPedido = { id: string; solicitanteId: string; status: AlmoxPedido['status']; criadoEm?: string };
type LinhaPedidoItem = { id: string; pedidoId: string; cod: string; qtdPedida: number; qtdRecebida: number; valorEstimado: number };

const itens = (ctx: Contexto) => ctx.portas.repo.listar<LinhaItem>('almoxItens');
const movimentos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaMovimento>('almoxMovimentos');
const autorizados = (ctx: Contexto) => ctx.portas.repo.listar<LinhaAutorizado>('almoxAutorizadosExternos');
const pedidos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaPedido>('almoxPedidos');
const pedidoItens = (ctx: Contexto) => ctx.portas.repo.listar<LinhaPedidoItem>('almoxPedidoItens');

const paraItem = ({ id: _id, ...i }: LinhaItem): AlmoxItem => ({ ...i, valor: Number(i.valor), qtdMinima: Number(i.qtdMinima), saldo: Number(i.saldo) });
const semVazios = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined)) as T;
const paraMovimento = (m: LinhaMovimento): AlmoxMovimento => semVazios({ ...m, qtd: Number(m.qtd), valorUnitario: Number(m.valorUnitario) });

function paraPedido(ctx: Contexto, p: LinhaPedido): AlmoxPedido {
  return {
    id: p.id, criadoEm: p.criadoEm ?? '', solicitanteId: p.solicitanteId, status: p.status,
    itens: pedidoItens(ctx).filter((i) => i.pedidoId === p.id).map((i) => ({
      cod: i.cod, qtdPedida: Number(i.qtdPedida), qtdRecebida: Number(i.qtdRecebida), valorEstimado: Number(i.valorEstimado),
    })),
  };
}

function itemOuErro(ctx: Contexto, cod: string): LinhaItem {
  const i = itens(ctx).find((x) => x.id === formatarCod(cod));
  if (!i) throw new ErroApi('NAO_ENCONTRADO', 'Item não encontrado.');
  return i;
}

/** Todo movimento atualiza o saldo do item na mesma gravação (spec 10.1). */
function movimentar(ctx: Contexto, item: LinhaItem, m: Omit<LinhaMovimento, 'id' | 'quando' | 'cod' | 'valorUnitario'>): LinhaMovimento {
  const mov: LinhaMovimento = { id: novoId(ctx.portas, 'm'), quando: ctx.portas.relogio.agora(), cod: item.id, valorUnitario: Number(item.valor), ...m };
  ctx.portas.repo.inserir('almoxMovimentos', mov);
  const atual = itens(ctx).find((x) => x.id === item.id)!;
  ctx.portas.repo.atualizar('almoxItens', { ...atual, saldo: Number(atual.saldo) + Number(m.qtd) });
  return mov;
}

const marcarEstoque = (ctx: Contexto) => marcarRelatorios(ctx.portas.props, ['estoque']);

/** '8,50', 'R$ 8,50', 8.5 → 850 centavos. */
function centavos(v: unknown): number {
  if (typeof v === 'number') return Math.round(v * 100);
  const limpo = String(v ?? '').replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const handlersAlmox: Handlers = {
  'almox.listar': (_d, ctx) => {
    const p = ctx.eu!.permissoes;
    if (!pode(p, 'almoxEstoque', 'ver') && !pode(p, 'almoxSaidas', 'ver')) throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    return {
      itens: itens(ctx).map(paraItem).sort((a, b) => a.cod.localeCompare(b.cod)),
      autorizadosExternos: autorizados(ctx).filter((a) => a.ativo).map((a) => a.nome),
    };
  },

  'almox.movimentos': ({ cod, ocorrenciaId }, ctx) =>
    movimentos(ctx)
      .filter((m) => (!cod || m.cod === formatarCod(cod)) && (!ocorrenciaId || m.ocorrenciaId === ocorrenciaId))
      .sort((a, b) => b.quando.localeCompare(a.quando))
      .map(paraMovimento),

  'almox.salvarItem': (item, ctx) => {
    const cod = formatarCod(item.cod ?? '');
    if (!/^\d{4}$/.test(cod)) throw new ErroApi('VALIDACAO', 'O código tem até 4 números.');
    if (!item.nomeAlmox?.trim()) throw new ErroApi('VALIDACAO', 'Informe o nome do item.');
    const anterior = itens(ctx).find((x) => x.id === cod);
    const linha: LinhaItem = {
      id: cod, cod, nomeAlmox: item.nomeAlmox.trim(), nomeComum: item.nomeComum?.trim() ?? '', unidade: item.unidade?.trim() ?? '',
      valor: Number(item.valor) || 0, categoria: item.categoria?.trim() ?? '', qtdMinima: Number(item.qtdMinima) || 0, sala: item.sala?.trim() ?? '',
      status: item.status === 'Inativo' ? 'Inativo' : 'Ativo', saldo: anterior ? Number(anterior.saldo) : 0,
    };
    if (anterior) ctx.portas.repo.atualizar('almoxItens', linha);
    else ctx.portas.repo.inserir('almoxItens', linha);
    registrar(ctx, 'almox', cod, anterior ? 'alterou item do catálogo' : 'cadastrou item', null, null);
    marcarEstoque(ctx);
    return paraItem(linha);
  },

  'almox.ajustar': ({ cod, qtd, motivo }, ctx) => {
    const texto = (motivo ?? '').trim();
    if (!texto) throw new ErroApi('MOTIVO', 'Informe o motivo do ajuste.');
    if (!Number.isInteger(qtd) || qtd === 0) throw new ErroApi('VALIDACAO', 'Informe quantas unidades entram (+) ou saem (−).');
    const item = itemOuErro(ctx, cod);
    if (Number(item.saldo) + qtd < 0) throw new ErroApi('ESTOQUE', 'O ajuste deixaria o saldo negativo.');
    movimentar(ctx, item, { tipo: 'ajuste', qtd, motivo: texto });
    registrar(ctx, 'almox', item.id, `ajuste de estoque (${qtd > 0 ? '+' : ''}${qtd})`, null, null, texto);
    marcarEstoque(ctx);
    return paraItem(itemOuErro(ctx, cod));
  },

  'almox.autorizados': (_d, ctx) =>
    autorizados(ctx)
      .map(({ id, nome, ativo }) => ({ id, nome, ativo: !!ativo }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),

  'almox.salvarAutorizado': ({ id, nome, ativo }, ctx) => {
    const limpo = String(nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!limpo) throw new ErroApi('VALIDACAO', 'Informe o nome.');
    const lista = autorizados(ctx);
    if (lista.some((a) => a.id !== id && a.nome.toLowerCase() === limpo.toLowerCase())) throw new ErroApi('VALIDACAO', 'Já existe um autorizado com este nome.');
    const atual = id ? lista.find((a) => a.id === id) : undefined;
    if (id && !atual) throw new ErroApi('NAO_ENCONTRADO', 'Autorizado não encontrado.');
    const linha = { id: atual?.id ?? novoId(ctx.portas, 'aut'), nome: limpo, ativo: !!ativo };
    if (atual) ctx.portas.repo.atualizar('almoxAutorizadosExternos', linha);
    else ctx.portas.repo.inserir('almoxAutorizadosExternos', linha);
    registrar(ctx, 'almox', linha.id, atual ? `alterou o autorizado ${limpo}` : `cadastrou o autorizado ${limpo}`, null, null);
    return linha;
  },

  'almox.retirar': (d, ctx) => {
    const finalidade = (d.finalidade ?? '').trim();
    if (!finalidade) throw new ErroApi('FINALIDADE', 'Informe a finalidade da retirada.');
    const externo = (d.retiradoPorExterno ?? '').trim().replace(/\s+/g, ' ');
    if (externo && d.cadastrarExterno && !d.retiradoPorPessoaId) {
      const existente = autorizados(ctx).find((a) => a.nome.toLowerCase() === externo.toLowerCase());
      if (!existente) ctx.portas.repo.inserir('almoxAutorizadosExternos', { id: novoId(ctx.portas, 'aut'), nome: externo.slice(0, 80), ativo: true });
      else if (!existente.ativo) ctx.portas.repo.atualizar('almoxAutorizadosExternos', { ...existente, ativo: true });
      d = { ...d, retiradoPorExterno: existente?.nome ?? externo.slice(0, 80) };
    }
    const pessoaOk = !!d.retiradoPorPessoaId && linhasPessoas(ctx).some((p) => p.id === d.retiradoPorPessoaId && p.ativo);
    const externoOk = !!d.retiradoPorExterno && autorizados(ctx).some((a) => a.ativo && a.nome === d.retiradoPorExterno);
    if (!pessoaOk && !externoOk) throw new ErroApi('QUEM_RETIRA', 'Informe quem está retirando.');
    const erros = validarRetirada(d.itens ?? [], itens(ctx).map(paraItem));
    if (!d.itens?.length) erros.push({ cod: '—', erro: 'Inclua ao menos um item' });
    if (erros.length) throw new ErroApi('ESTOQUE', erros.map((e) => `${e.cod}: ${e.erro}`).join('; '));

    const movs = d.itens.map((i) =>
      movimentar(ctx, itemOuErro(ctx, i.cod), {
        tipo: 'saida', qtd: -i.qtd, finalidade,
        retiradoPorPessoaId: pessoaOk ? d.retiradoPorPessoaId : undefined, retiradoPorExterno: pessoaOk ? undefined : d.retiradoPorExterno,
        eventoId: d.eventoId, ocorrenciaId: d.ocorrenciaId,
      }),
    );
    registrar(ctx, 'almox', movs.map((m) => m.cod).join(','), `registrou retirada de ${movs.length} item(ns)`, null, null, finalidade);
    marcarEstoque(ctx);
    if (d.ocorrenciaId) marcarRelatorios(ctx.portas.props, ['infra']);
    return movs.map(paraMovimento);
  },

  'almox.pedidos': (_d, ctx) => pedidos(ctx).map((p) => paraPedido(ctx, p)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),

  'almox.criarPedido': ({ itens: pedidos_ }, ctx) => {
    if (!pedidos_?.length) throw new ErroApi('PEDIDO_VAZIO', 'Inclua ao menos um item no pedido.');
    for (const i of pedidos_) {
      itemOuErro(ctx, i.cod);
      if (!Number.isInteger(i.qtdPedida) || i.qtdPedida < 1) throw new ErroApi('VALIDACAO', 'A quantidade pedida deve ser de pelo menos 1.');
    }
    const id = novoId(ctx.portas, 'PED');
    ctx.portas.repo.inserir('almoxPedidos', { id, solicitanteId: ctx.eu!.id, status: 'aberto' });
    for (const i of pedidos_) {
      const cod = formatarCod(i.cod);
      ctx.portas.repo.inserir('almoxPedidoItens', { id: `${id}:${cod}`, pedidoId: id, cod, qtdPedida: i.qtdPedida, qtdRecebida: 0, valorEstimado: Number(i.valorEstimado) || 0 });
    }
    registrar(ctx, 'pedido', id, `registrou pedido com ${pedidos_.length} item(ns)`, null, null);
    return paraPedido(ctx, pedidos(ctx).find((p) => p.id === id)!);
  },

  'almox.receber': ({ pedidoId, itens: recebidos }, ctx) => {
    const pedido = pedidos(ctx).find((p) => p.id === pedidoId);
    if (!pedido) throw new ErroApi('NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (pedido.status === 'recebido' || pedido.status === 'cancelado') throw new ErroApi('PEDIDO_FECHADO', 'Este pedido já foi recebido.');
    for (const r of recebidos ?? []) {
      if (!(r.qtd > 0)) continue;
      const linha = pedidoItens(ctx).find((i) => i.pedidoId === pedidoId && i.cod === formatarCod(r.cod));
      if (!linha) continue;
      ctx.portas.repo.atualizar('almoxPedidoItens', { ...linha, qtdRecebida: Number(linha.qtdRecebida) + r.qtd });
      movimentar(ctx, itemOuErro(ctx, r.cod), { tipo: 'recebimento', qtd: r.qtd, pedidoId });
    }
    const completo = pedidoItens(ctx).filter((i) => i.pedidoId === pedidoId).every((i) => Number(i.qtdRecebida) >= Number(i.qtdPedida));
    const status: AlmoxPedido['status'] = completo ? 'recebido' : 'parcial';
    ctx.portas.repo.atualizar('almoxPedidos', { ...pedido, status });
    registrar(ctx, 'pedido', pedidoId, `registrou recebimento (${status})`, null, null);
    marcarEstoque(ctx);
    return paraPedido(ctx, pedidos(ctx).find((p) => p.id === pedidoId)!);
  },

  /** Catálogo antigo (BD_Almox) colado nas abas IMPORTAR_ALMOX e IMPORTAR_AUTORIZADOS (spec 13.2). */
  'almox.importar': (_d, ctx) => {
    const { repo } = ctx.portas;
    const problemas: { linha: number; mensagem: string }[] = [];
    let novos = 0;
    repo.lerAbaLivre('dados', 'IMPORTAR_ALMOX').forEach((bruta, i) => {
      const l = Object.fromEntries(Object.entries(bruta).map(([k, v]) => [k.trim().toUpperCase(), typeof v === 'string' ? v.trim() : v]));
      const linha = i + 2;
      if (l.COD === '' || l.COD === undefined || l.COD === null) return problemas.push({ linha, mensagem: 'Código em branco.' });
      const cod = formatarCod(String(l.COD));
      if (!/^\d{4}$/.test(cod)) return problemas.push({ linha, mensagem: `Código inválido (${l.COD}).` });
      if (!l.NOME_ALMOX) return problemas.push({ linha, mensagem: 'Nome em branco.' });
      if (itens(ctx).some((x) => x.id === cod)) return; // já importado: não duplica nem mexe no saldo
      const item: LinhaItem = {
        id: cod, cod, nomeAlmox: String(l.NOME_ALMOX), nomeComum: String(l.NOME_COMUM ?? ''), unidade: String(l.UNIDADE ?? ''),
        valor: centavos(l.VALOR), categoria: String(l.CATEGORIA ?? ''), qtdMinima: Number(l.QTD_MINIMA) || 0, sala: String(l.SALA ?? ''),
        status: String(l.STATUS ?? '').toLowerCase() === 'inativo' ? 'Inativo' : 'Ativo', saldo: 0,
      };
      repo.inserir('almoxItens', item);
      const saldo = Math.max(0, Math.round(Number(l.SALDO) || 0));
      if (saldo) movimentar(ctx, item, { tipo: 'ajuste', qtd: saldo, motivo: 'saldo inicial (importação)' });
      novos++;
    });
    let autorizadosNovos = 0;
    for (const a of repo.lerAbaLivre('dados', 'IMPORTAR_AUTORIZADOS')) {
      const nome = String(Object.entries(a).find(([k]) => k.trim().toUpperCase() === 'NOME')?.[1] ?? '').trim();
      if (!nome || autorizados(ctx).some((x) => x.nome.toLowerCase() === nome.toLowerCase())) continue;
      repo.inserir('almoxAutorizadosExternos', { id: novoId(ctx.portas, 'ax'), nome, ativo: true });
      autorizadosNovos++;
    }
    registrar(ctx, 'almox', 'importacao', `importou ${novos} item(ns) e ${autorizadosNovos} autorizado(s)`, null, { problemas: problemas.length });
    marcarEstoque(ctx);
    return { itens: novos, autorizados: autorizadosNovos, problemas };
  },
};
