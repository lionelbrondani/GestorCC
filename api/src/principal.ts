/// <reference types="google-apps-script" />
// Ponto de entrada do Apps Script. As funções exportadas viram globais pelo rodapé do build.
import { handlersAuth } from './acoes/auth';
import { handlersAvisos } from './acoes/avisos';
import { handlersPessoas } from './acoes/pessoas';
import { handlersEventos } from './acoes/eventos';
import { handlersSistema } from './acoes/sistema';
import { portasGas } from './adaptadores/gas';
import { tratarRequisicao, type Handlers } from './nucleo/roteador';
import { VERSAO_API } from './versao';

export { backupDiario } from './backup';
export { instalar, recuperarAcessoGestor } from './instalar';
export { VERSAO_API };

const HANDLERS: Handlers = { ...handlersAuth, ...handlersPessoas, ...handlersAvisos, ...handlersSistema, ...handlersEventos };

function json(corpo: string): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(corpo).setMimeType(ContentService.MimeType.JSON);
}

export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return json(tratarRequisicao(e?.postData?.contents ?? '', portasGas(), HANDLERS));
}

export function doGet(): GoogleAppsScript.Content.TextOutput {
  return json(JSON.stringify({ ok: true, dados: { versao: VERSAO_API } }));
}

export function gatilhoMinutos(): void {
  // Reservado: importação do formulário de problemas, sincronização da agenda e relatórios chegam nas próximas fases.
}
