import type { Permissoes } from './permissoes';

export type Id = string;
/** Data no formato 'AAAA-MM-DD'. */
export type DataISO = string;
/** Horário no formato 'HH:MM'. */
export type Hora = string;
/** Valor monetário em centavos (inteiro). */
export type Centavos = number;

export interface Pessoa {
  id: Id;
  nome: string;
  nomeCurto: string;
  emailAcademico: string;
  emailAlternativo?: string;
  matricula: string;
  siape?: string;
  tipo: 'servidor' | 'bolsista';
  vinculo: 'fixo' | 'eventual';
  experiente: boolean;
  escalarMenos: boolean;
  ativo: boolean;
  permissoes: Permissoes;
  /** E-mail que recebe convites das escalas no Google Agenda (null/ausente = desativado). */
  convitesAgenda?: string | null;
  /** Versão do registro (detecta edição simultânea). */
  atualizadoEm?: string;
}

export interface DadosPessoais {
  pessoaId: Id;
  cpf: string;
  banco: string;
  agencia: string;
  conta: string;
  nascimento?: DataISO;
  camiseta?: string;
}

export type TipoEvento = 'Congresso' | 'Formatura' | 'Show/Concerto' | 'Corporativo' | 'Outro';
export const TIPOS_EVENTO: TipoEvento[] = ['Congresso', 'Formatura', 'Show/Concerto', 'Corporativo', 'Outro'];

export interface Evento {
  id: Id;
  nome: string;
  tipo: TipoEvento;
  organizador: string;
  contatoOrganizador: string;
  servidorResponsavelId?: Id;
  publicoEstimado?: number;
  publicoReal?: number;
  pagamento: 'interno' | 'externo';
  pagadorExterno?: string;
  instrumento: 'contrato' | 'termo' | 'nenhum';
  status: 'ativo' | 'cancelado';
  observacoes?: string;
  /** Versão do registro, para detectar edição simultânea (spec 3). */
  atualizadoEm?: string;
}

export interface Sessao {
  id: Id;
  eventoId: Id;
  data: DataISO;
  rotulo?: string;
  chegada: Hora | null;
  inicio: Hora | null;
  fim: Hora | null;
  horarioADefinir: boolean;
  vagasBolsistas: number;
  vagasServidores: number;
  diaria: Centavos | null;
  minimoExperientes: number;
  status: 'ativa' | 'cancelada';
  publicadaEm: string | null;
  convocacao: { abertaAte: string; vagas: number } | null;
}

export interface Rodada {
  id: Id;
  nome: string;
  prazo: string;
  status: 'aberta' | 'fechada';
  sessaoIds: Id[];
  /** Sessões que entraram depois da abertura (selo "nova", spec 7.2). */
  sessoesNovas?: Id[];
}

export interface Disponibilidade {
  pessoaId: Id;
  sessaoId: Id;
  disponivel: boolean;
  origem: 'proprio' | 'gestor' | 'convocacao';
}

export type StatusEscala = 'rascunho' | 'publicado' | 'realizado' | 'faltou' | 'cancelado';

export interface Escala {
  id: Id;
  sessaoId: Id;
  pessoaId: Id;
  papel: 'bolsista' | 'servidor';
  status: StatusEscala;
  adicaoDireta: boolean;
  loteId: Id | null;
}

export interface Avaliacao {
  pessoaId: Id;
  mes: string;
  nota: 1 | 2 | 3 | 4 | 5;
  observacao: string;
}

export interface Feriado {
  data: DataISO;
  nome: string;
}

export interface Lote {
  id: Id;
  titulo: string;
  periodoReferencia: string;
  edital: string;
  iniciativa: string;
  incluirZerados: boolean;
  status: 'enviado' | 'pago' | 'cancelado';
  criadoEm: string;
  pagoEm: DataISO | null;
}

export interface LoteItem {
  loteId: Id;
  escalaId: Id;
  pessoaId: Id;
  valor: Centavos;
}

export interface Contratante {
  id: Id;
  razaoSocial: string;
  documento: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  endereco: string;
  cep: string;
  representanteNome: string;
  email: string;
  contatoFaturaNome: string;
  contatoFaturaEmail: string;
  contatoFaturaTelefone: string;
}

export interface Contrato {
  id: Id;
  numero: string;
  eventoId: Id;
  contratanteId: Id;
  processoPen: string;
  valorBase: Centavos;
  itemTabela: string;
  vencimento: DataISO;
  areas: string[];
  cortesiasQtd: number;
  ingressoSolidario: 'Possui' | 'Não possui' | 'CACC' | 'Mesa Brasil';
  statusContrato: string;
  statusFatura: string;
  numeroFatura: string;
  statusEcad: string;
  statusIss: string;
  statusFundep: string;
  statusCortesias: string;
  fichaTecnicaRecebida: boolean;
  canceladoMotivo: string;
  observacoes: string;
  /** PDF do contrato assinado e da fatura já anexados (os arquivos ficam no Drive). */
  pdfAssinado?: boolean;
  pdfFatura?: boolean;
  /** Versão do registro, para detectar edição simultânea. */
  atualizadoEm?: string;
}

export interface Aditivo {
  id: Id;
  contratoId: Id;
  numero: number;
  data: DataISO;
  descricao: string;
  valorDelta: Centavos;
  novaData: DataISO | null;
  statusFatura: string;
}

export interface AlmoxItem {
  cod: string;
  nomeAlmox: string;
  nomeComum: string;
  unidade: string;
  valor: Centavos;
  categoria: string;
  qtdMinima: number;
  sala: string;
  status: 'Ativo' | 'Inativo';
  saldo: number;
}

export interface AlmoxMovimento {
  id: Id;
  quando: string;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'recebimento';
  cod: string;
  qtd: number;
  valorUnitario: Centavos;
  retiradoPorPessoaId?: Id;
  retiradoPorExterno?: string;
  eventoId?: Id;
  finalidade?: string;
  pedidoId?: Id;
  ocorrenciaId?: Id;
  motivo?: string;
}

export interface AlmoxPedido {
  id: Id;
  criadoEm: string;
  solicitanteId: Id;
  status: 'aberto' | 'parcial' | 'recebido' | 'cancelado';
  itens: { cod: string; qtdPedida: number; qtdRecebida: number; valorEstimado: Centavos }[];
}

export type StatusOcorrencia = 'nova' | 'analise' | 'chamado' | 'atendimento' | 'resolvida' | 'naoProcede';
export type PrioridadeOcorrencia = 'baixa' | 'media' | 'alta' | 'urgente';

export interface Ocorrencia {
  id: Id;
  /** Número sequencial para citar no dia a dia (ex.: #12). */
  numero: number;
  titulo: string;
  descricao: string;
  categoria: string;
  local: string;
  prioridade: PrioridadeOcorrencia;
  status: StatusOcorrencia;
  origem: 'formulario' | 'app';
  relatorNome: string;
  relatorPessoaId?: Id;
  relatorContato?: string;
  eventoId?: Id;
  criadaEm: string;
  /** Foto reduzida: data URL no protótipo; com a API vem null e o app busca por infra.foto quando temFoto. */
  foto: string | null;
  temFoto?: boolean;
  /** Chamado aberto no sistema de chamados da UFSM. */
  chamadoNumero: string;
  chamadoLink: string;
  chamadoAbertoEm: string | null;
  resolvidaEm: string | null;
  historico: { quando: string; quemId: Id; de: StatusOcorrencia | null; para: StatusOcorrencia; observacao: string }[];
}

export interface Aviso {
  id: Id;
  titulo: string;
  texto: string;
  publico: 'todos' | 'gestores' | 'bolsistas' | 'pessoas';
  pessoasIds: Id[];
  fixado: boolean;
  validoAte: DataISO | null;
  pedeConfirmacao: boolean;
  autorId: Id;
  criadoEm: string;
  leituras: Id[];
  atualizadoEm?: string;
}

export interface Notificacao {
  id: Id;
  pessoaId: Id;
  texto: string;
  link: string;
  criadaEm: string;
  lida: boolean;
}

export interface RegistroHistorico {
  id: Id;
  quando: string;
  quemId: Id;
  entidade: string;
  entidadeId: Id;
  acao: string;
  justificativa: string;
}

export interface Config {
  diariaPadrao: Centavos;
  vagasBolsistasPadrao: number;
  vagasServidoresPadrao: number;
  minimoExperientesPadrao: number;
  edital: string;
  iniciativa: string;
  projetoFundep: string;
  destinatariosFundep: string[];
  assinaturaEmail: string;
  limitePerguntasDia: number;
  linksFormularios: { nome: string; url: string }[];
  /** Agenda Google do setor, mantida pela conta do sistema. */
  agendaSetor: { nome: string; conta: string; link: string; conectada: boolean };
  atualizadoEm?: string;
}
