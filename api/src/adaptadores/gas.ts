/// <reference types="google-apps-script" />
// Portas reais, com os serviços do Apps Script. Não é testado em Node; a lógica fica nos módulos puros.
import { ErroApi } from '@shared';
import { eventoSumiuNoGoogle, recursoDoEvento } from '../agenda/recursoGoogle';
import { chamarComReserva } from '../busca/modelos';
import type { AgendaGoogle, Arquivos, Cache, Cripto, Documentos, Email, Formulario, IA, IdentidadeGoogle, NomeTabela, Planilha, Portas, Propriedades, Relogio, Repositorio, Trava } from '../nucleo/portas';
import { ESQUEMA } from '../tabelas/esquema';
import { criarLeitorAbas } from '../tabelas/leitorAbas';
import { objetoParaLinha, paraCelula } from '../tabelas/serializacao';
import { VERSAO_API } from '../versao';

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
  obterVarios: (ks) => (ks.length ? CacheService.getScriptCache().getAll(ks) : {}),
  guardarVarios(vs, s) {
    try {
      CacheService.getScriptCache().putAll(vs, s);
    } catch {
      // cache recusou: a próxima leitura vai à planilha
    }
  },
};

export const propriedadesGas: Propriedades = {
  obter: (k) => PropertiesService.getScriptProperties().getProperty(k),
  definir: (k, v) => void PropertiesService.getScriptProperties().setProperty(k, v),
};

const ID_PLANILHA: Record<Planilha, string> = { dados: 'DADOS_ID', sigiloso: 'SIGILOSO_ID', relatorios: 'RELATORIOS_ID' };

function idPlanilha(p: Planilha): string {
  const id = propriedadesGas.obter(ID_PLANILHA[p]);
  if (!id) throw new Error(`${ID_PLANILHA[p]} não configurado (rode instalar()).`);
  return id;
}

export function abrirPlanilha(p: Planilha): GoogleAppsScript.Spreadsheet.Spreadsheet {
  return SpreadsheetApp.openById(idPlanilha(p));
}

/**
 * Lê várias abas numa chamada só pelo serviço avançado do Sheets. Se ele não estiver ligado, ou se alguma aba
 * ainda não existe (falta rodar o instalar), lê aba por aba pela planilha aberta.
 */
function lerPlanilhaGas(id: string, abas: NomeTabela[], doc: () => GoogleAppsScript.Spreadsheet.Spreadsheet): Partial<Record<NomeTabela, unknown[][]>> {
  const r: Partial<Record<NomeTabela, unknown[][]>> = {};
  if (typeof Sheets !== 'undefined') {
    try {
      const resp = Sheets.Spreadsheets!.Values!.batchGet(id, {
        ranges: abas.map((t) => `'${t}'`),
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
      (resp.valueRanges ?? []).forEach((v, i) => (r[abas[i]] = (v.values ?? []) as unknown[][]));
      return r;
    } catch (e) {
      console.warn('Leitura em lote falhou; lendo aba por aba.', e);
    }
  }
  for (const t of abas) {
    const folha = doc().getSheetByName(t);
    if (folha) r[t] = folha.getDataRange().getValues();
  }
  return r;
}

/** Repositório sobre as planilhas: lê pelo cache das abas (leitorAbas) e escreve linha a linha. */
export function repositorioGas(relogio: Relogio): Repositorio {
  const abertas = new Map<Planilha, GoogleAppsScript.Spreadsheet.Spreadsheet>();
  const folhas = new Map<NomeTabela, GoogleAppsScript.Spreadsheet.Sheet>();
  let autor = '';

  const planilha = (p: Planilha) => {
    if (!abertas.has(p)) abertas.set(p, abrirPlanilha(p));
    return abertas.get(p)!;
  };
  // o id da planilha já está nas propriedades; abrir com SpreadsheetApp só quando precisar escrever ou ler aba por aba
  const leitor = criarLeitorAbas({
    cache: cacheGas,
    props: propriedadesGas,
    agoraMs: relogio.agoraMs,
    versaoApi: VERSAO_API,
    ler: (p, abas) => lerPlanilhaGas(idPlanilha(p), abas, () => planilha(p)),
  });
  const aba = (t: NomeTabela) => leitor.aba(t);

  /** Aba pronta para gravar: avisa o cache antes da primeira escrita. */
  function paraGravar(t: NomeTabela) {
    const a = aba(t);
    leitor.antesDeEscrever(t);
    if (!folhas.has(t)) {
      const folha = planilha(ESQUEMA[t].planilha).getSheetByName(t);
      if (!folha) throw new Error(`Aba "${t}" não encontrada (rode instalar()).`);
      folhas.set(t, folha);
    }
    return { a, folha: folhas.get(t)! };
  }

  const linhaNaFolha = (folha: GoogleAppsScript.Spreadsheet.Sheet, cab: string[], id: string) => {
    // procura direto na coluna id da folha (as linhas lidas pulam linhas vazias)
    const ids = folha.getRange(2, cab.indexOf('id') + 1, Math.max(1, folha.getLastRow() - 1), 1).getValues();
    const i = ids.findIndex((r) => String(r[0]) === id);
    return i < 0 ? -1 : i + 2;
  };

  return {
    listar: <T extends { id: string }>(t: NomeTabela) => JSON.parse(JSON.stringify(aba(t).linhas)) as T[],
    inserir(t, r) {
      const { a, folha } = paraGravar(t);
      if (a.linhas.some((x) => x.id === r.id)) throw new Error(`Registro repetido em ${t}: ${r.id}`);
      const agora = relogio.agora();
      const obj = { ...r, criadoEm: agora, atualizadoEm: agora, atualizadoPor: autor } as Record<string, unknown>;
      folha.appendRow(objetoParaLinha(t, a.cab, obj).map(paraCelula));
      a.linhas.push(obj);
    },
    atualizar(t, r) {
      const { a, folha } = paraGravar(t);
      const i = a.linhas.findIndex((x) => x.id === r.id);
      const linha = linhaNaFolha(folha, a.cab, r.id);
      if (i < 0 || linha < 0) throw new Error(`Registro inexistente em ${t}: ${r.id}`);
      const obj = { ...r, criadoEm: a.linhas[i].criadoEm, atualizadoEm: relogio.agora(), atualizadoPor: autor } as Record<string, unknown>;
      folha.getRange(linha, 1, 1, a.cab.length).setValues([objetoParaLinha(t, a.cab, obj).map(paraCelula)]);
      a.linhas[i] = obj;
    },
    remover(t, id) {
      const { a, folha } = paraGravar(t);
      const linha = linhaNaFolha(folha, a.cab, id);
      if (linha > 0) folha.deleteRow(linha);
      a.linhas = a.linhas.filter((x) => x.id !== id);
    },
    inserirVarios(t, registros) {
      if (!registros.length) return;
      const { a, folha } = paraGravar(t);
      const ids = new Set(a.linhas.map((x) => x.id));
      const agora = relogio.agora();
      const objs = registros.map((r) => {
        if (ids.has(r.id)) throw new Error(`Registro repetido em ${t}: ${r.id}`);
        ids.add(r.id);
        return { ...r, criadoEm: agora, atualizadoEm: agora, atualizadoPor: autor } as Record<string, unknown>;
      });
      const matriz = objs.map((o) => objetoParaLinha(t, a.cab, o).map(paraCelula));
      folha.getRange(folha.getLastRow() + 1, 1, matriz.length, a.cab.length).setValues(matriz);
      a.linhas.push(...objs);
    },
    substituirTabela(t, registros) {
      const { a, folha } = paraGravar(t);
      const ultima = folha.getLastRow();
      if (ultima > 1) folha.getRange(2, 1, ultima - 1, Math.max(a.cab.length, folha.getLastColumn())).clearContent();
      const objs = registros.map((r) => ({ ...r }) as Record<string, unknown>);
      if (objs.length) folha.getRange(2, 1, objs.length, a.cab.length).setValues(objs.map((o) => objetoParaLinha(t, a.cab, o).map(paraCelula)));
      a.linhas = objs;
    },
    descartarLeituras: () => leitor.descartar(),
    concluirEscrita: () => leitor.concluirEscrita(),
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

/** Gemini pelo nível gratuito do Google AI Studio: chave em GEMINI_API_KEY; GEMINI_MODELO troca o modelo, e o leve é a reserva. */
export const iaGas: IA = {
  gerar(corpo) {
    const chave = propriedadesGas.obter('GEMINI_API_KEY');
    if (!chave) return null;
    return chamarComReserva(propriedadesGas.obter('GEMINI_MODELO'), (modelo) => {
      const r = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-goog-api-key': chave },
        payload: JSON.stringify(corpo),
        muteHttpExceptions: true,
      });
      return { codigo: r.getResponseCode(), corpo: r.getContentText() };
    });
  },
};

/** E-mail pela conta do setor, com o nome do Centro de Convenções como remetente. */
export const emailGas: Email = {
  cotaRestante: () => MailApp.getRemainingDailyQuota(),
  enviar({ para, assunto, texto, html, anexos }) {
    MailApp.sendEmail({
      to: para.join(','),
      subject: assunto,
      body: texto,
      name: 'Centro de Convenções UFSM',
      ...(html ? { htmlBody: html } : {}),
      ...(anexos.length ? { attachments: anexos.map((id) => DriveApp.getFileById(id).getBlob()) } : {}),
    });
  },
};

/** O próprio Google confere a assinatura do comprovante (tokeninfo) e devolve os dados da conta. */
export const identidadeGas: IdentidadeGoogle = {
  verificar(credencial) {
    const r = UrlFetchApp.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credencial)}`, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    const t = JSON.parse(r.getContentText()) as Record<string, unknown>;
    return {
      email: String(t.email ?? ''),
      emailVerificado: String(t.email_verified) === 'true',
      audiencia: String(t.aud ?? ''),
      emissor: String(t.iss ?? ''),
      expiraEm: Number(t.exp ?? 0),
    };
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
    email: emailGas,
    identidade: identidadeGas,
  };
}
