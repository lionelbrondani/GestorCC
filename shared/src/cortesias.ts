/**
 * Distribuição de cortesias: o gestor reparte as cortesias do evento entre destinos (ex.: Casa do Estudante), e cada
 * destino lança pelo seu link (sem login) quem vai receber.
 */
import { somarDias } from './datas';
import type { TravaFicha } from './fichaTecnica';
import type { DataISO, Id } from './tipos';

export const MAX_CORTESIAS_DESTINO = 2000;

export interface PessoaCortesia {
  nome: string;
  matricula: string;
}

/** Destino como o gestor vê (com a lista, que fica na planilha Sigiloso). */
export interface DestinoCortesias {
  id: Id;
  eventoId: Id;
  nome: string;
  quantidade: number;
  pedirMatricula: boolean;
  trava: TravaFicha;
  travada: boolean;
  /** Último dia para o destino mexer na lista: o dia anterior à primeira sessão. */
  prazo: DataISO | '';
  /** Quando o destino salvou a lista pela última vez ('' se ainda não salvou). */
  atualizadoPeloDestinoEm: string;
  atualizadoEm?: string;
  token: string;
  pessoas: PessoaCortesia[];
}

/** O que a página do destino recebe. */
export interface CortesiasPublica {
  evento: { nome: string; datas: DataISO[] };
  destino: { nome: string; quantidade: number; pedirMatricula: boolean };
  travada: boolean;
  prazo: DataISO | '';
  pessoas: PessoaCortesia[];
  /** LGPD: dias depois do evento em que os nomes são apagados (0 = nunca), para o aviso da página. */
  diasGuardarDados: number;
}

export interface ErroCortesia {
  indice: number;
  campo: 'nome' | 'matricula';
  mensagem: string;
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Aceita só nome e matrícula, sem linhas vazias e no máximo `quantidade` pessoas. */
export function limparPessoas(bruto: unknown, quantidade: number): PessoaCortesia[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({ nome: texto(p.nome, 120), matricula: texto(p.matricula, 20) }))
    .filter((p) => p.nome || p.matricula)
    .slice(0, Math.max(0, quantidade));
}

const chaveMatricula = (m: string) => m.replace(/\D/g, '').replace(/^0+/, '') || m.trim().toLowerCase();

export function errosCortesias(pessoas: PessoaCortesia[], pedirMatricula: boolean): ErroCortesia[] {
  const erros: ErroCortesia[] = [];
  const vistas = new Set<string>();
  pessoas.forEach((p, indice) => {
    if (!p.nome.trim()) erros.push({ indice, campo: 'nome', mensagem: 'Informe o nome.' });
    if (pedirMatricula && !p.matricula.trim()) erros.push({ indice, campo: 'matricula', mensagem: 'Informe a matrícula.' });
    if (p.matricula.trim()) {
      const k = chaveMatricula(p.matricula);
      if (vistas.has(k)) erros.push({ indice, campo: 'matricula', mensagem: 'Esta matrícula já está na lista.' });
      vistas.add(k);
    }
  });
  return erros;
}

/** O destino pode mexer até o dia anterior à primeira sessão ('' sem sessões). */
export function prazoCortesias(datas: DataISO[]): DataISO | '' {
  return datas.length ? somarDias([...datas].sort()[0], -1) : '';
}
