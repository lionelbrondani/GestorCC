import { formatarDataHora } from './datas';

/** O que a API conta sobre ela mesma (Configurações → Saúde do sistema). Horários em 'AAAA-MM-DDTHH:MM'. */
export interface SaudeSistema {
  versao: string;
  agora: string;
  /** Fim do último backup diário; null antes do primeiro depois desta versão. */
  ultimoBackup: string | null;
  /** Fim da última rodada da rotina de 5 minutos. */
  ultimaRotina: string | null;
  agendaLigada: boolean;
  /** Sessões que a agenda Google ainda não aceitou (a rotina de 5 minutos tenta de novo). */
  agendaPendentes: number;
  /** null quando o Apps Script não tem a permissão de e-mail. */
  emailsRestantes: number | null;
  /** Os últimos erros internos, do mais novo para o mais antigo. */
  erros: { quando: string; acao: string; mensagem: string }[];
  tabelas: { tabela: string; linhas: number }[];
}

export type SituacaoSaude = 'ok' | 'atencao' | 'problema';

export interface ItemSaude {
  chave: 'backup' | 'rotina' | 'agenda' | 'email' | 'erros';
  titulo: string;
  situacao: SituacaoSaude;
  texto: string;
}

const minutos = (de: string, ate: string) => (Date.parse(`${ate}:00Z`) - Date.parse(`${de}:00Z`)) / 60_000;

/** Um item por parte que costuma dar problema, com o que fazer quando não está ok. */
export function avaliarSaude(s: SaudeSistema): ItemSaude[] {
  const backup: ItemSaude = !s.ultimoBackup
    ? { chave: 'backup', titulo: 'Backup diário', situacao: 'atencao', texto: 'Ainda sem registro: o backup roda todo dia às 3h.' }
    : minutos(s.ultimoBackup, s.agora) > 36 * 60
      ? { chave: 'backup', titulo: 'Backup diário', situacao: 'problema', texto: `O último backup foi em ${formatarDataHora(s.ultimoBackup)}. Confira os gatilhos (rode o instalar) e as Execuções no Apps Script.` }
      : { chave: 'backup', titulo: 'Backup diário', situacao: 'ok', texto: `Último backup em ${formatarDataHora(s.ultimoBackup)}.` };

  const rotina: ItemSaude = !s.ultimaRotina
    ? { chave: 'rotina', titulo: 'Rotina de 5 minutos', situacao: 'atencao', texto: 'Ainda sem registro: ela roda a cada 5 minutos.' }
    : minutos(s.ultimaRotina, s.agora) > 30
      ? { chave: 'rotina', titulo: 'Rotina de 5 minutos', situacao: 'problema', texto: `Não roda desde ${formatarDataHora(s.ultimaRotina)}. Rode o instalar para refazer os gatilhos.` }
      : { chave: 'rotina', titulo: 'Rotina de 5 minutos', situacao: 'ok', texto: `Rodou em ${formatarDataHora(s.ultimaRotina)}.` };

  const agenda: ItemSaude = !s.agendaLigada
    ? { chave: 'agenda', titulo: 'Agenda Google', situacao: 'atencao', texto: 'A agenda do setor não está ligada: rode o instalar.' }
    : s.agendaPendentes > 0
      ? { chave: 'agenda', titulo: 'Agenda Google', situacao: 'atencao', texto: `${s.agendaPendentes} ${s.agendaPendentes === 1 ? 'sessão espera' : 'sessões esperam'} a agenda Google aceitar; a rotina de 5 minutos tenta de novo.` }
      : { chave: 'agenda', titulo: 'Agenda Google', situacao: 'ok', texto: 'Tudo o que foi agendado está na agenda Google.' };

  const email: ItemSaude =
    s.emailsRestantes === null
      ? { chave: 'email', titulo: 'E-mails', situacao: 'atencao', texto: 'Sem a permissão de enviar e-mail: rode o instalar e aceite.' }
      : s.emailsRestantes < 10
        ? { chave: 'email', titulo: 'E-mails', situacao: 'atencao', texto: `Restam ${s.emailsRestantes} e-mails hoje (limite diário do Google).` }
        : { chave: 'email', titulo: 'E-mails', situacao: 'ok', texto: `Hoje ainda dá para mandar ${s.emailsRestantes} e-mails.` };

  const recentes = s.erros.filter((e) => minutos(e.quando, s.agora) <= 24 * 60).length;
  const erros: ItemSaude = recentes
    ? { chave: 'erros', titulo: 'Erros', situacao: 'atencao', texto: `${recentes} ${recentes === 1 ? 'erro' : 'erros'} nas últimas 24 horas: veja a lista abaixo.` }
    : { chave: 'erros', titulo: 'Erros', situacao: 'ok', texto: 'Nenhum erro nas últimas 24 horas.' };

  return [backup, rotina, agenda, email, erros];
}
