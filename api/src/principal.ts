/// <reference types="google-apps-script" />
// Ponto de entrada do Apps Script. As funções exportadas viram globais pelo rodapé do build.
import { ErroApi } from '@shared';
import { handlersAlmox } from './acoes/almox';
import { handlersAuth } from './acoes/auth';
import { handlersAvaliacoes } from './acoes/avaliacoes';
import { handlersAvisos } from './acoes/avisos';
import { handlersBusca } from './acoes/busca';
import { handlersContratos } from './acoes/contratos';
import { handlersPessoas } from './acoes/pessoas';
import { handlersEscalas } from './acoes/escalas';
import { handlersEventos } from './acoes/eventos';
import { handlersCortesias } from './acoes/cortesias';
import { handlersEmails } from './acoes/emails';
import { handlersFichas } from './acoes/fichas';
import { handlersInfra, importarRespostas } from './acoes/infra';
import { handlersPagamentos } from './acoes/pagamentos';
import { handlersPedidos } from './acoes/pedidos';
import { handlersAchados } from './acoes/achados';
import { handlersRodadas } from './acoes/rodadas';
import { handlersSistema } from './acoes/sistema';
import { portasGas, propriedadesGas, relogioGas, travaGas } from './adaptadores/gas';
import { sincronizarPendentes } from './agenda/sincronizar';
import { criarDadosFicticios as criarFicticios, resetarDados as resetar } from './dadosTeste';
import { registrarErro } from './nucleo/erros';
import { tratarRequisicao, type Handlers } from './nucleo/roteador';
import { gerarRelatoriosPendentes } from './relatorios/pendentes';
import { garantirEpocaCache, novaEpocaCache } from './tabelas/leitorAbas';
import { VERSAO_API } from './versao';

export { backupDiario } from './backup';
export { instalar, recuperarAcessoGestor } from './instalar';
export { VERSAO_API };

const HANDLERS: Handlers = { ...handlersAuth, ...handlersPessoas, ...handlersAvisos, ...handlersSistema, ...handlersEventos, ...handlersRodadas, ...handlersEscalas, ...handlersAvaliacoes, ...handlersPagamentos, ...handlersAlmox, ...handlersInfra, ...handlersContratos, ...handlersBusca, ...handlersFichas, ...handlersCortesias, ...handlersEmails, ...handlersPedidos, ...handlersAchados };

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
 * A cada 5 minutos: refaz o que o Google Agenda não aceitou na hora, importa as respostas novas do formulário de
 * problemas e reescreve as abas marcadas da planilha de Relatórios.
 * Com o sistema ocupado, pula esta rodada.
 */
export function gatilhoMinutos(): void {
  try {
    travaGas.executar(() => {
      garantirEpocaCache(propriedadesGas, relogioGas.agoraMs);
      const portas = portasGas();
      try {
        sincronizarPendentes(portas);
        try {
          importarRespostas({ portas, eu: null, idRequisicao: '' }); // formulário de problemas, se configurado
        } catch (e) {
          console.error(e); // planilha do formulário inacessível não pode parar o resto da rotina
        }
        gerarRelatoriosPendentes(portas);
        portas.props.definir('ULTIMA_ROTINA', relogioGas.agora()); // aparece na Saúde do sistema
      } finally {
        portas.repo.concluirEscrita();
      }
    }, 10_000);
  } catch (e) {
    if (e instanceof ErroApi && e.codigo === 'SISTEMA_OCUPADO') return;
    registrarErro({ props: propriedadesGas, relogio: relogioGas }, 'rotina de 5 minutos', e);
    throw e;
  }
}

/** Gatilho de alteração das planilhas Dados e Sigiloso (criado pelo instalar): edição feita à mão invalida o cache das abas. */
export function aoAlterarPlanilha(): void {
  const invalidar = () => novaEpocaCache(propriedadesGas, relogioGas.agoraMs);
  try {
    travaGas.executar(invalidar, 30_000);
  } catch {
    invalidar(); // sistema ocupado por muito tempo: invalida mesmo assim
  }
}

/** Rodar pelo editor: apaga os dados de teste e mantém só o primeiro gestor, os itens do almoxarifado, as configurações e os feriados. */
export function resetarDados(): void {
  const email = (propriedadesGas.obter('EMAIL_PRIMEIRO_GESTOR') ?? '').trim().toLowerCase();
  travaGas.executar(() => {
    const portas = portasGas();
    const eu = portas.repo.listar<{ id: string; emailAcademico: string }>('pessoas').find((p) => p.emailAcademico.toLowerCase() === email);
    if (!eu) throw new Error('Não achei a pessoa com o EMAIL_PRIMEIRO_GESTOR das propriedades; nada foi apagado.');
    try {
      console.log('Apagado:', JSON.stringify(resetar(portas, eu.id)));
    } finally {
      portas.repo.concluirEscrita();
    }
  }, 30_000);
  novaEpocaCache(propriedadesGas, relogioGas.agoraMs);
  console.log('Pronto. Só você, os itens do almoxarifado, as configurações e os feriados ficaram.');
}

/** Rodar pelo editor: cria os dados fictícios (pessoas @teste.invalid, eventos "TESTE · …"). Para tirar, rode resetarDados. */
export function criarDadosFicticios(): void {
  travaGas.executar(() => {
    const portas = portasGas();
    try {
      console.log('Criado:', JSON.stringify(criarFicticios(portas)));
    } finally {
      portas.repo.concluirEscrita();
    }
  }, 30_000);
  novaEpocaCache(propriedadesGas, relogioGas.agoraMs);
  console.log('Pronto. As pessoas fictícias entram com o e-mail (…@teste.invalid) e a matrícula (2099000001 a 2099000015) como senha.');
}
