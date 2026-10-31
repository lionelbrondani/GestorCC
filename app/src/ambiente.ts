/** Endereço da API (Apps Script). Sem ele, o app roda como protótipo com dados fictícios no navegador. */
export const URL_API: string = import.meta.env.VITE_API_URL ?? '';
export const MODO_PROTOTIPO = !URL_API;
