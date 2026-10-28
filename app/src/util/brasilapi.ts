import type { Feriado } from '@shared';

/**
 * Consultas públicas da BrasilAPI (gratuita, sem chave), feitas direto do navegador.
 * Só o CNPJ, o CEP ou o ano saem daqui; qualquer falha devolve null e a pessoa preenche à mão.
 */
const BASE = 'https://brasilapi.com.br/api';
type Buscar = (url: string) => Promise<Response>;

const digitos = (s: string) => s.replace(/\D/g, '');
const formatarCep = (cep: string) => {
  const d = digitos(cep ?? '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : '';
};

async function obter<T>(url: string, buscar: Buscar): Promise<T | null> {
  try {
    const r = await buscar(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface DadosCnpj {
  razaoSocial: string;
  endereco: string;
  cep: string;
  email: string;
  /** Situação na Receita ("ATIVA", "BAIXADA"…). */
  situacao: string;
}

type RespostaCnpj = Partial<Record<'razao_social' | 'descricao_tipo_de_logradouro' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'municipio' | 'uf' | 'cep' | 'email' | 'descricao_situacao_cadastral', string | null>>;

/** CNPJ (14 dígitos) → dados da Receita; CPF ou CNPJ incompleto não consulta. */
export async function consultarCnpj(documento: string, buscar: Buscar = fetch): Promise<DadosCnpj | null> {
  const cnpj = digitos(documento);
  if (cnpj.length !== 14) return null;
  const d = await obter<RespostaCnpj>(`${BASE}/cnpj/v1/${cnpj}`, buscar);
  if (!d?.razao_social) return null;
  const rua = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ');
  const comNumero = [rua, d.numero].filter(Boolean).join(', ');
  const local = [d.bairro, [d.municipio, d.uf].filter(Boolean).join('/')].filter(Boolean).join(', ');
  return {
    razaoSocial: d.razao_social,
    endereco: [comNumero, d.complemento, local].filter(Boolean).join(' - '),
    cep: formatarCep(d.cep ?? ''),
    email: (d.email ?? '').toLowerCase(),
    situacao: d.descricao_situacao_cadastral ?? '',
  };
}

/** CEP (8 dígitos) → endereço sem o número, para completar à mão. */
export async function consultarCep(cep: string, buscar: Buscar = fetch): Promise<{ endereco: string; cep: string } | null> {
  if (digitos(cep).length !== 8) return null;
  const d = await obter<{ street?: string; neighborhood?: string; city?: string; state?: string }>(`${BASE}/cep/v2/${digitos(cep)}`, buscar);
  if (!d?.city) return null;
  const cidade = [d.city, d.state].filter(Boolean).join('/');
  return { endereco: [d.street, d.neighborhood, cidade].filter(Boolean).join(', '), cep: formatarCep(cep) };
}

/** Feriados nacionais do ano; os de Santa Maria e os recessos da UFSM continuam à mão. */
export async function feriadosNacionais(ano: number, buscar: Buscar = fetch): Promise<Feriado[] | null> {
  const lista = await obter<{ date: string; name: string }[]>(`${BASE}/feriados/v1/${ano}`, buscar);
  return Array.isArray(lista) ? lista.map((f) => ({ data: f.date, nome: f.name })) : null;
}
