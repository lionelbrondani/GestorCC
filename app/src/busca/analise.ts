import {
  agruparValores,
  ehApoio,
  formatarData,
  formatarReais,
  mesDe,
  mesExtenso,
  ROTULO_STATUS_OCORRENCIA,
  somarDias,
  valorTotalContrato,
  type Agrupamento,
  type AssuntoAnalise,
  type ConsultaAnalise,
  type DataISO,
  type Medida,
} from '@shared';
import type { ApiCliente } from '../api/cliente';
import { semAcento } from './buscaComum';
import type { RespostaBusca } from './executar';

const NOME_ASSUNTO: Record<AssuntoAnalise, string> = {
  sessoes: 'Sessões', escalas: 'Escalas', pagamentos: 'Pagamentos', contratos: 'Contratos', cortesias: 'Cortesias', ocorrencias: 'Ocorrências', pedidos: 'Pedidos de data',
};
const NOME_GRUPO: Record<Agrupamento, string> = { mes: 'Mês', tipo: 'Tipo', evento: 'Evento', pessoa: 'Pessoa', status: 'Situação', categoria: 'Categoria', destino: 'Destino', nenhum: '' };
const NOME_MEDIDA: Record<Medida, string> = { contar: 'Quantidade', valor: 'Valor', publico: 'Público estimado', quantidade: 'Cortesias' };
const STATUS_LOTE = { enviado: 'Aguardando pagamento', pago: 'Pago', cancelado: 'Cancelado' };
const STATUS_PEDIDO = { novo: 'Novo', aprovado: 'Aprovado', recusado: 'Recusado' };

/** Um registro da análise: a data que conta para o período, os grupos em que cai, onde o filtro procura e quanto vale. */
interface Registro {
  data: DataISO;
  grupos: Partial<Record<Agrupamento, string>>;
  busca: string;
  valor: number;
  /** Conta uma vez só por grupo (ex.: o público de um evento com várias sessões). */
  unico?: string;
}

const juntar = (...t: (string | undefined)[]) => t.filter(Boolean).join(' ');
const milhar = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const rotuloMes = (mes: string) => `${mesExtenso(Number(mes.slice(5, 7))).toLowerCase().slice(0, 3)}/${mes.slice(0, 4)}`;

async function registros(c: ConsultaAnalise, api: ApiCliente, de: DataISO, ate: DataISO): Promise<{ registros: Registro[]; observacao?: string }> {
  const umPor = (medida: Medida) => c.medida === medida;
  switch (c.assunto) {
    case 'sessoes': {
      const { eventos, sessoes } = await api.chamar('eventos.listar', { de, ate });
      const ev = new Map(eventos.map((e) => [e.id, e]));
      return {
        registros: sessoes
          .filter((s) => s.status === 'ativa' && !ehApoio(s) && ev.get(s.eventoId)?.status !== 'cancelado')
          .map((s) => {
            const e = ev.get(s.eventoId);
            return {
              data: s.data,
              grupos: { tipo: e?.tipo ?? '—', evento: e?.nome ?? 'Evento' },
              busca: juntar(e?.nome, e?.organizador),
              valor: umPor('publico') ? (e?.publicoEstimado ?? 0) : 1,
              unico: umPor('publico') ? s.eventoId : undefined,
            };
          }),
      };
    }
    case 'escalas': {
      const [{ eventos, sessoes }, escalas, pessoas] = await Promise.all([
        api.chamar('eventos.listar', { de, ate }),
        api.chamar('escalas.listar', { de, ate }),
        api.chamar('pessoas.listar', null),
      ]);
      const sessao = new Map(sessoes.map((s) => [s.id, s]));
      const ev = new Map(eventos.map((e) => [e.id, e]));
      const pessoa = new Map(pessoas.map((p) => [p.id, p]));
      return {
        registros: escalas
          .filter((e) => (e.status === 'publicado' || e.status === 'realizado') && sessao.has(e.sessaoId))
          .map((e) => {
            const s = sessao.get(e.sessaoId)!;
            const p = pessoa.get(e.pessoaId);
            const evento = ev.get(s.eventoId);
            return { data: s.data, grupos: { pessoa: p?.nome ?? '—', evento: evento?.nome ?? 'Evento' }, busca: juntar(p?.nome, p?.nomeCurto, evento?.nome), valor: 1 };
          }),
      };
    }
    case 'pagamentos': {
      const [{ lotes, itens }, pessoas] = await Promise.all([api.chamar('lotes.listar', null), api.chamar('pessoas.listar', null)]);
      const lote = new Map(lotes.filter((l) => l.status !== 'cancelado').map((l) => [l.id, l]));
      const pessoa = new Map(pessoas.map((p) => [p.id, p]));
      return {
        registros: itens
          .filter((i) => lote.has(i.loteId))
          .map((i) => {
            const l = lote.get(i.loteId)!;
            const p = pessoa.get(i.pessoaId);
            return {
              data: l.pagoEm ?? l.criadoEm.slice(0, 10),
              grupos: { pessoa: p?.nome ?? '—', status: STATUS_LOTE[l.status] },
              busca: juntar(p?.nome, p?.nomeCurto, l.titulo),
              valor: umPor('valor') ? i.valor : 1,
            };
          }),
      };
    }
    case 'contratos': {
      const { contratos, aditivos, contratantes } = await api.chamar('contratos.listar', null);
      // o nome do evento só é preciso para filtrar
      const eventos = c.filtro ? (await api.chamar('eventos.listar', { de: somarDias(de, -400), ate: somarDias(ate, 400) })).eventos : [];
      const comCancelados = c.agrupar === 'status';
      return {
        registros: contratos
          .filter((k) => comCancelados || k.statusContrato !== 'Cancelado')
          .map((k) => ({
            data: k.vencimento,
            grupos: { status: k.statusContrato || '—' },
            busca: juntar(k.numero, contratantes.find((x) => x.id === k.contratanteId)?.razaoSocial, eventos.find((e) => e.id === k.eventoId)?.nome),
            valor: umPor('valor') ? valorTotalContrato(k, aditivos) : 1,
          })),
        observacao: comCancelados ? undefined : 'Contratos cancelados ficam de fora.',
      };
    }
    case 'cortesias': {
      const { eventos, sessoes } = await api.chamar('eventos.listar', { de, ate });
      const primeira = new Map<string, DataISO>();
      for (const s of [...sessoes].sort((a, b) => a.data.localeCompare(b.data))) {
        if (s.status === 'ativa' && !ehApoio(s) && !primeira.has(s.eventoId)) primeira.set(s.eventoId, s.data);
      }
      const doPeriodo = eventos.filter((e) => e.status !== 'cancelado' && primeira.has(e.id));
      if (!doPeriodo.length) return { registros: [] };
      const resumo = await api.chamar('cortesias.resumo', { eventoIds: doPeriodo.map((e) => e.id) });
      return {
        registros: resumo.flatMap((r) => {
          const e = doPeriodo.find((x) => x.id === r.eventoId);
          return r.destinos.map((d) => ({ data: primeira.get(r.eventoId) ?? de, grupos: { evento: e?.nome ?? 'Evento', destino: d.nome }, busca: juntar(e?.nome, d.nome), valor: d.quantidade }));
        }),
      };
    }
    case 'ocorrencias':
      return {
        registros: (await api.chamar('infra.listar', null)).map((o) => ({
          data: o.criadaEm.slice(0, 10),
          grupos: { status: ROTULO_STATUS_OCORRENCIA[o.status] ?? o.status, categoria: o.categoria || '—' },
          busca: juntar(o.titulo, o.descricao, o.categoria, o.local),
          valor: 1,
        })),
      };
    case 'pedidos':
      return {
        registros: (await api.chamar('pedidos.listar', null)).map((p) => ({
          data: p.recebidoEm.slice(0, 10),
          grupos: { status: STATUS_PEDIDO[p.status], categoria: (p.categoria === 'Outro' && p.categoriaOutra) || p.categoria || '—' },
          busca: juntar(p.evento, p.categoria, p.categoriaOutra),
          valor: 1,
        })),
      };
  }
}

/**
 * Perguntas complexas (contagens, somas, rankings): o Gemini só diz o que montar; os dados são lidos e somados aqui,
 * com as permissões de quem perguntou. Sem período, vale do último ano até daqui a 6 meses (escalas: até hoje).
 */
export async function executarAnalise(c: ConsultaAnalise, api: ApiCliente, hoje: DataISO): Promise<RespostaBusca> {
  const a = c.de ?? somarDias(hoje, -365);
  const b = c.ate ?? (c.assunto === 'escalas' ? hoje : somarDias(hoje, 180));
  const [de, ate] = a <= b ? [a, b] : [b, a];
  const titulo =
    `${NOME_ASSUNTO[c.assunto]}${c.agrupar === 'nenhum' ? '' : ` por ${NOME_GRUPO[c.agrupar].toLowerCase()}`}` +
    ` · ${formatarData(de)} a ${formatarData(ate)}${c.filtro ? ` · ${c.filtro}` : ''}`;

  const r = await registros(c, api, de, ate);
  const filtro = semAcento(c.filtro);
  const vistos = new Set<string>();
  const valores: { grupo: string; ordem: string; valor: number }[] = [];
  for (const x of r.registros) {
    if (x.data < de || x.data > ate || !semAcento(x.busca).includes(filtro)) continue;
    const grupo = c.agrupar === 'nenhum' ? 'Total' : c.agrupar === 'mes' ? rotuloMes(mesDe(x.data)) : (x.grupos[c.agrupar] ?? '—');
    if (x.unico) {
      if (vistos.has(`${grupo}|${x.unico}`)) continue;
      vistos.add(`${grupo}|${x.unico}`);
    }
    valores.push({ grupo, ordem: c.agrupar === 'mes' ? mesDe(x.data) : grupo, valor: x.valor });
  }
  if (!valores.length) return { titulo, itens: [], vazio: 'Nada encontrado nesse período.' };

  const { linhas, total, restantes } = agruparValores(valores, c.ordem, c.limite);
  const formatar = (n: number) => (c.medida === 'valor' ? formatarReais(n) : milhar(n));
  const observacao = [restantes ? `${restantes} ${restantes === 1 ? 'outro' : 'outros'} fora da lista; o total conta todos.` : '', r.observacao ?? ''].filter(Boolean).join(' ');
  return {
    titulo,
    itens: [],
    tabela: {
      colunas: [NOME_GRUPO[c.agrupar], NOME_MEDIDA[c.medida]],
      linhas: c.agrupar === 'nenhum' ? [] : linhas.map(([g, v]) => [g, formatar(v)]),
      total: formatar(total),
      ...(observacao ? { observacao } : {}),
    },
  };
}
