import type { Consulta, Pessoa } from '@shared';
import { semAcento } from './buscaComum';

const MINIMO = 3;
const LETRA = '\\p{L}\\p{N}_';

/**
 * O plano gratuito do Gemini pode usar o que recebe, então os nomes das pessoas cadastradas saem da pergunta:
 * nome completo, primeiro nome e nome curto (3 letras ou mais, palavra inteira, sem diferença de acento ou maiúscula)
 * viram PESSOA_1, PESSOA_2… na ordem em que aparecem. `devolver` troca os códigos da resposta pelo nome completo; se o
 * nome digitado serve para mais de uma pessoa, volta como foi digitado.
 */
export function protegerNomes(pergunta: string, pessoas: Pick<Pessoa, 'nome' | 'nomeCurto'>[]): { texto: string; devolver: (s: string) => string } {
  // texto sem acento, com a posição de cada letra no original
  let norm = '';
  const origem: number[] = [];
  let pos = 0;
  for (const ch of pergunta) {
    for (const n of semAcento(ch)) {
      norm += n;
      origem.push(pos);
    }
    pos += ch.length;
  }
  origem.push(pergunta.length);

  const donos = new Map<string, Set<string>>();
  for (const p of pessoas) {
    for (const variante of [p.nome, p.nomeCurto, p.nome.trim().split(/\s+/)[0]]) {
      const v = semAcento(variante ?? '').trim().replace(/\s+/g, ' ');
      if (v.length >= MINIMO) donos.set(v, (donos.get(v) ?? new Set()).add(p.nome));
    }
  }

  // os nomes mais longos primeiro: "camila freitas" antes de "camila"
  const achados: { ini: number; fim: number; nome: string | null }[] = [];
  for (const [v, quem] of [...donos].sort(([a], [b]) => b.length - a.length)) {
    const escapado = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    // sem lookbehind, que falha no Safari antes do iOS 16.4: o caractere de antes entra no grupo 1
    for (const m of norm.matchAll(new RegExp(`(^|[^${LETRA}])(${escapado})(?![${LETRA}])`, 'gu'))) {
      const ini = m.index! + m[1].length;
      const fim = ini + m[2].length;
      if (achados.some((a) => ini < a.fim && a.ini < fim)) continue;
      achados.push({ ini, fim, nome: quem.size === 1 ? [...quem][0] : null });
    }
  }
  achados.sort((a, b) => a.ini - b.ini);

  const codigos = new Map<string, number>();
  const nomes = new Map<number, string>();
  let texto = '';
  let ultimo = 0;
  for (const a of achados) {
    const digitado = pergunta.slice(origem[a.ini], origem[a.fim]);
    const chave = a.nome ?? semAcento(digitado);
    if (!codigos.has(chave)) {
      codigos.set(chave, codigos.size + 1);
      nomes.set(codigos.size, a.nome ?? digitado);
    }
    texto += `${pergunta.slice(ultimo, origem[a.ini])}PESSOA_${codigos.get(chave)}`;
    ultimo = origem[a.fim];
  }
  texto += pergunta.slice(ultimo);

  return { texto, devolver: (s) => s.replace(/PESSOA_(\d+)/gi, (codigo, n: string) => nomes.get(Number(n)) ?? codigo) };
}

/** O termo ou o filtro que o Gemini devolve vêm com os códigos; voltam com o nome antes da consulta rodar aqui. */
export function devolverNaConsulta(c: Consulta, devolver: (s: string) => string): Consulta {
  if (c.nome === 'analise') return { ...c, filtro: devolver(c.filtro) };
  if ('termo' in c) return { ...c, termo: devolver(c.termo) };
  return c;
}
