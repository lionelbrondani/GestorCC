/// <reference types="google-apps-script" />
// Ponto de entrada do Apps Script. As funções exportadas viram globais pelo rodapé do build.
import { ErroApi } from '@shared';
import { handlersAuth } from './acoes/auth';
import { handlersAvaliacoes } from './acoes/avaliacoes';
import { handlersAvisos } from './acoes/avisos';
import { handlersPessoas } from './acoes/pessoas';
import { handlersEscalas } from './acoes/escalas';
import { handlersEventos } from './acoes/eventos';
import { handlersRodadas } from './acoes/rodadas';
import { handlersSistema } from './acoes/sistema';
import { portasGas, travaGas } from './adaptadores/gas';
import { sincronizarPendentes } from './agenda/sincronizar';
import { tratarRequisicao, type Handlers } from './nucleo/roteador';
import { gerarRelatoriosPendentes } from './relatorios/agenda';
import { VERSAO_API } from './versao';

export { backupDiario } from './backup';
export { instalar, recuperarAcessoGestor } from './instalar';
export { VERSAO_API };

const HANDLERS: Handlers = { ...handlersAuth, ...handlersPessoas, ...handlersAvisos, ...handlersSistema, ...handlersEventos, ...handlersRodadas, ...handlersEscalas, ...handlersAvaliacoes };

function json(corpo: string): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(corpo).setMimeType(ContentService.MimeType.JSON);
}

export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return json(tratarRequisicao(e?.postData?.contents ?? '', portasGas(), HANDLERS));
}

export function doGet(): GoogleAppsScript.Content.TextOutput {
  return json(JSON.stringify({ ok: true, dados: { versao: VERSAO_API } }));
}

/**
 * A cada 5 minutos: refaz o que o Google Agenda não aceitou na hora e reescreve as abas AGENDA marcadas.
 * Com o sistema ocupado, pula esta rodada.
 */
export function gatilhoMinutos(): void {
  try {
    travaGas.executar(() => {
      const portas = portasGas();
      sincronizarPendentes(portas);
      gerarRelatoriosPendentes(portas);
    }, 10_000);
  } catch (e) {
    if (!(e instanceof ErroApi && e.codigo === 'SISTEMA_OCUPADO')) throw e;
  }
}
