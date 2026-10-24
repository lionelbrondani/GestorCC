/// <reference types="google-apps-script" />
// Portas reais, com os serviços do Apps Script. Não é testado em Node; a lógica fica nos módulos puros.
import { ErroApi, somarDias } from '@shared';
import type { AgendaGoogle, Cache, Cripto, EventoAgenda, NomeTabela, Planilha, Portas, Propriedades, Relogio, Repositorio, Trava } from '../nucleo/portas';
import { cabecalhos, ESQUEMA } from '../tabelas/esquema';
import { linhaParaObjeto, objetoParaLinha, paraCelula } from '../tabelas/serializacao';

const FUSO = 'America/Sao_Paulo';

export const relogioGas: Relogio = {
  agoraMs: () => Date.now(),
  formatar: (ms) => Utilities.formatDate(new Date(ms), FUSO, "yyyy-MM-dd'T'HH:mm"),
  agora: () => Utilities.formatDate(new Date(), FUSO, "yyyy-MM-dd'T'HH:mm"),
  hoje: () => Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd'),
};

const paraAssinados = (b: Uint8Array): number[] => Array.from(b, (x) => (x > 127 ? x - 256 : x));
const deAssinados = (b: number[]): Uint8Array => Uint8Array.from(b, (x) => x & 255);

export const criptoGas: Cripto = {
  hmacSha256: (chave, msg) =>
    deAssinados(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, paraAssinados(msg), paraAssinados(chave))),
  aleatorio(bytes) {
    // UUIDs v4 do Apps Script (aleatórios) passados por SHA-256 para espalhar os bits.
    const saida: number[] = [];
    while (saida.length < bytes) {
      const semente = Utilities.getUuid() + Utilities.getUuid() + Date.now();
      saida.push(...Array.from(deAssinados(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, semente))));
    }
    return Uint8Array.from(saida.slice(0, bytes));
  },
};

export const travaGas: Trava = {
  executar(fn, esperaMs) {
    const trava = LockService.getScriptLock();
    if (!trava.tryLock(esperaMs)) throw new ErroApi('SISTEMA_OCUPADO', 'O sistema está ocupado. Tente de novo em alguns segundos.');
    try {
      return fn();
    } finally {
      trava.releaseLock();
    }
  },
};

export const cacheGas: Cache = {
  obter: (k) => CacheService.getScriptCache().get(k),
  guardar(k, v, s) {
    try {
      CacheService.getScriptCache().put(k, v, s);
    } catch {
      // resposta grande demais para o cache: só perde a proteção contra reenvio desta chamada
    }
  },
};

export const propriedadesGas: Propriedades = {
  obter: (k) => PropertiesService.getScriptProperties().getProperty(k),
  definir: (k, v) => void PropertiesService.getScriptProperties().setProperty(k, v),
};

const ID_PLANILHA: Record<Planilha, string> = { dados: 'DADOS_ID', sigiloso: 'SIGILOSO_ID', relatorios: 'RELATORIOS_ID' };

export function abrirPlanilha(p: Planilha): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const id = propriedadesGas.obter(ID_PLANILHA[p]);
  if (!id) throw new Error(`${ID_PLANILHA[p]} não configurado (rode instalar()).`);
  return SpreadsheetApp.openById(id);
}

/** Repositório sobre as planilhas: lê cada aba uma vez por requisição e escreve linha a linha. */
export function repositorioGas(relogio: Relogio): Repositorio {
  type Aba = { folha: GoogleAppsScript.Spreadsheet.Sheet; cab: string[]; linhas: Record<string, unknown>[] };
  const abertas = new Map<Planilha, GoogleAppsScript.Spreadsheet.Spreadsheet>();
  const abas = new Map<NomeTabela, Aba>();
  let autor = '';

  const planilha = (p: Planilha) => {
    if (!abertas.has(p)) abertas.set(p, abrirPlanilha(p));
    return abertas.get(p)!;
  };

  function aba(t: NomeTabela): Aba {
    const pronta = abas.get(t);
    if (pronta) return pronta;
    const folha = planilha(ESQUEMA[t].planilha).getSheetByName(t);
    if (!folha) throw new Error(`Aba "${t}" não encontrada (rode instalar()).`);
    const valores = folha.getDataRange().getValues();
    const cab = (valores[0] ?? cabecalhos(t)).map((c) => String(c).trim());
    const linhas = valores.slice(1).filter((l) => l.some((v) => v !== '')).map((l) => linhaParaObjeto(t, cab, l));
    const nova = { folha, cab, linhas };
    abas.set(t, nova);
    return nova;
  }

  const linhaNaFolha = (a: Aba, id: string) => {
    // procura direto na coluna id da folha (as linhas em cache podem ter pulado linhas vazias)
    const ids = a.folha.getRange(2, a.cab.indexOf('id') + 1, Math.max(1, a.folha.getLastRow() - 1), 1).getValues();
    const i = ids.findIndex((r) => String(r[0]) === id);
    return i < 0 ? -1 : i + 2;
  };

  return {
    listar: <T extends { id: string }>(t: NomeTabela) => JSON.parse(JSON.stringify(aba(t).linhas)) as T[],
    inserir(t, r) {
      const a = aba(t);
      if (a.linhas.some((x) => x.id === r.id)) throw new Error(`Registro repetido em ${t}: ${r.id}`);
      const agora = relogio.agora();
      const obj = { ...r, criadoEm: agora, atualizadoEm: agora, atualizadoPor: autor } as Record<string, unknown>;
      a.folha.appendRow(objetoParaLinha(t, a.cab, obj).map(paraCelula));
      a.linhas.push(obj);
    },
    atualizar(t, r) {
      const a = aba(t);
      const i = a.linhas.findIndex((x) => x.id === r.id);
      const linha = linhaNaFolha(a, r.id);
      if (i < 0 || linha < 0) throw new Error(`Registro inexistente em ${t}: ${r.id}`);
      const obj = { ...r, criadoEm: a.linhas[i].criadoEm, atualizadoEm: relogio.agora(), atualizadoPor: autor } as Record<string, unknown>;
      a.folha.getRange(linha, 1, 1, a.cab.length).setValues([objetoParaLinha(t, a.cab, obj).map(paraCelula)]);
      a.linhas[i] = obj;
    },
    remover(t, id) {
      const a = aba(t);
      const linha = linhaNaFolha(a, id);
      if (linha > 0) a.folha.deleteRow(linha);
      a.linhas = a.linhas.filter((x) => x.id !== id);
    },
    lerAbaLivre(p, nome) {
      const folha = planilha(p).getSheetByName(nome);
      if (!folha) return [];
      const [cab, ...linhas] = folha.getDataRange().getValues();
      if (!cab) return [];
      return linhas
        .filter((l) => l.some((v) => v !== ''))
        .map((l) => Object.fromEntries(cab.map((c, i) => [String(c), l[i]])));
    },
    definirAutor(pessoaId) {
      autor = pessoaId;
    },
  };
}

/** Sem e-mail para ninguém: toda mudança na agenda é silenciosa. */
const SILENCIOSO = { sendUpdates: 'none' };

function recursoDoEvento(e: EventoAgenda): GoogleAppsScript.Calendar.Schema.Event {
  const q = e.quando;
  return {
    summary: e.titulo,
    description: e.descricao,
    start: q.diaInteiro ? { date: q.dia } : { dateTime: `${q.inicio}:00`, timeZone: FUSO },
    end: q.diaInteiro ? { date: somarDias(q.dia, 1) } : { dateTime: `${q.fim}:00`, timeZone: FUSO },
    attendees: e.convidados.map((email) => ({ email })),
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
  };
}

/** Agenda Google do setor pelo serviço avançado Calendar v3 (o id vem de AGENDA_ID, criado pelo instalar). */
export const agendaGas: AgendaGoogle = {
  ligada: () => !!propriedadesGas.obter('AGENDA_ID'),
  salvar(id, evento) {
    const agendaId = propriedadesGas.obter('AGENDA_ID')!;
    const recurso = recursoDoEvento(evento);
    if (id) {
      try {
        Calendar.Events!.patch(recurso, agendaId, id, SILENCIOSO);
        return id;
      } catch {
        // apagado à mão no Google: cria de novo e passa a usar o id novo
      }
    }
    return Calendar.Events!.insert(recurso, agendaId, SILENCIOSO).id!;
  },
  remover(id) {
    Calendar.Events!.remove(propriedadesGas.obter('AGENDA_ID')!, id, SILENCIOSO);
  },
};

export function portasGas(): Portas {
  return {
    repo: repositorioGas(relogioGas),
    cripto: criptoGas,
    trava: travaGas,
    cache: cacheGas,
    relogio: relogioGas,
    props: propriedadesGas,
    agenda: agendaGas,
  };
}
