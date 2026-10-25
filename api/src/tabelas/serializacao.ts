import type { NomeTabela } from '../nucleo/portas';
import { colunas, type TipoColuna } from './esquema';

const VERDADEIROS = new Set(['true', 'verdadeiro', 'sim', '1', 'x']);
const dois = (v: number) => String(v).padStart(2, '0');

/** Date do Sheets → 'AAAA-MM-DDTHH:MM' (o fuso local do Apps Script é o do projeto). */
export function dataParaTexto(v: Date): string {
  return `${v.getFullYear()}-${dois(v.getMonth() + 1)}-${dois(v.getDate())}T${dois(v.getHours())}:${dois(v.getMinutes())}`;
}

function ler(valor: unknown, tipo: TipoColuna): unknown {
  const vazio = valor === '' || valor === null || valor === undefined;
  switch (tipo) {
    case 'booleano':
      if (typeof valor === 'boolean') return valor;
      return !vazio && VERDADEIROS.has(String(valor).trim().toLowerCase());
    case 'numero': {
      if (vazio) return 0;
      const num = Number(valor);
      return Number.isFinite(num) ? num : 0;
    }
    case 'numeroOpcional': {
      if (vazio) return null;
      const num = Number(valor);
      return Number.isFinite(num) ? num : null;
    }
    case 'json':
      if (vazio) return null;
      if (typeof valor !== 'string') return valor;
      try {
        return JSON.parse(valor);
      } catch {
        return null;
      }
    case 'dataHora':
      if (valor instanceof Date) return dataParaTexto(valor);
      return vazio ? '' : String(valor).trim();
    case 'texto':
    default:
      if (vazio) return '';
      if (valor instanceof Date) return dataParaTexto(valor).slice(0, 10);
      if (typeof valor === 'number') return Number.isInteger(valor) ? valor.toFixed(0) : String(valor);
      return String(valor).trim();
  }
}

function escrever(valor: unknown, tipo: TipoColuna): unknown {
  if (valor === undefined || valor === null) return '';
  if (tipo === 'json') return JSON.stringify(valor);
  if (tipo === 'booleano') return valor === true;
  return valor;
}

/**
 * Valor pronto para a célula. Texto vai com apóstrofo: o Sheets guarda como texto, sem virar fórmula
 * (hash começando com "+"), número (CPF com zero à esquerda) ou data. O apóstrofo não volta na leitura.
 */
export function paraCelula(valor: unknown): unknown {
  return typeof valor === 'string' && valor !== '' ? `'${valor}` : valor;
}

/** Converte uma linha da planilha em objeto, localizando as colunas pelo nome do cabeçalho. */
export function linhaParaObjeto(tabela: NomeTabela, cab: string[], linha: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const c of colunas(tabela)) {
    const i = cab.indexOf(c.nome);
    obj[c.nome] = ler(i >= 0 ? linha[i] : '', c.tipo);
  }
  return obj;
}

/** Converte um objeto numa linha seguindo a ordem do cabeçalho existente; colunas desconhecidas ficam vazias. */
export function objetoParaLinha(tabela: NomeTabela, cab: string[], obj: Record<string, unknown>): unknown[] {
  const tipos = new Map(colunas(tabela).map((c) => [c.nome, c.tipo]));
  return cab.map((nome) => (tipos.has(nome) ? escrever(obj[nome], tipos.get(nome)!) : ''));
}
