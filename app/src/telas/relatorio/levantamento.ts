import {
  ehApoio,
  emLoteAtivo,
  valorDaSessao,
  valorTotalContrato,
  type AlmoxItem,
  type AlmoxMovimento,
  type Aditivo,
  type Centavos,
  type Contrato,
  type Escala,
  type Evento,
  type FichaResumo,
  type Lote,
  type LoteItem,
  type Ocorrencia,
  type Pessoa,
  type Sessao,
} from '@shared';

export interface BaseLevantamento {
  mes: string;
  eventos: Evento[];
  sessoes: Sessao[];
  escalas: Escala[];
  pessoas: Pessoa[];
  diariaPadrao: Centavos;
  lotes: Lote[];
  loteItens: LoteItem[];
  contratos: Contrato[];
  aditivos: Aditivo[];
  fichas: FichaResumo[];
  movimentos: AlmoxMovimento[];
  itensAlmox: AlmoxItem[];
  ocorrencias: Ocorrencia[];
  /** Destinos de cortesias por evento (só quantidades). */
  cortesias?: { eventoId: string; destinos: { nome: string; quantidade: number; lancados: number }[] }[];
}

export interface DireitoPessoa {
  pessoa: Pessoa;
  escalas: number;
  realizadas: number;
  faltas: number;
  /** Diárias a que tem direito, pagas pela UFSM (eventos de pagamento interno). */
  diariasInternas: number;
  valorInterno: Centavos;
  /** Já num lote enviado ou pago. */
  valorEmLote: Centavos;
  /** Já num lote pago. */
  valorPago: Centavos;
  /** Sessões de eventos pagos por terceiros (pagador externo). */
  diariasExternas: number;
}

const doMes = (data: string | undefined | null, mes: string) => !!data && data.slice(0, 7) === mes;

/** Tudo o que aconteceu no mês, para imprimir: agenda, escalas e o direito de cada pessoa, pagamentos, contratos, fichas, almoxarifado e prédio. */
export function levantamentoMensal(b: BaseLevantamento) {
  const sessoes = b.sessoes.filter((s) => s.status === 'ativa' && doMes(s.data, b.mes)).sort((x, y) => x.data.localeCompare(y.data));
  const idsSessoes = new Set(sessoes.map((s) => s.id));
  const eventos = b.eventos
    .filter((e) => e.status === 'ativo' && sessoes.some((s) => s.eventoId === e.id))
    .map((e) => {
      const minhas = sessoes.filter((s) => s.eventoId === e.id);
      return { evento: e, datas: [...new Set(minhas.map((s) => s.data))], sessoes: minhas.length };
    })
    .sort((x, y) => x.datas[0].localeCompare(y.datas[0]));
  const evento = (s: Sessao) => b.eventos.find((e) => e.id === s.eventoId);
  // publicadas, realizadas e faltas (rascunho e canceladas não contam)
  const escalas = b.escalas.filter((e) => idsSessoes.has(e.sessaoId) && ['publicado', 'realizado', 'faltou'].includes(e.status));

  const direitos: DireitoPessoa[] = [...new Set(escalas.map((e) => e.pessoaId))]
    .map((id) => {
      const pessoa = b.pessoas.find((p) => p.id === id);
      if (!pessoa) return null;
      const minhas = escalas.filter((e) => e.pessoaId === id);
      const realizadas = minhas.filter((e) => e.status === 'realizado');
      // diária só nas sessões do evento (apoio não paga) de eventos com pagamento interno
      const sessaoDe = (e: Escala) => sessoes.find((s) => s.id === e.sessaoId)!;
      const internas = pessoa.tipo === 'bolsista' ? realizadas.filter((e) => !ehApoio(sessaoDe(e)) && evento(sessaoDe(e))?.pagamento === 'interno') : [];
      const valor = (lista: Escala[]) => lista.reduce((n, e) => n + valorDaSessao(sessoes.find((s) => s.id === e.sessaoId)!, b.diariaPadrao), 0);
      return {
        pessoa,
        escalas: minhas.length,
        realizadas: realizadas.length,
        faltas: minhas.filter((e) => e.status === 'faltou').length,
        diariasInternas: internas.length,
        valorInterno: valor(internas),
        valorEmLote: valor(internas.filter((e) => emLoteAtivo(e, b.lotes))),
        valorPago: valor(internas.filter((e) => b.lotes.some((l) => l.id === e.loteId && l.status === 'pago'))),
        diariasExternas: pessoa.tipo === 'bolsista' ? realizadas.length - internas.length : 0,
      };
    })
    .filter((d): d is DireitoPessoa => !!d)
    .sort((x, y) => (x.pessoa.tipo === y.pessoa.tipo ? x.pessoa.nome.localeCompare(y.pessoa.nome, 'pt-BR') : x.pessoa.tipo === 'bolsista' ? -1 : 1));

  const lotes = b.lotes
    .filter((l) => l.periodoReferencia?.slice(0, 7) === b.mes || doMes(l.criadoEm, b.mes) || doMes(l.pagoEm, b.mes))
    .map((l) => {
      const itens = b.loteItens.filter((i) => i.loteId === l.id);
      return { lote: l, itens: itens.length, valor: itens.reduce((n, i) => n + i.valor, 0) };
    });

  const contratos = b.contratos
    .filter((c) => eventos.some((e) => e.evento.id === c.eventoId))
    .map((c) => ({ contrato: c, evento: b.eventos.find((e) => e.id === c.eventoId)?.nome ?? '—', valor: valorTotalContrato(c, b.aditivos) }));

  const fichas = b.fichas.filter((f) => f.datas.some((d) => doMes(d, b.mes)));

  const saidas = new Map<string, { cod: string; nome: string; qtd: number; valor: Centavos }>();
  for (const m of b.movimentos.filter((x) => x.tipo === 'saida' && doMes(x.quando, b.mes))) {
    const item = b.itensAlmox.find((i) => i.cod === m.cod);
    const atual = saidas.get(m.cod) ?? { cod: m.cod, nome: item?.nomeComum || item?.nomeAlmox || m.cod, qtd: 0, valor: 0 };
    atual.qtd += Math.abs(m.qtd);
    atual.valor += Math.abs(m.qtd) * m.valorUnitario;
    saidas.set(m.cod, atual);
  }
  const almox = [...saidas.values()].sort((x, y) => y.valor - x.valor);

  const sessoesEvento = sessoes.filter((s) => !ehApoio(s));
  const diasNoMes = new Date(Number(b.mes.slice(0, 4)), Number(b.mes.slice(5, 7)), 0).getDate();
  const diasComUso = new Set(sessoes.map((s) => s.data)).size;
  const tipos = new Map<string, { tipo: string; eventos: number; sessoes: number; publico: number }>();
  for (const e of eventos) {
    const t = tipos.get(e.evento.tipo) ?? { tipo: e.evento.tipo, eventos: 0, sessoes: 0, publico: 0 };
    t.eventos += 1;
    t.sessoes += sessoesEvento.filter((s) => s.eventoId === e.evento.id).length;
    t.publico += e.evento.publicoReal ?? e.evento.publicoEstimado ?? 0;
    tipos.set(e.evento.tipo, t);
  }
  const ativosContratos = contratos.filter((c) => c.contrato.statusContrato !== 'Cancelado');
  const pendente = (v: string) => !['Pago', 'Paga', 'Isento'].includes(v);
  const contratosResumo = {
    quantidade: ativosContratos.length,
    valorTotal: ativosContratos.reduce((n, c) => n + c.valor, 0),
    valorPago: ativosContratos.filter((c) => c.contrato.statusFatura === 'Paga').reduce((n, c) => n + c.valor, 0),
    semAssinatura: ativosContratos.filter((c) => c.contrato.statusContrato !== 'Assinado').length,
    faturaPendente: ativosContratos.filter((c) => pendente(c.contrato.statusFatura)).length,
    ecadIssPendente: ativosContratos.filter((c) => pendente(c.contrato.statusEcad) || pendente(c.contrato.statusIss)).length,
  };
  // ECAD, ISS e cortesias de cada evento do mês (contrato + destinos das cortesias)
  const eventosAdmin = eventos.map((x) => {
    const ct = b.contratos.find((c) => c.eventoId === x.evento.id && c.statusContrato !== 'Cancelado');
    const destinos = b.cortesias?.find((c) => c.eventoId === x.evento.id)?.destinos ?? [];
    return {
      evento: x.evento,
      datas: x.datas,
      ecad: ct?.statusEcad ?? '—',
      iss: ct?.statusIss ?? '—',
      cortesiasContrato: ct ? Number(ct.cortesiasQtd || 0) : 0,
      statusCortesias: ct?.statusCortesias ?? '—',
      distribuidas: destinos.reduce((n, d) => n + d.quantidade, 0),
      lancados: destinos.reduce((n, d) => n + d.lancados, 0),
      destinos: destinos.map((d) => `${d.nome} (${d.lancados}/${d.quantidade})`).join(', '),
    };
  });
  const cortesiasTotais = {
    recebidas: eventosAdmin.reduce((n, x) => n + x.cortesiasContrato, 0),
    distribuidas: eventosAdmin.reduce((n, x) => n + x.distribuidas, 0),
    lancados: eventosAdmin.reduce((n, x) => n + x.lancados, 0),
    destinos: (b.cortesias ?? []).filter((c) => eventos.some((x) => x.evento.id === c.eventoId)).reduce((n, c) => n + c.destinos.length, 0),
  };
  const criadas = b.ocorrencias.filter((o) => doMes(o.criadaEm, b.mes));
  const resolvidas = b.ocorrencias.filter((o) => doMes(o.resolvidaEm, b.mes));
  const abertas = b.ocorrencias.filter((o) => o.status !== 'resolvida' && o.status !== 'naoProcede');

  const categorias = new Map<string, { categoria: string; abertas: number; resolvidas: number }>();
  const contar = (o: Ocorrencia, campo: 'abertas' | 'resolvidas') => {
    const c = categorias.get(o.categoria) ?? { categoria: o.categoria, abertas: 0, resolvidas: 0 };
    c[campo] += 1;
    categorias.set(o.categoria, c);
  };
  abertas.forEach((o) => contar(o, 'abertas'));
  resolvidas.forEach((o) => contar(o, 'resolvidas'));

  return {
    ocupacao: { diasComUso, diasNoMes, percentual: Math.round((diasComUso / diasNoMes) * 100) },
    porTipo: [...tipos.values()].sort((x, y) => y.eventos - x.eventos || x.tipo.localeCompare(y.tipo, 'pt-BR')),
    equipe: {
      pessoas: direitos.length,
      realizadas: direitos.reduce((n, d) => n + d.realizadas, 0),
      faltas: direitos.reduce((n, d) => n + d.faltas, 0),
      diarias: direitos.reduce((n, d) => n + d.diariasInternas, 0),
      valorDiarias: direitos.reduce((n, d) => n + d.valorInterno, 0),
      valorEmLote: direitos.reduce((n, d) => n + d.valorEmLote, 0),
      valorPago: direitos.reduce((n, d) => n + d.valorPago, 0),
    },
    contratosResumo,
    eventosAdmin,
    cortesiasTotais,
    itensCriticos: b.itensAlmox.filter((i) => i.status === 'Ativo' && i.saldo <= i.qtdMinima),
    ocorrenciasPorCategoria: [...categorias.values()].sort((x, y) => y.abertas + y.resolvidas - (x.abertas + x.resolvidas) || x.categoria.localeCompare(y.categoria, 'pt-BR')),
    resumo: {
      eventos: eventos.length,
      sessoes: sessoesEvento.length,
      apoio: sessoes.length - sessoesEvento.length,
      publicoEstimado: eventos.reduce((n, e) => n + (e.evento.publicoEstimado ?? 0), 0),
      publicoReal: eventos.reduce((n, e) => n + (e.evento.publicoReal ?? 0), 0),
      pessoas: direitos.length,
      realizadas: direitos.reduce((n, d) => n + d.realizadas, 0),
      faltas: direitos.reduce((n, d) => n + d.faltas, 0),
      valorDiarias: direitos.reduce((n, d) => n + d.valorInterno, 0),
      saidasAlmox: almox.reduce((n, a) => n + a.valor, 0),
      ocorrenciasCriadas: criadas.length,
      ocorrenciasResolvidas: resolvidas.length,
    },
    eventos,
    direitos,
    lotes,
    contratos,
    fichas,
    almox,
    ocorrencias: { criadas, resolvidas, abertas },
  };
}
