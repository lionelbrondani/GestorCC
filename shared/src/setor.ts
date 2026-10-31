/**
 * Quem usa o sistema: nome do setor, e-mails, textos próprios e a planta do teatro.
 *
 * No git fica só este exemplo genérico. Os dados de um setor de verdade ficam em `setor/setor.json`,
 * fora do git; os builds do site e da API leem esse arquivo e o injetam em `__SETOR__`.
 * Nos testes e no protótipo (npm run dev) vale sempre o exemplo.
 */
import type { SetorPlanta, TipoLugar } from './poltronas';

export interface Setor {
  /** Nome curto, ex.: 'Centro de Eventos'. */
  nome: string;
  /** Gênero do nome, para "do/da", "no/na", "ao/à". */
  genero: 'o' | 'a';
  /** Nome com a instituição, para documentos e e-mails. */
  nomeCompleto: string;
  /** Instituição do setor (chamados de manutenção, diárias, vínculo de servidor). */
  instituicao: string;
  /** Endereço das escalas no Google Agenda. */
  local: string;
  /** E-mail do setor: produtores, privacidade (LGPD). */
  email: string;
  /** Assinatura padrão dos e-mails (pode ser mudada em Configurações). */
  assinaturaEmail: string;
  /** Texto alternativo dos logos. */
  logoAlt: string;
  /** Link do regulamento interno, na ficha técnica. Vazio = sem o link. */
  linkRegulamento: string;
  /** Fundação que emite as faturas dos contratos. */
  fundacao: string;
  /** Número padrão do projeto na fundação. */
  projetoFundacao: string;
  /** Lotação padrão do teatro, no aviso do pedido de data. */
  lotacao: number;
  /** Destinos dos alimentos arrecadados (ficha técnica). */
  destinosAlimentos: string[];
  /** O assistente da busca em forma de conversa. */
  assistente: { nome: string; subtitulo: string; ola: string; persona: string; pensando: string; limite: string };
  /**
   * Crédito: `curto` no menu e no login; `sobre` completa "O GestorCC…" na janela Sobre; `email` recebe sugestões e
   * erros (vazio = o e-mail do setor); `repositorio` é o link do código (vazio = sem o link).
   */
  credito: { curto: string; sobre: string; email: string; repositorio: string };
  /** Planta das poltronas do teatro. */
  planta: { setores: SetorPlanta[]; especiais: Record<string, Partial<Record<TipoLugar, string[]>>> };
}

/** Fila comum: esquerda ímpares 1..e, centro ímpares c1..c2 e pares p1..p2, direita pares d..2. */
function fila(f: string, esq: number, centro: [number, number, number, number], dir: number) {
  const imp = (de: number, ate: number) => Array.from({ length: (ate - de) / 2 + 1 }, (_, i) => de + 2 * i);
  const par = (de: number, ate: number) => Array.from({ length: (de - ate) / 2 + 1 }, (_, i) => de - 2 * i);
  return { fila: f, blocos: [[imp(1, esq)], [[...imp(centro[0], centro[1]), ...par(centro[2], centro[3])]], [par(dir, 2)]] };
}

export const SETOR_EXEMPLO: Setor = {
  nome: 'Centro de Eventos',
  genero: 'o',
  nomeCompleto: 'Centro de Eventos da Universidade',
  instituicao: 'Universidade',
  local: 'Centro de Eventos',
  email: 'contato@exemplo.org',
  assinaturaEmail: 'Centro de Eventos\nUniversidade',
  logoAlt: 'GestorCC',
  linkRegulamento: '',
  fundacao: 'Fundação',
  projetoFundacao: '',
  lotacao: 1000,
  destinosAlimentos: ['Banco de Alimentos', 'Instituição de caridade', 'Outro'],
  assistente: {
    nome: 'Assistente',
    subtitulo: 'a busca em forma de conversa',
    ola: 'Oi! Eu sou o assistente do GestorCC e ajudo a equipe: escalas, agenda, estoque, contratos, pedidos de data… Pergunte do seu jeito.',
    persona: 'Você é o assistente do GestorCC: nas respostas em texto, seja simpático e breve.',
    pensando: 'Procurando…',
    limite: 'Por hoje chega de perguntas: o limite do dia acabou. Amanhã eu volto.',
  },
  credito: {
    curto: 'GestorCC · código aberto',
    sobre: 'é um sistema de código aberto, feito de forma gratuita e sem visar benefícios próprios.',
    email: '',
    repositorio: '',
  },
  planta: {
    setores: [
      { id: 'baixa', nome: 'Plateia Baixa', filas: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((f) => fila(f, 9, [11, 21, 22, 12], 10)) },
      { id: 'alta', nome: 'Plateia Alta', filas: ['I', 'J', 'K', 'L', 'M', 'N'].map((f) => fila(f, 11, [13, 23, 24, 14], 12)) },
      { id: 'mezanino', nome: 'Mezanino', filas: ['A', 'B', 'C', 'D'].map((f) => fila(f, 7, [9, 19, 20, 10], 8)) },
    ],
    especiais: {
      baixa: { obeso: ['F09', 'F10'], mobilidade: ['H11', 'H12'] },
      alta: { pne: ['N01', 'N03', 'N02', 'N04'], obeso: ['I01', 'I02'] },
      mezanino: { obeso: ['A07', 'A08'] },
    },
  },
};

declare const __SETOR__: Partial<Setor> | undefined;

export const SETOR: Setor = { ...SETOR_EXEMPLO, ...(typeof __SETOR__ !== 'undefined' ? __SETOR__ : {}) };

const o = SETOR.genero === 'o';
/** "do Centro de Eventos" / "da Casa de Cultura". */
export const DO_SETOR = `${o ? 'do' : 'da'} ${SETOR.nome}`;
/** "no Centro de Eventos" / "na Casa de Cultura". */
export const NO_SETOR = `${o ? 'no' : 'na'} ${SETOR.nome}`;
/** "ao Centro de Eventos" / "à Casa de Cultura". */
export const AO_SETOR = `${o ? 'ao' : 'à'} ${SETOR.nome}`;
/** "o Centro de Eventos" / "a Casa de Cultura". */
export const O_SETOR = `${SETOR.genero} ${SETOR.nome}`;
/** "do Centro de Eventos da Universidade". */
export const DO_SETOR_COMPLETO = `${o ? 'do' : 'da'} ${SETOR.nomeCompleto}`;
/** "no Centro de Eventos da Universidade". */
export const NO_SETOR_COMPLETO = `${o ? 'no' : 'na'} ${SETOR.nomeCompleto}`;
/** Opção do vínculo de quem responde pela ficha que pede o SIAPE ou a matrícula. */
export const VINCULO_SERVIDOR = `Servidor da ${SETOR.instituicao}`;
