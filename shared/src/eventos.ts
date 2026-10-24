import { TIPOS_EVENTO, type Evento, type Sessao } from './tipos';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const vagaValida = (n: number) => Number.isInteger(n) && n >= 0;

/** Primeiro problema do evento, na mesma mensagem que o app e a API mostram; `null` se está tudo certo. */
export function validarEvento(evento: Evento, sessoes: Sessao[]): string | null {
  if (!evento.nome?.trim()) return 'Informe o nome do evento.';
  if (!TIPOS_EVENTO.includes(evento.tipo)) return 'Escolha o tipo do evento.';
  if (!sessoes.length) return 'O evento precisa de ao menos uma sessão.';
  if (sessoes.some((s) => !DATA.test(s.data ?? ''))) return 'Todas as sessões precisam de data.';
  if (evento.pagamento === 'externo' && !evento.pagadorExterno?.trim()) return 'Informe quem paga os bolsistas neste evento externo.';
  for (const s of sessoes) {
    if ([s.chegada, s.inicio, s.fim].some((h) => h !== null && h !== undefined && h !== '' && !HORA.test(h))) {
      return `Horário inválido na sessão de ${diaMes(s.data)}. Use HH:MM.`;
    }
    if (![s.vagasBolsistas, s.vagasServidores, s.minimoExperientes].every(vagaValida)) {
      return `Número de vagas inválido na sessão de ${diaMes(s.data)}.`;
    }
  }
  return null;
}
