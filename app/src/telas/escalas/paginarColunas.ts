export function paginarColunas<T>(colunas: T[], porPagina: number): T[][] {
  if (!colunas.length) return [[]];
  const paginas: T[][] = [];
  for (let i = 0; i < colunas.length; i += porPagina) paginas.push(colunas.slice(i, i + porPagina));
  return paginas;
}
