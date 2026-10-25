/// <reference types="google-apps-script" />
// Portas reais, com os serviços do Apps Script. Não é testado em Node; a lógica fica nos módulos puros.
import { ErroApi } from '@shared';
import { eventoSumiuNoGoogle, recursoDoEvento } from '../agenda/recursoGoogle';
import type { AgendaGoogle, Arquivos, Cache, Cripto, Documentos, Formulario, IA, NomeTabela, Planilha, Portas, Propriedades, Relogio, Repositorio, Trava } from '../nucleo/portas';
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
    escreverAbaLivre(p, nome, linhas, formato) {
      const doc = planilha(p);
      const folha = doc.getSheetByName(nome) ?? doc.insertSheet(nome);
      folha.clearContents();
      if (!linhas.length) return;
      const largura = Math.max(...linhas.map((l) => l.length));
      const matriz = linhas.map((l) => [...l, ...Array<string>(largura - l.length).fill('')].map(paraCelula));
      folha.getRange(1, 1, matriz.length, largura).setValues(matriz);
      folha.getRange(1, 1, matriz.length, largura).setFontWeight('normal').setBackground(null).setFontColor(null);
      folha.getRange(1, 1, 1, largura).setFontWeight('bold').setBackground('#232323').setFontColor('#F5C518');
      for (const i of formato?.negrito ?? []) folha.getRange(i + 1, 1, 1, largura).setFontWeight('bold');
      for (const i of formato?.destaque ?? []) folha.getRange(i + 1, 1, 1, largura).setBackground('#FFF4C2');
      folha.setFrozenRows(1);
    },
    definirAutor(pessoaId) {
      autor = pessoaId;
    },
  };
}

/** Sem e-mail para ninguém: toda mudança na agenda é silenciosa. */
const SILENCIOSO = { sendUpdates: 'none' };

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
      } catch (e) {
        // só recria se o evento não existe mais; outra falha vira pendência (sem duplicar o evento)
        if (!eventoSumiuNoGoogle(e)) throw e;
      }
    }
    return Calendar.Events!.insert(recurso, agendaId, SILENCIOSO).id!;
  },
  remover(id) {
    Calendar.Events!.remove(propriedadesGas.obter('AGENDA_ID')!, id, SILENCIOSO);
  },
};

/** Subpasta (criada na primeira vez) dentro de `mae`, ou da pasta do sistema (PASTA_ID). */
function subpasta(nome: string, mae = DriveApp.getFolderById(propriedadesGas.obter('PASTA_ID')!)): GoogleAppsScript.Drive.Folder {
  const existentes = mae.getFoldersByName(nome);
  return existentes.hasNext() ? existentes.next() : mae.createFolder(nome);
}

/** Documentos dos modelos em GestorCC/Modelos, copiados para GestorCC/Documentos gerados/AAAA (spec 9.6). */
export const documentosGas: Documentos = {
  gerar(modelo, campos, nomeArquivo) {
    const arquivos = subpasta('Modelos').getFilesByName(modelo);
    if (!arquivos.hasNext()) throw new ErroApi('MODELO', `Coloque o Google Doc "${modelo}" na pasta GestorCC/Modelos.`);
    const destino = subpasta(String(new Date().getFullYear()), subpasta('Documentos gerados'));
    const copia = arquivos.next().makeCopy(nomeArquivo, destino);
    const doc = DocumentApp.openById(copia.getId());
    const corpo = doc.getBody();
    for (const [campo, valor] of Object.entries(campos)) corpo.replaceText(`\\{\\{${campo}\\}\\}`, valor);
    doc.saveAndClose();
    const resposta = UrlFetchApp.fetch(`https://docs.google.com/document/d/${copia.getId()}/export?format=docx`, {
      headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    });
    const tipo = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return { url: copia.getUrl(), docx: `data:${tipo};base64,${Utilities.base64Encode(resposta.getBlob().getBytes())}` };
  },
};

/** Fotos e PDFs no Drive, sem compartilhamento: só a conta do sistema lê, e o app recebe pela API. */
export const arquivosGas: Arquivos = {
  salvarImagem(dataUrl, nome, pasta = 'Infraestrutura') {
    const [cabecalho, base64] = dataUrl.split(',');
    const tipo = /data:([^;]+)/.exec(cabecalho)?.[1] ?? 'image/jpeg';
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), tipo, `${nome}.${tipo.split('/')[1] ?? 'jpg'}`);
    return subpasta(pasta).createFile(blob).getId();
  },
  lerImagem(id) {
    try {
      const blob = DriveApp.getFileById(id).getBlob();
      return `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`;
    } catch {
      return null;
    }
  },
};

/** Respostas do Google Form de problemas: a primeira aba da planilha FORMULARIO_INFRA_ID. */
export const formularioGas: Formulario = {
  respostasInfra() {
    const id = propriedadesGas.obter('FORMULARIO_INFRA_ID');
    if (!id) return null;
    const [cab, ...linhas] = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues();
    if (!cab) return [];
    return linhas.filter((l) => l.some((v) => v !== '')).map((l) => Object.fromEntries(cab.map((c, i) => [String(c), l[i]])));
  },
};

/** Gemini pelo nível gratuito do Google AI Studio: chave em GEMINI_API_KEY, modelo em GEMINI_MODELO. */
export const iaGas: IA = {
  gerar(corpo) {
    const chave = propriedadesGas.obter('GEMINI_API_KEY');
    if (!chave) return null;
    const modelo = propriedadesGas.obter('GEMINI_MODELO') || 'gemini-2.5-flash';
    const r = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': chave },
      payload: JSON.stringify(corpo),
      muteHttpExceptions: true,
    });
    if (r.getResponseCode() !== 200) throw new Error(`Gemini respondeu ${r.getResponseCode()}`);
    return JSON.parse(r.getContentText());
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
    arquivos: arquivosGas,
    formulario: formularioGas,
    documentos: documentosGas,
    ia: iaGas,
  };
}
