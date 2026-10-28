import {
  alertasContrato,
  chamadosAtrasados,
  contaNaEscala,
  diferencaDias,
  ehApoio,
  elegiveisParaLote,
  estoqueCritico,
  formatarData,
  pode,
  somarDias,
  tituloComAtividade,
  type AlertaContrato,
  type AlmoxItem,
  type Contrato,
  type DataISO,
  type Disponibilidade,
  type Escala,
  type Evento,
  type FichaResumo,
  type Lote,
  type Ocorrencia,
  type PedidoDatas,
  type Permissoes,
  type Pessoa,
  type Rodada,
  type Sessao,
} from '@shared';

export type TipoPendencia = 'presenca' | 'rodada' | 'vagas' | 'publicar' | 'apoio' | 'ficha' | 'pagamento' | 'estoque' | 'contrato' | 'infra' | 'pedido';

/** Algo que precisa de alguém da gestão; `quando` é o prazo ou o dia do evento (vem primeiro o que vence antes). */
export type Pendencia = { tipo: TipoPendencia; texto: string; link: string; quando?: DataISO };

const TEXTO_ALERTA: Record<AlertaContrato, string> = {
  faturaVencendo: 'fatura vence em breve',
  faturaVencida: 'fatura vencida',
  ecadIssPendente: 'ECAD/ISS sem comprovação',
  naoAssinado: 'contrato ainda não assinado',
  cortesiasPendentes: 'cortesias não recebidas',
};

/** Quantos dias à frente a escala, o apoio e a ficha técnica entram como pendência. */
const ANTECEDENCIA = 14;

export function calcularPendencias(dados: {
  sessoes: Sessao[];
  escalas: Escala[];
  eventos: Evento[];
  rodadas: Rodada[];
  disponibilidades: Disponibilidade[];
  pessoas: Pessoa[];
  itens: AlmoxItem[];
  contratos: Contrato[];
  ocorrencias?: Ocorrencia[];
  fichas?: FichaResumo[];
  pedidos?: PedidoDatas[];
  /** Sem os lotes, não dá para saber o que falta pagar: a pendência de pagamento fica de fora. */
  lotes?: Lote[];
  hoje: DataISO;
  permissoes: Permissoes;
}): Pendencia[] {
  const { sessoes, escalas, eventos, hoje, permissoes } = dados;
  const evento = new Map(eventos.map((e) => [e.id, e]));
  const titulo = (s: Sessao) => `${tituloComAtividade(evento.get(s.eventoId)?.nome ?? 'Evento', s)} (${formatarData(s.data).slice(0, 5)})`;
  const limite = somarDias(hoje, ANTECEDENCIA);
  const proxima = (s: Sessao) => s.status === 'ativa' && s.data >= hoje && s.data <= limite;
  const temEquipe = (s: Sessao) => escalas.some((e) => e.sessaoId === s.id && contaNaEscala(e));
  const lista: Pendencia[] = [];

  if (pode(permissoes, 'escalas', 'editar')) {
    for (const s of sessoes) {
      if (s.status !== 'ativa' || s.data >= hoje) continue;
      if (escalas.some((e) => e.sessaoId === s.id && e.status === 'publicado')) {
        lista.push({ tipo: 'presenca', texto: `Confirmar presença: ${titulo(s)}`, link: '/escalas?aba=presenca', quando: s.data });
      }
    }
    for (const s of sessoes.filter(proxima)) {
      const mes = s.data.slice(0, 7);
      if (ehApoio(s)) {
        if (!temEquipe(s)) lista.push({ tipo: 'apoio', texto: `Escalar o apoio: ${titulo(s)}`, link: `/escalas?aba=apoio&mes=${mes}`, quando: s.data });
      } else if (!s.publicadaEm) {
        lista.push({ tipo: 'publicar', texto: `Publicar a escala: ${titulo(s)}`, link: `/escalas?aba=montar&mes=${mes}`, quando: s.data });
      }
    }
  }

  if (pode(permissoes, 'escalas', 'ver')) {
    const ativos = dados.pessoas.filter((p) => p.ativo);
    for (const r of dados.rodadas.filter((x) => x.status === 'aberta')) {
      const responderam = new Set(dados.disponibilidades.filter((d) => r.sessaoIds.includes(d.sessaoId)).map((d) => d.pessoaId));
      const qtd = ativos.filter((p) => responderam.has(p.id)).length;
      lista.push({ tipo: 'rodada', texto: `${r.nome}: ${qtd} de ${ativos.length} responderam a disponibilidade`, link: '/escalas?aba=rodadas', quando: r.prazo.slice(0, 10) });
    }
    for (const s of sessoes) {
      if (s.status !== 'ativa' || !s.publicadaEm || s.data < hoje || ehApoio(s)) continue;
      const bolsistas = escalas.filter((e) => e.sessaoId === s.id && e.papel === 'bolsista' && contaNaEscala(e)).length;
      if (bolsistas < s.vagasBolsistas) {
        lista.push({ tipo: 'vagas', texto: `${titulo(s)}: ${bolsistas} de ${s.vagasBolsistas} bolsistas`, link: '/escalas?aba=publicadas', quando: s.data });
      }
    }
  }

  if (pode(permissoes, 'eventos', 'editar')) {
    for (const f of dados.fichas ?? []) {
      const primeira = f.datas[0];
      if (f.status === 'enviada' || f.eventoCancelado || !primeira || primeira < hoje || primeira > limite) continue;
      lista.push({ tipo: 'ficha', texto: `Ficha técnica de ${f.evento} ainda não enviada pelo produtor`, link: `/agenda/${f.eventoId}`, quando: f.prazo || primeira });
    }
  }

  if (pode(permissoes, 'eventos', 'editar')) {
    const novos = (dados.pedidos ?? []).filter((p) => p.status === 'novo');
    const primeira = novos.flatMap((p) => p.dias.map((d) => d.data)).sort()[0];
    if (novos.length) {
      lista.push({ tipo: 'pedido', texto: `${novos.length} ${novos.length === 1 ? 'pedido de data' : 'pedidos de data'} para analisar`, link: '/pedidos', ...(primeira ? { quando: primeira } : {}) });
    }
  }

  if (dados.lotes && pode(permissoes, 'pagamentos', 'editar')) {
    const n = elegiveisParaLote({ eventos, sessoes, escalas, lotes: dados.lotes }).length;
    if (n > 0) {
      lista.push({ tipo: 'pagamento', texto: `${n} ${n === 1 ? 'sessão realizada' : 'sessões realizadas'} aguardando lote de pagamento`, link: '/pagamentos/novo' });
    }
  }

  if (pode(permissoes, 'almoxEstoque', 'ver')) {
    const criticos = dados.itens.filter(estoqueCritico).length;
    if (criticos > 0) lista.push({ tipo: 'estoque', texto: `${criticos} itens no estoque mínimo`, link: '/almox?aba=pedidos' });
  }

  if (pode(permissoes, 'contratos', 'ver')) {
    for (const c of dados.contratos) {
      const datas = sessoes.filter((s) => s.eventoId === c.eventoId).map((s) => s.data).sort();
      const ev = evento.get(c.eventoId);
      const alertas = alertasContrato(c, datas[0] ?? '9999-12-31', hoje);
      if (alertas.length) {
        const fatura = alertas.includes('faturaVencendo') || alertas.includes('faturaVencida');
        lista.push({
          tipo: 'contrato',
          texto: `Contrato ${c.numero}${ev ? ` (${ev.nome})` : ''}: ${alertas.map((a) => TEXTO_ALERTA[a]).join(', ')}`,
          link: `/contratos/${c.id}`,
          ...(fatura && c.vencimento ? { quando: c.vencimento } : datas[0] ? { quando: datas[0] } : {}),
        });
      }
    }
  }

  if (pode(permissoes, 'infraestrutura', 'editar')) {
    const ocorrencias = dados.ocorrencias ?? [];
    const novas = ocorrencias.filter((o) => o.status === 'nova');
    if (novas.length) lista.push({ tipo: 'infra', texto: `${novas.length} ocorrência(s) de infraestrutura para analisar`, link: '/infra' });
    for (const o of chamadosAtrasados(ocorrencias, hoje)) {
      lista.push({ tipo: 'infra', texto: `Chamado ${o.chamadoNumero} (#${o.numero} ${o.titulo}) aberto há mais de 7 dias`, link: `/infra/${o.id}` });
    }
  }

  // o que venceu ou vence antes vem primeiro; sem prazo, depois, na ordem em que entrou
  return lista.map((p, i) => ({ p, i })).sort((a, b) => (a.p.quando ?? '9999').localeCompare(b.p.quando ?? '9999') || a.i - b.i).map(({ p }) => p);
}

/** "há 2 dias", "hoje", "amanhã", "em 5 dias", com o tom da etiqueta: vencido ou hoje em vermelho, até 7 dias em amarelo. */
export function prazoRelativo(quando: DataISO, hoje: DataISO): { texto: string; tom: 'erro' | 'aviso' | undefined } {
  const d = diferencaDias(hoje, quando);
  if (d < 0) return { texto: `há ${-d} ${d === -1 ? 'dia' : 'dias'}`, tom: 'erro' };
  if (d === 0) return { texto: 'hoje', tom: 'erro' };
  if (d === 1) return { texto: 'amanhã', tom: 'aviso' };
  return { texto: `em ${d} dias`, tom: d <= 7 ? 'aviso' : undefined };
}
