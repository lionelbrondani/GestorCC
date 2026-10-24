import type { NomeTabela, Planilha } from '../nucleo/portas';

export type TipoColuna = 'texto' | 'numero' | 'booleano' | 'json' | 'dataHora';
type Coluna = { nome: string; tipo: TipoColuna };

const t = (nome: string): Coluna => ({ nome, tipo: 'texto' });
const n = (nome: string): Coluna => ({ nome, tipo: 'numero' });
const b = (nome: string): Coluna => ({ nome, tipo: 'booleano' });
const j = (nome: string): Coluna => ({ nome, tipo: 'json' });
const d = (nome: string): Coluna => ({ nome, tipo: 'dataHora' });

/** Colunas de cada tabela (além de id, criadoEm, atualizadoEm, atualizadoPor). Spec 4. */
export const ESQUEMA: Record<NomeTabela, { planilha: Planilha; colunas: Coluna[] }> = {
  pessoas: {
    planilha: 'dados',
    colunas: [t('nome'), t('nomeCurto'), t('emailAcademico'), t('emailAlternativo'), t('matricula'), t('siape'), t('tipo'), t('vinculo'),
      b('experiente'), b('escalarMenos'), b('ativo'), t('convitesAgenda')],
  },
  permissoes: { planilha: 'dados', colunas: [t('pessoaId'), t('modulo'), t('nivel')] },
  avisos: {
    planilha: 'dados',
    colunas: [t('titulo'), t('texto'), t('publico'), j('pessoasIds'), b('fixado'), t('validoAte'), b('pedeConfirmacao'), t('autorId')],
  },
  avisosLeituras: { planilha: 'dados', colunas: [t('avisoId'), t('pessoaId'), d('lidoEm')] },
  notificacoes: { planilha: 'dados', colunas: [t('pessoaId'), t('texto'), t('link'), b('lida')] },
  historico: {
    planilha: 'dados',
    colunas: [d('quando'), t('quemId'), t('entidade'), t('entidadeId'), t('acao'), j('antes'), j('depois'), t('justificativa')],
  },
  config: { planilha: 'dados', colunas: [j('valor')] },
  feriados: { planilha: 'dados', colunas: [t('data'), t('nome')] },
  dadosPessoais: { planilha: 'sigiloso', colunas: [t('cpf'), t('banco'), t('agencia'), t('conta'), t('nascimento'), t('camiseta')] },
  credenciais: {
    planilha: 'sigiloso',
    colunas: [t('hash'), t('sal'), n('iteracoes'), b('senhaInicial'), n('versaoToken'), n('falhas'), t('bloqueadoAte'), t('resetToken'), t('resetExpira')],
  },
};

const CARIMBOS: Coluna[] = [d('criadoEm'), d('atualizadoEm'), t('atualizadoPor')];

export function colunas(tabela: NomeTabela): Coluna[] {
  return [t('id'), ...ESQUEMA[tabela].colunas, ...CARIMBOS];
}

export function cabecalhos(tabela: NomeTabela): string[] {
  return colunas(tabela).map((c) => c.nome);
}
