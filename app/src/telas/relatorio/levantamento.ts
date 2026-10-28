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

  const criadas = b.ocorrencias.filter((o) => doMes(o.criadaEm, b.mes));
  const resolvidas = b.ocorrencias.filter((o) => doMes(o.resolvidaEm, b.mes));
  const abertas = b.ocorrencias.filter((o) => o.status !== 'resolvida' && o.status !== 'naoProcede');

  return {
    resumo: {
      eventos: eventos.length,
      sessoes: sessoes.length,
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
