import { formatarDataHora } from './datas';
import type { Modulo } from './permissoes';
import type { Rodada } from './tipos';

/**
 * E-mails que o GestorCC manda, sempre quando alguém clica em "Enviar e-mail" depois de ver e poder editar
 * destinatários, assunto e texto. Nada sai sozinho.
 */
export type TipoEmail = 'ficha' | 'cortesias' | 'fundep' | 'escala' | 'rodada' | 'acesso' | 'pedido';

/** Quem pode mandar: quem edita o módulo da tela que monta o e-mail. */
export const MODULO_DO_EMAIL: Record<TipoEmail, Modulo> = {
  ficha: 'eventos',
  cortesias: 'eventos',
  fundep: 'contratos',
  escala: 'escalas',
  rodada: 'escalas',
  acesso: 'pessoas',
  pedido: 'eventos',
};

/** Um e-mail só, com todos no Para (só a FUNDEP); nos demais cada pessoa recebe o seu e ninguém vê os outros endereços. */
export const EMAIL_JUNTO: Record<TipoEmail, boolean> = {
  ficha: false,
  cortesias: false,
  fundep: true,
  escala: false,
  rodada: false,
  acesso: false,
  pedido: false,
};

/** Por envio. O Google conta cada destinatário na cota do dia (cerca de 100 numa conta gratuita). */
export const LIMITE_DESTINATARIOS = 50;
export const LIMITE_ASSUNTO = 200;
export const LIMITE_MENSAGEM = 20000;

const RE_EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/;

export function emailValido(s: string): boolean {
  return RE_EMAIL.test(s.trim());
}

/** Lê o campo "Para": e-mails separados por vírgula, ponto e vírgula, espaço ou linha, sem repetir. */
export function separarEmails(texto: string): { validos: string[]; invalidos: string[] } {
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const parte of texto.split(/[\s,;]+/)) {
    if (!parte) continue;
    const e = parte.toLowerCase();
    if (!emailValido(e)) invalidos.push(parte);
    else if (!validos.includes(e)) validos.push(e);
  }
  return { validos, invalidos };
}

/** Lembrete da rodada para quem ainda não respondeu: cada um recebe o seu, sem ver quem mais falta. */
export function textoLembreteRodadaEmail(rodada: Pick<Rodada, 'nome' | 'prazo'>, link: string): string {
  return (
    `Olá! A rodada de disponibilidade ${rodada.nome} fecha em ${formatarDataHora(rodada.prazo)} e ainda falta a sua resposta.\n\n` +
    `Entre no GestorCC e marque os eventos em que você pode trabalhar:\n${link}\n\n` +
    'Sem resposta, você conta como indisponível.'
  );
}
