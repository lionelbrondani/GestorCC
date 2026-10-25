/**
 * Portas: tudo que a API usa do mundo externo. Em produção são implementadas com os serviços
 * do Apps Script (adaptadores/gas.ts); nos testes, em memória e com o crypto do Node.
 */

export type Planilha = 'dados' | 'sigiloso' | 'relatorios';

export type NomeTabela =
  | 'pessoas'
  | 'permissoes'
  | 'avisos'
  | 'avisosLeituras'
  | 'notificacoes'
  | 'historico'
  | 'config'
  | 'feriados'
  | 'eventos'
  | 'sessoes'
  | 'rodadas'
  | 'rodadaSessoes'
  | 'disponibilidades'
  | 'escalas'
  | 'avaliacoes'
  | 'lotes'
  | 'loteItens'
  | 'envioExterno'
  | 'almoxItens'
  | 'almoxMovimentos'
  | 'almoxAutorizadosExternos'
  | 'almoxPedidos'
  | 'almoxPedidoItens'
  | 'ocorrencias'
  | 'ocorrenciasHistorico'
  | 'contratos'
  | 'aditivos'
  | 'contratantes'
  | 'dadosPessoais'
  | 'credenciais';

/** Linhas (a partir de 0) em negrito e com fundo de destaque numa aba de relatório. */
export interface FormatoAba {
  negrito?: number[];
  destaque?: number[];
}

export interface Repositorio {
  listar<T extends { id: string }>(tabela: NomeTabela): T[];
  inserir<T extends { id: string }>(tabela: NomeTabela, registro: T): void;
  /** Substitui o registro de mesmo id; carimba atualizadoEm/atualizadoPor. */
  atualizar<T extends { id: string }>(tabela: NomeTabela, registro: T): void;
  remover(tabela: NomeTabela, id: string): void;
  /** Lê uma aba fora do esquema (ex.: IMPORTAR_PESSOAS), usando a primeira linha como cabeçalho. */
  lerAbaLivre(planilha: Planilha, aba: string): Record<string, unknown>[];
  /** Reescreve uma aba fora do esquema (relatórios): cria se faltar, limpa e grava as linhas; a primeira é o cabeçalho. */
  escreverAbaLivre(planilha: Planilha, aba: string, linhas: string[][], formato?: FormatoAba): void;
  /** Quem está gravando (vai para atualizadoPor). */
  definirAutor(pessoaId: string): void;
}

export interface Cripto {
  hmacSha256(chave: Uint8Array, msg: Uint8Array): Uint8Array;
  aleatorio(bytes: number): Uint8Array;
}

export interface Trava {
  /** Executa com exclusividade; se não conseguir em `esperaMs`, lança ErroApi SISTEMA_OCUPADO. */
  executar<T>(fn: () => T, esperaMs: number): T;
}

export interface Cache {
  obter(chave: string): string | null;
  guardar(chave: string, valor: string, segundos: number): void;
}

export interface Relogio {
  agoraMs(): number;
  /** 'AAAA-MM-DDTHH:MM' em America/Sao_Paulo. */
  agora(): string;
  /** 'AAAA-MM-DD' em America/Sao_Paulo. */
  hoje(): string;
  /** Instante qualquer (ms) como 'AAAA-MM-DDTHH:MM' em America/Sao_Paulo. */
  formatar(ms: number): string;
}

export interface Propriedades {
  obter(chave: string): string | null;
  definir(chave: string, valor: string): void;
}

/** Quando o evento acontece na agenda: dia inteiro (horário a definir) ou de 'AAAA-MM-DDTHH:MM' a 'AAAA-MM-DDTHH:MM'. */
export type QuandoAgenda = { diaInteiro: true; dia: string } | { diaInteiro: false; inicio: string; fim: string };

export interface EventoAgenda {
  titulo: string;
  descricao: string;
  quando: QuandoAgenda;
  convidados: string[];
}

/** Agenda Google do setor. Nunca manda e-mail: criar, alterar e remover são silenciosos. */
export interface AgendaGoogle {
  /** Falso enquanto o `instalar` não criou a agenda. */
  ligada(): boolean;
  /** Cria (id null) ou atualiza; devolve o id do evento no Google. Lança erro se o Google falhar. */
  salvar(id: string | null, evento: EventoAgenda): string;
  remover(id: string): void;
}

/** Arquivos enviados pelo app (fotos das ocorrências, PDFs dos contratos), no Drive, sem link público. */
export interface Arquivos {
  /** Grava o arquivo (data URL) numa subpasta da pasta do sistema e devolve o id do arquivo. */
  salvarImagem(dataUrl: string, nome: string, pasta?: 'Infraestrutura' | 'Contratos'): string;
  /** Devolve a imagem como data URL, ou null se o arquivo não existe mais. */
  lerImagem(id: string): string | null;
}

/** Respostas do Google Form de problemas do prédio; null quando FORMULARIO_INFRA_ID não está configurado. */
export interface Formulario {
  respostasInfra(): Record<string, unknown>[] | null;
}

/** Documentos gerados a partir dos modelos (Google Docs em GestorCC/Modelos) — spec 9.6. */
export interface Documentos {
  /** Copia o modelo, troca os {{CAMPOS}} e devolve o link do Google Doc e o .docx (data URL). Lança MODELO se o modelo não existe. */
  gerar(modelo: string, campos: Record<string, string>, nomeArquivo: string): { url: string; docx: string };
}

export interface Portas {
  repo: Repositorio;
  cripto: Cripto;
  trava: Trava;
  cache: Cache;
  relogio: Relogio;
  props: Propriedades;
  agenda: AgendaGoogle;
  arquivos: Arquivos;
  formulario: Formulario;
  documentos: Documentos;
}
