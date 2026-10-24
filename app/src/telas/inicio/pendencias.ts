import {
  alertasContrato,
  contaNaEscala,
  estoqueCritico,
  formatarData,
  pode,
  type AlertaContrato,
  type AlmoxItem,
  type Contrato,
  type DataISO,
  type Disponibilidade,
  type Escala,
  type Evento,
  type Permissoes,
  type Pessoa,
  type Rodada,
  type Sessao,
} from '@shared';

export type Pendencia = { tipo: 'presenca' | 'rodada' | 'vagas' | 'estoque' | 'contrato'; texto: string; link: string };

const TEXTO_ALERTA: Record<AlertaContrato, string> = {
  faturaVencendo: 'fatura vence em breve',
  faturaVencida: 'fatura vencida',
  ecadIssPendente: 'ECAD/ISS sem comprovação',
  naoAssinado: 'contrato ainda não assinado',
  cortesiasPendentes: 'cortesias não recebidas',
};

export function calcularPendencias(dados: {
  sessoes: Sessao[];
  escalas: Escala[];
  eventos: Evento[];
  rodadas: Rodada[];
  disponibilidades: Disponibilidade[];
  pessoas: Pessoa[];
  itens: AlmoxItem[];
  contratos: Contrato[];
  hoje: DataISO;
  permissoes: Permissoes;
}): Pendencia[] {
  const { sessoes, escalas, eventos, hoje, permissoes } = dados;
  const evento = new Map(eventos.map((e) => [e.id, e]));
  const titulo = (s: Sessao) => `${evento.get(s.eventoId)?.nome ?? 'Evento'}${s.rotulo ? ` – ${s.rotulo}` : ''} (${formatarData(s.data).slice(0, 5)})`;
  const lista: Pendencia[] = [];

  if (pode(permissoes, 'escalas', 'editar')) {
    for (const s of sessoes) {
      if (s.status !== 'ativa' || s.data >= hoje) continue;
      if (escalas.some((e) => e.sessaoId === s.id && e.status === 'publicado')) {
        lista.push({ tipo: 'presenca', texto: `Confirmar presença: ${titulo(s)}`, link: '/escalas?aba=presenca' });
      }
    }
  }

  if (pode(permissoes, 'escalas', 'ver')) {
    const ativos = dados.pessoas.filter((p) => p.ativo);
    for (const r of dados.rodadas.filter((x) => x.status === 'aberta')) {
      const responderam = new Set(dados.disponibilidades.filter((d) => r.sessaoIds.includes(d.sessaoId)).map((d) => d.pessoaId));
      const total = ativos.length;
      const qtd = ativos.filter((p) => responderam.has(p.id)).length;
      lista.push({ tipo: 'rodada', texto: `${r.nome}: ${qtd} de ${total} responderam a disponibilidade`, link: '/escalas?aba=rodadas' });
    }
    for (const s of sessoes) {
      if (s.status !== 'ativa' || !s.publicadaEm || s.data < hoje) continue;
      const bolsistas = escalas.filter((e) => e.sessaoId === s.id && e.papel === 'bolsista' && contaNaEscala(e)).length;
      if (bolsistas < s.vagasBolsistas) {
        lista.push({ tipo: 'vagas', texto: `${titulo(s)}: ${bolsistas} de ${s.vagasBolsistas} bolsistas`, link: '/escalas?aba=publicadas' });
      }
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
        lista.push({
          tipo: 'contrato',
          texto: `Contrato ${c.numero}${ev ? ` (${ev.nome})` : ''}: ${alertas.map((a) => TEXTO_ALERTA[a]).join(', ')}`,
          link: `/contratos/${c.id}`,
        });
      }
    }
  }

  return lista;
}
