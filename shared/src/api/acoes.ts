import type { MeusGanhos } from '../pagamentos/ganhos';
import type {
  Aditivo,
  AlmoxItem,
  AlmoxMovimento,
  AlmoxPedido,
  Avaliacao,
  Aviso,
  Centavos,
  Config,
  Contratante,
  Contrato,
  DadosPessoais,
  DataISO,
  Disponibilidade,
  Escala,
  Evento,
  Feriado,
  Id,
  Lote,
  LoteItem,
  Notificacao,
  Pessoa,
  RegistroHistorico,
  Rodada,
  Sessao,
} from '../tipos';

type A<E, S> = { entrada: E; saida: S };

/** Mapa tipado de todas as ações da API: nome → { entrada; saida }. */
export interface Acoes {
  'auth.entrar': A<{ email: string; senha: string }, { token: string; pessoa: Pessoa; senhaInicial: boolean }>;
  'auth.trocarSenha': A<{ atual: string; nova: string }, null>;
  'auth.esqueciSenha': A<{ email: string }, null>;

  'pessoas.listar': A<null, Pessoa[]>;
  'pessoas.salvar': A<Pessoa, Pessoa>;
  'pessoas.redefinirSenha': A<{ pessoaId: Id }, null>;
  'dadosPessoais.obter': A<{ pessoaId: Id }, DadosPessoais | null>;
  'dadosPessoais.salvar': A<DadosPessoais, DadosPessoais>;

  'eventos.listar': A<{ de: DataISO; ate: DataISO }, { eventos: Evento[]; sessoes: Sessao[] }>;
  'eventos.salvar': A<{ evento: Evento; sessoes: Sessao[] }, { evento: Evento; sessoes: Sessao[] }>;
  'eventos.cancelar': A<{ eventoId: Id; justificativa: string }, null>;
  'sessoes.cancelar': A<{ sessaoId: Id; justificativa: string }, null>;
  'feriados.listar': A<{ ano: number }, Feriado[]>;
  'feriados.salvar': A<{ ano: number; feriados: Feriado[] }, Feriado[]>;

  'rodadas.listar': A<null, Rodada[]>;
  'rodadas.salvar': A<Rodada, Rodada>;
  'disponibilidades.listar': A<{ sessaoIds: Id[] }, Disponibilidade[]>;
  'disponibilidades.marcar': A<{ sessaoId: Id; disponivel: boolean; pessoaId?: Id }, Disponibilidade>;

  'escalas.listar': A<{ de: DataISO; ate: DataISO }, Escala[]>;
  'escalas.salvarRascunho': A<
    { sessaoId: Id; itens: { pessoaId: Id; papel: 'bolsista' | 'servidor'; adicaoDireta: boolean }[] },
    Escala[]
  >;
  'escalas.publicar': A<{ sessaoIds: Id[]; enviarEmail: boolean }, null>;
  'escalas.trocar': A<{ sessaoId: Id; sai: Id | null; entra: Id | null; justificativa: string }, Escala[]>;
  'escalas.convocar': A<{ sessaoId: Id; vagas: number; abertaAte: string }, Sessao>;
  'escalas.confirmarPresenca': A<{ sessaoId: Id; faltaram: Id[] }, Escala[]>;
  'avaliacoes.listar': A<{ mes: string }, Avaliacao[]>;
  'avaliacoes.salvar': A<Avaliacao, Avaliacao>;

  'lotes.listar': A<null, { lotes: Lote[]; itens: LoteItem[] }>;
  'lotes.criar': A<
    { escalaIds: Id[]; titulo: string; periodoReferencia: string; edital: string; iniciativa: string; incluirZerados: boolean },
    Lote
  >;
  'lotes.retirarItem': A<{ loteId: Id; escalaId: Id }, Lote>;
  'lotes.marcarPago': A<{ loteId: Id; data: DataISO }, Lote>;
  'lotes.cancelar': A<{ loteId: Id; justificativa: string }, Lote>;
  'ganhos.meus': A<null, MeusGanhos>;
  'externos.registrarEnvio': A<{ eventoId: Id; campos: string[] }, null>;

  'contratos.listar': A<null, { contratos: Contrato[]; aditivos: Aditivo[]; contratantes: Contratante[] }>;
  'contratos.salvar': A<Contrato, Contrato>;

  'almox.listar': A<null, { itens: AlmoxItem[]; autorizadosExternos: string[] }>;
  'almox.movimentos': A<{ cod?: string }, AlmoxMovimento[]>;
  'almox.salvarItem': A<AlmoxItem, AlmoxItem>;
  'almox.ajustar': A<{ cod: string; qtd: number; motivo: string }, AlmoxItem>;
  'almox.retirar': A<
    {
      itens: { cod: string; qtd: number }[];
      retiradoPorPessoaId?: Id;
      retiradoPorExterno?: string;
      finalidade: string;
      eventoId?: Id;
    },
    AlmoxMovimento[]
  >;
  'almox.pedidos': A<null, AlmoxPedido[]>;
  'almox.criarPedido': A<{ itens: { cod: string; qtdPedida: number; valorEstimado: Centavos }[] }, AlmoxPedido>;
  'almox.receber': A<{ pedidoId: Id; itens: { cod: string; qtd: number }[] }, AlmoxPedido>;

  'avisos.listar': A<null, Aviso[]>;
  'avisos.salvar': A<Aviso, Aviso>;
  'avisos.confirmarLeitura': A<{ avisoId: Id }, null>;
  'notificacoes.listar': A<null, Notificacao[]>;
  'notificacoes.marcarLidas': A<null, null>;
  'historico.listar': A<{ entidade?: string; entidadeId?: Id }, RegistroHistorico[]>;
  'config.obter': A<null, Config>;
  'config.salvar': A<Config, Config>;
}

export type Acao = keyof Acoes;
export type Entrada<K extends Acao> = Acoes[K]['entrada'];
export type Saida<K extends Acao> = Acoes[K]['saida'];

export class ErroApi extends Error {
  constructor(
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}
