import type { DataISO } from './tipos';

/** Consultas que a busca sabe responder (spec 10.3). A pergunta vira uma delas; a consulta roda com as permissões de quem perguntou. */
export type Consulta =
  | { nome: 'escalaDoDia'; data: DataISO }
  | { nome: 'escalasDaPessoa'; termo: string }
  | { nome: 'proximosEventos' }
  | { nome: 'vagasFaltando' }
  | { nome: 'naoResponderam' }
  | { nome: 'saldoItem'; termo: string }
  | { nome: 'estoqueCritico' }
  | { nome: 'contratosPendentes' }
  | { nome: 'lotesEmAberto' }
  | { nome: 'ocorrenciasAbertas'; termo: string };

/** Descrição de cada consulta e do parâmetro que ela pede (vira a lista de funções para o Gemini). */
export const CONSULTAS: { nome: Consulta['nome']; descricao: string; parametro?: { nome: 'data' | 'termo'; descricao: string; obrigatorio: boolean } }[] = [
  { nome: 'escalaDoDia', descricao: 'Quem está escalado num dia (equipe de um dia ou de uma sessão).', parametro: { nome: 'data', descricao: 'Data no formato AAAA-MM-DD', obrigatorio: true } },
  { nome: 'escalasDaPessoa', descricao: 'Próximas escalas de uma pessoa.', parametro: { nome: 'termo', descricao: 'Nome ou parte do nome da pessoa', obrigatorio: true } },
  { nome: 'proximosEventos', descricao: 'Próximos eventos da agenda.' },
  { nome: 'vagasFaltando', descricao: 'Sessões com vagas de bolsista ainda faltando.' },
  { nome: 'naoResponderam', descricao: 'Quem ainda não respondeu a rodada de disponibilidade aberta.' },
  { nome: 'saldoItem', descricao: 'Saldo de um item do almoxarifado.', parametro: { nome: 'termo', descricao: 'Nome ou código do item', obrigatorio: true } },
  { nome: 'estoqueCritico', descricao: 'Itens do almoxarifado com estoque no mínimo ou abaixo.' },
  { nome: 'contratosPendentes', descricao: 'Contratos com pendência (fatura, ECAD, ISS, assinatura, cortesias).' },
  { nome: 'lotesEmAberto', descricao: 'Lotes de pagamento enviados e ainda não pagos.' },
  { nome: 'ocorrenciasAbertas', descricao: 'Ocorrências de infraestrutura do prédio em aberto.', parametro: { nome: 'termo', descricao: 'Palavra para filtrar, ex.: vazamento, lâmpada (vazio = todas)', obrigatorio: false } },
];

/** Confere nome e parâmetros vindos de fora (Gemini); devolve a consulta ou null. */
export function validarConsulta(nome: unknown, args: unknown): Consulta | null {
  const def = CONSULTAS.find((c) => c.nome === nome);
  if (!def) return null;
  if (!def.parametro) return { nome: def.nome } as Consulta;
  const valor = String((args as Record<string, unknown> | null)?.[def.parametro.nome] ?? '').trim();
  if (def.parametro.nome === 'data') return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? ({ nome: def.nome, data: valor } as Consulta) : null;
  if (def.parametro.obrigatorio && !valor) return null;
  return { nome: def.nome, termo: valor.slice(0, 80) } as Consulta;
}
