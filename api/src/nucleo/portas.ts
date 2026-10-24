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
  | 'dadosPessoais'
  | 'credenciais';

export interface Repositorio {
  listar<T extends { id: string }>(tabela: NomeTabela): T[];
  inserir<T extends { id: string }>(tabela: NomeTabela, registro: T): void;
  /** Substitui o registro de mesmo id; carimba atualizadoEm/atualizadoPor. */
  atualizar<T extends { id: string }>(tabela: NomeTabela, registro: T): void;
  remover(tabela: NomeTabela, id: string): void;
  /** Lê uma aba fora do esquema (ex.: IMPORTAR_PESSOAS), usando a primeira linha como cabeçalho. */
  lerAbaLivre(planilha: Planilha, aba: string): Record<string, unknown>[];
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

export interface Email {
  enviar(para: string, assunto: string, corpoHtml: string): void;
}

export interface Propriedades {
  obter(chave: string): string | null;
  definir(chave: string, valor: string): void;
}

export interface Portas {
  repo: Repositorio;
  cripto: Cripto;
  trava: Trava;
  cache: Cache;
  relogio: Relogio;
  email: Email;
  props: Propriedades;
}
