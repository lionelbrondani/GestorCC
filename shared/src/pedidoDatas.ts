import { emailValido } from './email';
import type { AtividadeSessao, DataISO, Evento, Id, Sessao, TipoEvento } from './tipos';
import { cnpjValido, cpfValido } from './validacoes';

/** As opções do formulário de solicitação de datas do Centro de Convenções. */
export const CATEGORIAS_PEDIDO = ['Palestra', 'Seminário', 'Peça teatral', 'Show musical', 'Stand-up', 'Concerto', 'Evento corporativo', 'Outro'] as const;
export const INDICACOES_ETARIAS = ['Livre', '10 anos', '12 anos', '14 anos', '16 anos', '18 anos'] as const;
export const ESPACOS_PEDIDO = ['Palco', 'Hall de entrada/Foyer', 'Hall do Mezanino (2º andar)', 'Sala Vip', 'Plateia', 'Camarins', 'Sala de ensaios'] as const;
export const ATIVIDADES_PEDIDO: AtividadeSessao[] = ['evento', 'montagem', 'ensaio', 'passagemSom', 'desmontagem'];

export type CategoriaPedido = (typeof CATEGORIAS_PEDIDO)[number];
export type StatusPedido = 'novo' | 'aprovado' | 'recusado';

/** Tipo do evento que o pedido aprovado ganha na agenda (o gestor pode mudar depois). */
export const TIPO_DA_CATEGORIA: Record<CategoriaPedido, TipoEvento> = {
  Palestra: 'Congresso',
  Seminário: 'Congresso',
  'Peça teatral': 'Outro',
  'Show musical': 'Show/Concerto',
  'Stand-up': 'Show/Concerto',
  Concerto: 'Show/Concerto',
  'Evento corporativo': 'Corporativo',
  Outro: 'Outro',
};

export interface DiaPedido {
  data: DataISO;
  atividade: AtividadeSessao;
  inicio: string;
  fim: string;
}

export interface PedidoDatasDados {
  evento: string;
  categoria: CategoriaPedido | '';
  categoriaOutra: string;
  /** Cada dia com a atividade (evento, montagem, ensaio…) e o horário: viram as sessões se o pedido for aprovado. */
  dias: DiaPedido[];
  observacoesHorarios: string;
  programacao: string;
  indicacao: (typeof INDICACOES_ETARIAS)[number] | '';
  /** Equipe de produção e artística. */
  pessoasEnvolvidas: number | null;
  espacos: string[];
  espacoOutro: string;
  publico: number | null;
  informacoes: string;
  /** Planilha Sigiloso. */
  solicitante: { razaoSocial: string; documento: string; endereco: string; cep: string; inscricaoEstadual: string; inscricaoMunicipal: string };
  /** Planilha Sigiloso. */
  responsavel: { nome: string; cpf: string; email: string; telefone: string };
}

export interface PedidoDatas extends PedidoDatasDados {
  id: Id;
  /** Número que a pessoa recebe ao enviar, ex.: PD-2026-0007. */
  protocolo: string;
  status: StatusPedido;
  recebidoEm: string;
  decididoEm: string;
  motivoRecusa: string;
  eventoId: Id | null;
}

export interface ConflitoPedido {
  data: DataISO;
  /** true = mesmo horário; false = só o mesmo dia. */
  grave: boolean;
  texto: string;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const numero = (v: unknown) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
const umDe = <T extends string>(v: unknown, opcoes: readonly T[]): T | '' => (opcoes.includes(v as T) ? (v as T) : '');
const digitos = (s: string) => s.replace(/\D/g, '');

/** O que chega da página pública passa por aqui antes de tudo: tipos certos, textos cortados, opções conhecidas. */
export function limparPedido(bruto: unknown): PedidoDatasDados {
  const b = (bruto ?? {}) as Record<string, unknown>;
  const s = (b.solicitante ?? {}) as Record<string, unknown>;
  const r = (b.responsavel ?? {}) as Record<string, unknown>;
  const dias = Array.isArray(b.dias) ? b.dias.slice(0, 30) : [];
  return {
    evento: texto(b.evento, 150),
    categoria: umDe(b.categoria, CATEGORIAS_PEDIDO),
    categoriaOutra: texto(b.categoriaOutra, 80),
    dias: dias.map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      return { data: texto(x.data, 10), atividade: (umDe(x.atividade, ATIVIDADES_PEDIDO) || 'evento') as AtividadeSessao, inicio: texto(x.inicio, 5), fim: texto(x.fim, 5) };
    }),
    observacoesHorarios: texto(b.observacoesHorarios, 1000),
    programacao: texto(b.programacao, 3000),
    indicacao: umDe(b.indicacao, INDICACOES_ETARIAS),
    pessoasEnvolvidas: numero(b.pessoasEnvolvidas),
    espacos: (Array.isArray(b.espacos) ? b.espacos : []).filter((e): e is string => ESPACOS_PEDIDO.includes(e as never)),
    espacoOutro: texto(b.espacoOutro, 120),
    publico: numero(b.publico),
    informacoes: texto(b.informacoes, 3000),
    solicitante: {
      razaoSocial: texto(s.razaoSocial, 150),
      documento: texto(s.documento, 20),
      endereco: texto(s.endereco, 250),
      cep: texto(s.cep, 10),
      inscricaoEstadual: texto(s.inscricaoEstadual, 30),
      inscricaoMunicipal: texto(s.inscricaoMunicipal, 30),
    },
    responsavel: { nome: texto(r.nome, 120), cpf: texto(r.cpf, 14), email: texto(r.email, 120).toLowerCase(), telefone: texto(r.telefone, 30) },
  };
}

/** Erros campo a campo (o campo segue o caminho do dado: 'dias.0.fim', 'responsavel.cpf'). */
export function errosDoPedido(d: PedidoDatasDados, hoje: DataISO): { campo: string; mensagem: string }[] {
  const erros: { campo: string; mensagem: string }[] = [];
  const erro = (campo: string, mensagem: string) => erros.push({ campo, mensagem });
  if (!d.evento.trim()) erro('evento', 'Informe o nome do evento.');
  if (!d.categoria) erro('categoria', 'Escolha a categoria do evento.');
  else if (d.categoria === 'Outro' && !d.categoriaOutra.trim()) erro('categoriaOutra', 'Diga qual é a categoria.');
  if (!d.dias.length) erro('dias', 'Informe pelo menos um dia.');
  d.dias.forEach((dia, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia.data) || dia.data < hoje) erro(`dias.${i}.data`, 'Escolha uma data a partir de hoje.');
    if (!HORA.test(dia.inicio)) erro(`dias.${i}.inicio`, 'Informe o horário de início.');
    if (!HORA.test(dia.fim) || (HORA.test(dia.inicio) && dia.fim <= dia.inicio)) erro(`dias.${i}.fim`, 'O fim precisa ser depois do início.');
  });
  if (d.dias.length && !d.dias.some((dia) => dia.atividade === 'evento')) erro('dias', 'Inclua o dia do evento em si (atividade "Evento").');
  if (!d.programacao.trim()) erro('programacao', 'Descreva a programação.');
  if (!d.indicacao) erro('indicacao', 'Escolha a indicação etária.');
  if (!d.pessoasEnvolvidas) erro('pessoasEnvolvidas', 'Informe quantas pessoas trabalham no evento.');
  if (!d.espacos.length && !d.espacoOutro.trim()) erro('espacos', 'Escolha pelo menos um espaço.');
  if (!d.publico) erro('publico', 'Informe o público estimado.');
  const s = d.solicitante;
  if (!s.razaoSocial.trim()) erro('solicitante.razaoSocial', 'Informe o nome jurídico.');
  if (!cnpjValido(s.documento) && !cpfValido(s.documento)) erro('solicitante.documento', 'Informe um CNPJ (ou CPF) válido.');
  if (!s.endereco.trim()) erro('solicitante.endereco', 'Informe o endereço.');
  if (digitos(s.cep).length !== 8) erro('solicitante.cep', 'Informe o CEP.');
  if (!s.inscricaoEstadual.trim()) erro('solicitante.inscricaoEstadual', 'Informe a inscrição estadual (ou "Isento").');
  if (!s.inscricaoMunicipal.trim()) erro('solicitante.inscricaoMunicipal', 'Informe a inscrição municipal (ou "Isento").');
  const r = d.responsavel;
  if (!r.nome.trim()) erro('responsavel.nome', 'Informe o nome do responsável.');
  if (!cpfValido(r.cpf)) erro('responsavel.cpf', 'Informe um CPF válido.');
  if (!emailValido(r.email)) erro('responsavel.email', 'Informe um e-mail válido.');
  if (digitos(r.telefone).length < 10) erro('responsavel.telefone', 'Informe o telefone com DDD.');
  return erros;
}

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Evento e sessões que o pedido aprovado cria: uma sessão por dia; o apoio (montagem, ensaio…) não paga diária. */
export function eventoDoPedido(
  p: PedidoDatas,
  padrao: { vagasBolsistas: number; vagasServidores: number; minimoExperientes: number },
): { evento: Evento; sessoes: Sessao[] } {
  const categoria = p.categoria === 'Outro' && p.categoriaOutra ? p.categoriaOutra : p.categoria;
  const espacos = [...p.espacos, ...(p.espacoOutro ? [p.espacoOutro] : [])].join(', ');
  return {
    evento: {
      id: '',
      nome: p.evento,
      tipo: p.categoria ? TIPO_DA_CATEGORIA[p.categoria] : 'Outro',
      organizador: p.solicitante.razaoSocial,
      contatoOrganizador: p.responsavel.nome,
      publicoEstimado: p.publico ?? undefined,
      pagamento: 'interno',
      instrumento: 'contrato',
      status: 'ativo',
      observacoes: `Pedido ${p.protocolo} (${categoria}). Espaços: ${espacos}. Indicação: ${p.indicacao}. Programação: ${p.programacao}`.slice(0, 1000),
    },
    sessoes: [...p.dias]
      .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio))
      .map((dia) => {
        const doEvento = dia.atividade === 'evento';
        return {
          id: '',
          eventoId: '',
          data: dia.data,
          rotulo: '',
          // no dia do evento a equipe chega 1h30 antes (dá para ajustar depois)
          chegada: doEvento ? hora(Math.max(0, minutos(dia.inicio) - 90)) : dia.inicio,
          inicio: dia.inicio,
          fim: dia.fim,
          horarioADefinir: false,
          vagasBolsistas: doEvento ? padrao.vagasBolsistas : 1,
          vagasServidores: doEvento ? padrao.vagasServidores : 0,
          diaria: null,
          minimoExperientes: doEvento ? padrao.minimoExperientes : 0,
          status: 'ativa',
          publicadaEm: null,
          convocacao: null,
          atividade: dia.atividade,
        };
      }),
  };
}

/** O que já ocupa os dias pedidos: sessões no mesmo horário (grave), no mesmo dia, e outros pedidos em análise. */
export function conflitosDoPedido(p: PedidoDatas, sessoes: Sessao[], eventos: Evento[], pedidos: PedidoDatas[]): ConflitoPedido[] {
  const nome = new Map(eventos.map((e) => [e.id, e.nome]));
  const cruza = (ini1: string, fim1: string, ini2: string, fim2: string) => ini1 < fim2 && ini2 < fim1;
  const lista: ConflitoPedido[] = [];
  for (const dia of p.dias) {
    for (const s of sessoes) {
      if (s.status !== 'ativa' || s.data !== dia.data) continue;
      const evento = nome.get(s.eventoId) ?? 'Evento';
      const de = s.chegada ?? s.inicio;
      if (s.horarioADefinir || !de || !s.fim) {
        lista.push({ data: dia.data, grave: false, texto: `Mesmo dia: ${evento}, horário a definir` });
        continue;
      }
      const grave = cruza(dia.inicio, dia.fim, de, s.fim);
      lista.push({ data: dia.data, grave, texto: `${grave ? '' : 'Mesmo dia: '}${evento}, das ${de} às ${s.fim}` });
    }
    for (const outro of pedidos) {
      if (outro.id === p.id || outro.status !== 'novo') continue;
      for (const o of outro.dias) {
        if (o.data === dia.data && cruza(dia.inicio, dia.fim, o.inicio, o.fim)) {
          lista.push({ data: dia.data, grave: true, texto: `Outro pedido em análise: ${outro.evento}, das ${o.inicio} às ${o.fim}` });
        }
      }
    }
  }
  const unicos = lista.filter((c, i) => lista.findIndex((x) => x.data === c.data && x.texto === c.texto) === i);
  // por dia; no mesmo dia, o que ocupa o mesmo horário vem antes
  return unicos.map((c, i) => ({ c, i })).sort((a, b) => a.c.data.localeCompare(b.c.data) || Number(b.c.grave) - Number(a.c.grave) || a.i - b.i).map(({ c }) => c);
}
