/// <reference types="google-apps-script" />
import { diferencaDias } from '@shared';
import { portasGas, propriedadesGas, relogioGas, travaGas } from './adaptadores/gas';
import { limparDadosPessoais } from './lgpd';
import { registrarErro } from './nucleo/erros';
import { garantirEpocaCache } from './tabelas/leitorAbas';

export const DIAS_DE_BACKUP = 30;

/** Pastas 'AAAA-MM-DD' mais antigas que `dias`; outros nomes são ignorados. */
export function pastasParaApagar(pastas: { nome: string }[], hoje: string, dias: number): string[] {
  return pastas.map((p) => p.nome).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n) && diferencaDias(n, hoje) > dias);
}

/** Copia as três planilhas para Backups/AAAA-MM-DD e apaga as cópias com mais de 30 dias. */
export function backupDiario(): void {
  const pastaId = propriedadesGas.obter('PASTA_ID');
  if (!pastaId) return;
  const raiz = DriveApp.getFolderById(pastaId);
  const existentes = raiz.getFoldersByName('Backups');
  const backups = existentes.hasNext() ? existentes.next() : raiz.createFolder('Backups');
  const hoje = relogioGas.hoje();
  const doDia = backups.getFoldersByName(hoje);
  const destino = doDia.hasNext() ? doDia.next() : backups.createFolder(hoje);

  for (const chave of ['DADOS_ID', 'SIGILOSO_ID', 'RELATORIOS_ID']) {
    const id = propriedadesGas.obter(chave);
    if (!id) continue;
    const arquivo = DriveApp.getFileById(id);
    arquivo.makeCopy(`${arquivo.getName()} (${hoje})`, destino);
  }

  const todas: { nome: string; pasta: GoogleAppsScript.Drive.Folder }[] = [];
  const iterador = backups.getFolders();
  while (iterador.hasNext()) {
    const p = iterador.next();
    todas.push({ nome: p.getName(), pasta: p });
  }
  const apagar = new Set(pastasParaApagar(todas, hoje, DIAS_DE_BACKUP));
  for (const p of todas) if (apagar.has(p.nome)) p.pasta.setTrashed(true);
  propriedadesGas.definir('ULTIMO_BACKUP', relogioGas.agora()); // aparece na Saúde do sistema
  limparDepoisDoBackup();
}

/** LGPD: com o backup do dia feito, apaga os dados pessoais que já passaram do prazo; uma falha aqui não desfaz o backup. */
function limparDepoisDoBackup(): void {
  try {
    travaGas.executar(() => {
      garantirEpocaCache(propriedadesGas, relogioGas.agoraMs);
      const portas = portasGas();
      try {
        limparDadosPessoais({ portas, eu: null, idRequisicao: '' });
      } finally {
        portas.repo.concluirEscrita();
      }
    }, 30_000);
  } catch (e) {
    console.error(e);
    registrarErro({ props: propriedadesGas, relogio: relogioGas }, 'limpeza LGPD', e);
  }
}
