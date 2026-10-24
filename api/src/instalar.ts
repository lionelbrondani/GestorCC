/// <reference types="google-apps-script" />
import { MODELOS, MODULOS } from '@shared';
import { criarCredencialInicial } from './acoes/auth';
import { abrirPlanilha, portasGas, propriedadesGas } from './adaptadores/gas';
import { paraBase64Url } from './auth/bytes';
import type { NomeTabela, Planilha } from './nucleo/portas';
import { cabecalhos, ESQUEMA } from './tabelas/esquema';

type NomeAba = NomeTabela | 'IMPORTAR_PESSOAS' | 'LEIA-ME';

export const CABECALHOS_IMPORTACAO = ['NOME', 'EMAIL', 'MATRICULA', 'TIPO', 'VINCULO', 'CPF', 'BANCO', 'AGENCIA', 'CONTA', 'CAMISETA', 'NASCIMENTO'];

const ARQUIVOS: Record<Planilha, string> = { dados: 'GestorCC - Dados', sigiloso: 'GestorCC - Sigiloso', relatorios: 'GestorCC - Relatórios' };
const PROPRIEDADE: Record<Planilha, string> = { dados: 'DADOS_ID', sigiloso: 'SIGILOSO_ID', relatorios: 'RELATORIOS_ID' };

export function planoInstalacao(): { planilha: Planilha; nomeArquivo: string; abas: { nome: NomeAba; cabecalhos: string[] }[] }[] {
  const tabelasDe = (p: Planilha) =>
    (Object.keys(ESQUEMA) as NomeTabela[]).filter((t) => ESQUEMA[t].planilha === p).map((t) => ({ nome: t as NomeAba, cabecalhos: cabecalhos(t) }));
  return [
    { planilha: 'dados', nomeArquivo: ARQUIVOS.dados, abas: tabelasDe('dados') },
    { planilha: 'sigiloso', nomeArquivo: ARQUIVOS.sigiloso, abas: [...tabelasDe('sigiloso'), { nome: 'IMPORTAR_PESSOAS', cabecalhos: CABECALHOS_IMPORTACAO }] },
    {
      planilha: 'relatorios',
      nomeArquivo: ARQUIVOS.relatorios,
      abas: [{ nome: 'LEIA-ME', cabecalhos: ['Planilha de visualização do GestorCC. As abas de escala, pagamentos e demais relatórios aparecem nas próximas fases.'] }],
    },
  ];
}

function exigir(chave: string): string {
  const v = propriedadesGas.obter(chave);
  if (!v) throw new Error(`Preencha a propriedade do script "${chave}" antes de rodar instalar().`);
  return v.trim();
}

function pastaDoSistema(): GoogleAppsScript.Drive.Folder {
  const id = propriedadesGas.obter('PASTA_ID');
  if (id) return DriveApp.getFolderById(id);
  const pasta = DriveApp.createFolder('GestorCC');
  propriedadesGas.definir('PASTA_ID', pasta.getId());
  return pasta;
}

function garantirGatilho(funcao: string, criar: () => void) {
  if (!ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === funcao)) criar();
}

/** Prepara tudo uma vez. Pode ser rodada de novo sem duplicar nada. */
export function instalar(): void {
  const email = exigir('EMAIL_PRIMEIRO_GESTOR').toLowerCase();
  const nome = exigir('NOME_PRIMEIRO_GESTOR');
  const matricula = exigir('MATRICULA_PRIMEIRO_GESTOR');
  exigir('URL_APP');
  const pasta = pastaDoSistema();

  for (const item of planoInstalacao()) {
    let arquivoId = propriedadesGas.obter(PROPRIEDADE[item.planilha]);
    if (!arquivoId) {
      const nova = SpreadsheetApp.create(item.nomeArquivo);
      DriveApp.getFileById(nova.getId()).moveTo(pasta);
      arquivoId = nova.getId();
      propriedadesGas.definir(PROPRIEDADE[item.planilha], arquivoId);
    }
    const planilha = abrirPlanilha(item.planilha);
    for (const aba of item.abas) {
      let folha = planilha.getSheetByName(aba.nome);
      if (!folha) folha = planilha.insertSheet(aba.nome);
      if (folha.getLastRow() === 0) {
        folha.getRange(1, 1, 1, aba.cabecalhos.length).setValues([aba.cabecalhos]).setFontWeight('bold').setBackground('#232323').setFontColor('#F5C518');
        folha.setFrozenRows(1);
      }
    }
    for (const sobra of planilha.getSheets()) {
      if (!item.abas.some((a) => a.nome === sobra.getName()) && sobra.getLastRow() === 0 && planilha.getSheets().length > 1) planilha.deleteSheet(sobra);
    }
  }

  const portas = portasGas();
  if (!propriedadesGas.obter('SEGREDO_TOKEN')) propriedadesGas.definir('SEGREDO_TOKEN', paraBase64Url(portas.cripto.aleatorio(32)));

  garantirGatilho('backupDiario', () => ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(3).create());
  garantirGatilho('gatilhoMinutos', () => ScriptApp.newTrigger('gatilhoMinutos').timeBased().everyMinutes(5).create());

  if (!portas.repo.listar('pessoas').length) {
    const id = 'p-gestor-inicial';
    portas.repo.definirAutor(id);
    portas.repo.inserir('pessoas', {
      id, nome, nomeCurto: nome.split(' ')[0].toUpperCase(), emailAcademico: email, emailAlternativo: '', matricula, siape: '',
      tipo: 'servidor', vinculo: 'fixo', experiente: false, escalarMenos: false, ativo: true, convitesAgenda: '',
    });
    for (const m of MODULOS) portas.repo.inserir('permissoes', { id: `${id}:${m.id}`, pessoaId: id, modulo: m.id, nivel: MODELOS.gestor[m.id] });
    portas.repo.inserir('credenciais', criarCredencialInicial(portas.cripto, id, matricula));
  }
  console.log(`GestorCC instalado na pasta "${pasta.getName()}" (${pasta.getUrl()}).`);
}
