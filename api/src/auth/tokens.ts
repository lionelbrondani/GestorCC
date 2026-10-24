import type { Cripto } from '../nucleo/portas';
import { deBase64Url, deUtf8, iguais, paraBase64Url, utf8 } from './bytes';

export const VALIDADE_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

interface Carga {
  p: string;
  v: number;
  e: number;
}

const assinar = (cripto: Cripto, segredo: string, carga: string) => cripto.hmacSha256(utf8(segredo), utf8(carga));

export function emitirToken(cripto: Cripto, segredo: string, pessoaId: string, versaoToken: number, agoraMs: number): string {
  const carga = paraBase64Url(utf8(JSON.stringify({ p: pessoaId, v: versaoToken, e: agoraMs + VALIDADE_TOKEN_MS } satisfies Carga)));
  return `${carga}.${paraBase64Url(assinar(cripto, segredo, carga))}`;
}

export function lerToken(cripto: Cripto, segredo: string, token: string, agoraMs: number): { pessoaId: string; versaoToken: number } | null {
  try {
    const [carga, assinatura, ...resto] = token.split('.');
    if (!carga || !assinatura || resto.length) return null;
    if (!iguais(deBase64Url(assinatura), assinar(cripto, segredo, carga))) return null;
    const dados = JSON.parse(deUtf8(deBase64Url(carga))) as Carga;
    if (typeof dados.p !== 'string' || typeof dados.v !== 'number' || typeof dados.e !== 'number' || dados.e < agoraMs) return null;
    return { pessoaId: dados.p, versaoToken: dados.v };
  } catch {
    return null;
  }
}
