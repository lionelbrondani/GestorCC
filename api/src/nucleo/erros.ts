import type { Portas, Propriedades } from './portas';

const CHAVE = 'ERROS_RECENTES';
const QUANTOS = 10;

export type ErroRegistrado = { quando: string; acao: string; mensagem: string };

export function lerErros(props: Propriedades): ErroRegistrado[] {
  try {
    const lista: unknown = JSON.parse(props.obter(CHAVE) ?? '[]');
    return Array.isArray(lista) ? (lista as ErroRegistrado[]) : [];
  } catch {
    return [];
  }
}

/** Guarda os últimos erros internos para a Saúde do sistema, sem precisar abrir o registro do Apps Script. */
export function registrarErro(portas: Pick<Portas, 'props' | 'relogio'>, acao: string, erro: unknown): void {
  try {
    const novo = { quando: portas.relogio.agora(), acao: acao || '?', mensagem: String((erro as Error)?.message ?? erro).slice(0, 200) };
    portas.props.definir(CHAVE, JSON.stringify([novo, ...lerErros(portas.props)].slice(0, QUANTOS)));
  } catch {
    // registrar um erro nunca pode causar outro
  }
}
