import { formatarData, pode, ROTULO_STATUS_ACHADO, type Achado, type AlmoxItem, type Contrato, type Evento, type Permissoes, type Pessoa } from '@shared';

export interface ResultadoBusca {
  tipo: 'pessoa' | 'evento' | 'item' | 'contrato' | 'achado';
  titulo: string;
  subtitulo: string;
  link: string;
}

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sem acento, sem maiúsculas e sem pontuação: "guarda chuva" acha "Guarda-chuva". */
export const normalizar = (s: string) => semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim();

const LIMITE = 8;

export function buscaComum(
  termo: string,
  dados: { pessoas: Pessoa[]; eventos: Evento[]; itens: AlmoxItem[]; contratos: Contrato[]; achados?: Achado[] },
  p: Permissoes,
): ResultadoBusca[] {
  const t = normalizar(termo);
  if (t.length < 2) return [];
  const casa = (...campos: (string | undefined)[]) => normalizar(campos.filter(Boolean).join(' ')).includes(t);
  const r: ResultadoBusca[] = [];

  if (pode(p, 'pessoas', 'ver') || pode(p, 'escalas', 'ver')) {
    for (const x of dados.pessoas) {
      if (x.ativo && casa(x.nome, x.nomeCurto)) {
        r.push({
          tipo: 'pessoa',
          titulo: x.nome,
          subtitulo: x.tipo === 'servidor' ? 'Servidor' : `Bolsista ${x.vinculo}`,
          link: pode(p, 'pessoas', 'ver') ? `/pessoas/${x.id}` : '/escalas?aba=montar',
        });
      }
    }
  }
  if (pode(p, 'eventos', 'ver')) {
    for (const e of dados.eventos) if (casa(e.nome, e.organizador)) r.push({ tipo: 'evento', titulo: e.nome, subtitulo: e.tipo, link: `/agenda/${e.id}` });
  }
  if (pode(p, 'almoxEstoque', 'ver') || pode(p, 'almoxSaidas', 'ver')) {
    for (const i of dados.itens) {
      if (i.status === 'Ativo' && casa(i.cod, i.nomeComum, i.nomeAlmox)) {
        r.push({ tipo: 'item', titulo: i.nomeComum || i.nomeAlmox, subtitulo: `Cód. ${i.cod} · saldo ${i.saldo}`, link: '/almox?aba=estoque' });
      }
    }
  }
  if (pode(p, 'contratos', 'ver')) {
    for (const c of dados.contratos) {
      const ev = dados.eventos.find((e) => e.id === c.eventoId);
      if (casa(c.numero, ev?.nome)) r.push({ tipo: 'contrato', titulo: `Contrato ${c.numero}`, subtitulo: ev?.nome ?? '', link: `/contratos/${c.id}` });
    }
  }
  if (pode(p, 'achados', 'ver')) {
    for (const a of dados.achados ?? []) {
      if (casa(`#${a.numero}`, a.descricao, a.local)) {
        r.push({ tipo: 'achado', titulo: `#${a.numero} ${a.descricao}`, subtitulo: `${ROTULO_STATUS_ACHADO[a.status]} · achado em ${formatarData(a.achadoEm)}`, link: `/achados?item=${a.id}` });
      }
    }
  }
  return r.slice(0, LIMITE);
}
