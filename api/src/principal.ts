/// <reference types="google-apps-script" />
// Ponto de entrada do Apps Script. As funções exportadas viram globais pelo rodapé do build.

import { VERSAO_API } from './versao';
export { VERSAO_API };

function json(corpo: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(corpo)).setMimeType(ContentService.MimeType.JSON);
}

export function doPost(_e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return json({ ok: true, dados: { versao: VERSAO_API } });
}

export function doGet(): GoogleAppsScript.Content.TextOutput {
  return json({ ok: true, dados: { versao: VERSAO_API } });
}

export function instalar(): void {
  throw new Error('instalar() chega na Task 8.');
}

export function backupDiario(): void {
  // implementado na Task 8
}

export function gatilhoMinutos(): void {
  // reservado para as próximas fases
}
