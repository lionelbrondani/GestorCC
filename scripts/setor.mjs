// Lê os dados do setor (setor/setor.json, fora do git) para os builds do site e da API.
// Sem o arquivo, vale o exemplo genérico de shared/src/setor.ts.
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

export const PASTA_SETOR = fileURLToPath(new URL('../setor/', import.meta.url));

/** O setor.json lido, ou null sem ele. */
export function lerSetor() {
  const arq = `${PASTA_SETOR}setor.json`;
  return existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : null;
}

/** Valor para o `define` do Vite/esbuild: o JSON do setor, ou `undefined`. */
export function defineSetor() {
  const s = lerSetor();
  return s ? JSON.stringify(s) : 'undefined';
}

/** Copia setor/publico/ por cima da pasta publicada (logos, ícones, fundo das placas, prints do manual). */
export function copiarPublicoSetor(destino) {
  const origem = `${PASTA_SETOR}publico`;
  if (existsSync(origem)) cpSync(origem, destino, { recursive: true });
}
