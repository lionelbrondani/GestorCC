import type { Consulta } from '../busca';
import type { CortesiasPublica, DestinoCortesias, PessoaCortesia } from '../cortesias';
import type { TipoEmail } from '../email';
import type { AnexoFicha, FichaPublica, FichaResumo, FichaTecnica, FichaTecnicaDados, TravaFicha } from '../fichaTecnica';
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
  Ocorrencia,
  PrioridadeOcorrencia,
  StatusOcorrencia,
  Pessoa,
  RegistroHistorico,
  Rodada,
  Sessao,
} from '../tipos';

type A<E, S> = { entrada: E; saida: S };

/** Mapa tipado de todas as ações da API: nome → { entrada; saida }. */
export interface Acoes {
  'sistema.ping': A<null, { versao: string }>;
  'auth.entrar': A<{ email: string; senha: string }, { token: string; pessoa: Pessoa; senhaInicial: boolean }>;
  /** Devolve um novo token: a troca invalida as sessões antigas. */
  'auth.trocarSenha': A<{ atual: string; nova: string }, { token: string }>;
  'perfil.salvarAgenda': A<{ email: string | null }, Pessoa>;

  'pessoas.listar': A<null, Pessoa[]>;
  'pessoas.salvar': A<Pessoa, Pessoa>;
  'pessoas.redefinirSenha': A<{ pessoaId: Id }, null>;
  'pessoas.importar': A<null, { importadas: number; atualizadas: number; problemas: { linha: number; mensagem: string }[] }>;
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
  /** Várias marcações numa ida só (a tela junta os cliques); todas ou nenhuma. */
  'disponibilidades.marcarVarios': A<{ pessoaId?: Id; itens: { sessaoId: Id; disponivel: boolean }[] }, Disponibilidade[]>;

  'escalas.listar': A<{ de: DataISO; ate: DataISO }, Escala[]>;
  'escalas.salvarRascunho': A<
    { sessaoId: Id; itens: { pessoaId: Id; papel: 'bolsista' | 'servidor'; adicaoDireta: boolean }[] },
    Escala[]
  >;
  /** Avisa os escalados pelo app; e-mail só se alguém mandar depois, pelo botão de e-mail. */
  'escalas.publicar': A<{ sessaoIds: Id[] }, null>;
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
  'contratos.salvarAditivo': A<Aditivo, Aditivo>;
  'contratantes.salvar': A<Contratante, Contratante>;
  /** PDF (data URL) do contrato assinado ou da fatura; fica no Drive. */
  'contratos.anexar': A<{ contratoId: Id; tipo: 'assinado' | 'fatura'; arquivo: string }, Contrato>;
  'contratos.anexo': A<{ contratoId: Id; tipo: 'assinado' | 'fatura' }, string | null>;
  /** Documento a partir do modelo do Google Docs (spec 9.6): link do Doc e .docx para baixar. */
  'documentos.gerar': A<{ contratoId: Id; tipo: 'contrato' | 'termo' | 'piano' }, { url: string; docx: string }>;

  'almox.listar': A<null, { itens: AlmoxItem[]; autorizadosExternos: string[] }>;
  /** Pessoas de fora da equipe que podem retirar material (inclui as desativadas). */
  'almox.autorizados': A<null, { id: Id; nome: string; ativo: boolean }[]>;
  'almox.salvarAutorizado': A<{ id: Id; nome: string; ativo: boolean }, { id: Id; nome: string; ativo: boolean }>;
  /** Catálogo antigo colado nas abas IMPORTAR_ALMOX e IMPORTAR_AUTORIZADOS da planilha Dados. */
  'almox.importar': A<null, { itens: number; autorizados: number; problemas: { linha: number; mensagem: string }[] }>;
  'almox.movimentos': A<{ cod?: string; ocorrenciaId?: Id }, AlmoxMovimento[]>;
  'almox.salvarItem': A<AlmoxItem, AlmoxItem>;
  'almox.ajustar': A<{ cod: string; qtd: number; motivo: string }, AlmoxItem>;
  'almox.retirar': A<
    {
      itens: { cod: string; qtd: number }[];
      retiradoPorPessoaId?: Id;
      retiradoPorExterno?: string;
      /** Cadastra na hora o nome externo que ainda não está na lista de autorizados. */
      cadastrarExterno?: boolean;
      finalidade: string;
      eventoId?: Id;
      ocorrenciaId?: Id;
    },
    AlmoxMovimento[]
  >;
  'almox.pedidos': A<null, AlmoxPedido[]>;
  'almox.criarPedido': A<{ itens: { cod: string; qtdPedida: number; valorEstimado: Centavos }[] }, AlmoxPedido>;
  'almox.receber': A<{ pedidoId: Id; itens: { cod: string; qtd: number }[] }, AlmoxPedido>;

  'infra.listar': A<null, Ocorrencia[]>;
  'infra.relatar': A<
    { titulo: string; descricao: string; categoria: string; local: string; prioridade: PrioridadeOcorrencia; foto: string | null; eventoId?: Id },
    Ocorrencia
  >;
  'infra.atualizar': A<
    {
      id: Id;
      para?: StatusOcorrencia;
      observacao: string;
      chamadoNumero?: string;
      chamadoLink?: string;
      prioridade?: PrioridadeOcorrencia;
      categoria?: string;
      local?: string;
    },
    Ocorrencia
  >;
  'infra.importarFormulario': A<null, { importadas: number }>;
  /** Foto da ocorrência como data URL (fica no Drive, sem link público). */
  'infra.foto': A<{ id: Id }, string | null>;
  /** Pergunta da barra de busca → consulta (ou ajuda de uso). Só a pergunta vai ao Gemini. */
  /** Ficha técnica pelo link do produtor: sem login, o token do link é a chave e só abre a ficha daquele evento. */
  'ficha.abrir': A<{ token: string }, FichaPublica>;
  /** Salva o rascunho; com enviar, confere tudo e marca como enviada. Recusa depois do prazo. */
  'ficha.salvar': A<{ token: string; dados: FichaTecnicaDados; enviar: boolean }, FichaPublica>;
  /** Anexo da sinopse (data URL), guardado no Drive em GestorCC/Fichas técnicas. */
  'ficha.anexar': A<{ token: string; nome: string; arquivo: string }, AnexoFicha>;
  /** Ficha do evento para o gestor (com os dados sigilosos do responsável); null se o link ainda não foi gerado. */
  /** Todas as fichas (menu Fichas técnicas), da mais próxima para a mais distante. */
  'fichas.listar': A<null, FichaResumo[]>;
  'fichas.obter': A<{ eventoId: Id }, FichaTecnica | null>;
  /** Gera o link (ou um novo, invalidando o antigo, com novo = true). */
  'fichas.link': A<{ eventoId: Id; novo: boolean }, FichaTecnica>;
  'fichas.salvar': A<{ eventoId: Id; dados: FichaTecnicaDados; versao?: string }, FichaTecnica>;
  /** Cria ou atualiza na agenda do CC a montagem, a passagem de som e a desmontagem informadas na ficha. */
  'fichas.lancarAgenda': A<{ eventoId: Id }, FichaTecnica>;
  'fichas.travar': A<{ eventoId: Id; trava: TravaFicha }, FichaTecnica>;
  /** Anexo da ficha como data URL. */
  'fichas.anexo': A<{ eventoId: Id; anexoId: Id }, string | null>;
  /** Destinos das cortesias do evento e o total do contrato (null sem contrato). */
  'cortesias.listar': A<{ eventoId: Id }, { destinos: DestinoCortesias[]; totalContrato: number | null }>;
  /** Cria (id vazio) ou altera um destino; a quantidade não pode ficar abaixo dos nomes já lançados. */
  'cortesias.salvarDestino': A<{ id: Id; eventoId: Id; nome: string; quantidade: number; pedirMatricula: boolean }, DestinoCortesias>;
  'cortesias.removerDestino': A<{ id: Id }, null>;
  /** Novo link: o antigo deixa de valer. */
  'cortesias.novoLink': A<{ id: Id }, DestinoCortesias>;
  'cortesias.travar': A<{ id: Id; trava: TravaFicha }, DestinoCortesias>;
  /** O gestor corrige a lista de um destino. */
  'cortesias.salvarPessoas': A<{ id: Id; pessoas: PessoaCortesia[] }, DestinoCortesias>;
  /** Página do destino, pelo link (sem login). */
  /** Só as quantidades por evento (relatório): destinos, cortesias de cada um e nomes já lançados — sem nomes. */
  'cortesias.resumo': A<{ eventoIds: Id[] }, { eventoId: Id; destinos: { nome: string; quantidade: number; lancados: number }[] }[]>;
  'cortesia.abrir': A<{ token: string }, CortesiasPublica>;
  'cortesia.salvar': A<{ token: string; pessoas: PessoaCortesia[] }, CortesiasPublica>;
  /** Quantos destinatários ainda cabem hoje na cota de e-mails do Google. */
  'emails.cota': A<null, { restante: number }>;
  /**
   * Manda na hora o e-mail que a pessoa viu e confirmou (nunca automático). Destinatários: os e-mails digitados e
   * os das pessoas escolhidas (pessoaIds, o servidor busca o endereço). Na FUNDEP, contratoIds anexa os PDFs assinados.
   */
  'emails.enviar': A<
    { tipo: TipoEmail; para: string[]; pessoaIds?: Id[]; assunto: string; mensagem: string; html?: string; contratoIds?: Id[] },
    { enviados: number; restante: number }
  >;
  'busca.interpretar': A<{ pergunta: string }, { consulta: Consulta | null; ajuda: string | null; motivo: 'limite' | 'indisponivel' | null }>;

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
