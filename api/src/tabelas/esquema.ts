import type { NomeTabela, Planilha } from '../nucleo/portas';

export type TipoColuna = 'texto' | 'numero' | 'numeroOpcional' | 'booleano' | 'json' | 'dataHora';
type Coluna = { nome: string; tipo: TipoColuna };

const t = (nome: string): Coluna => ({ nome, tipo: 'texto' });
const n = (nome: string): Coluna => ({ nome, tipo: 'numero' });
/** Número que pode faltar (público não informado, diária padrão): célula vazia ↔ null. */
const o = (nome: string): Coluna => ({ nome, tipo: 'numeroOpcional' });
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
  eventos: {
    planilha: 'dados',
    colunas: [t('nome'), t('tipo'), t('organizador'), t('contatoOrganizador'), t('servidorResponsavelId'), o('publicoEstimado'), o('publicoReal'),
      t('pagamento'), t('pagadorExterno'), t('instrumento'), t('status'), t('observacoes')],
  },
  sessoes: {
    planilha: 'dados',
    colunas: [t('eventoId'), t('data'), t('rotulo'), t('chegada'), t('inicio'), t('fim'), b('horarioADefinir'), n('vagasBolsistas'),
      n('vagasServidores'), o('diaria'), n('minimoExperientes'), t('status'), t('publicadaEm'), t('convocacaoAbertaAte'), n('convocacaoVagas'),
      t('googleEventoId'), b('agendaPendente'), t('atividade')],
  },
  rodadas: { planilha: 'dados', colunas: [t('nome'), t('prazo'), t('status')] },
  rodadaSessoes: { planilha: 'dados', colunas: [t('rodadaId'), t('sessaoId'), b('nova')] },
  disponibilidades: { planilha: 'dados', colunas: [t('pessoaId'), t('sessaoId'), b('disponivel'), t('origem'), d('respondidoEm')] },
  escalas: { planilha: 'dados', colunas: [t('sessaoId'), t('pessoaId'), t('papel'), t('status'), b('adicaoDireta'), t('loteId')] },
  avaliacoes: { planilha: 'dados', colunas: [t('pessoaId'), t('mes'), n('nota'), t('observacao'), t('autorId')] },
  lotes: {
    planilha: 'dados',
    colunas: [t('titulo'), t('periodoReferencia'), t('edital'), t('iniciativa'), b('incluirZerados'), t('status'), t('pagoEm')],
  },
  loteItens: { planilha: 'dados', colunas: [t('loteId'), t('escalaId'), t('pessoaId'), n('valor')] },
  envioExterno: { planilha: 'dados', colunas: [t('eventoId'), d('enviadoEm'), t('enviadoPor'), j('campos')] },
  almoxItens: {
    planilha: 'dados',
    colunas: [t('cod'), t('nomeAlmox'), t('nomeComum'), t('unidade'), n('valor'), t('categoria'), n('qtdMinima'), t('sala'), t('status'), n('saldo')],
  },
  almoxMovimentos: {
    planilha: 'dados',
    colunas: [d('quando'), t('tipo'), t('cod'), n('qtd'), n('valorUnitario'), t('retiradoPorPessoaId'), t('retiradoPorExterno'), t('eventoId'),
      t('ocorrenciaId'), t('finalidade'), t('pedidoId'), t('motivo')],
  },
  almoxAutorizadosExternos: { planilha: 'dados', colunas: [t('nome'), b('ativo')] },
  almoxPedidos: { planilha: 'dados', colunas: [t('solicitanteId'), t('status')] },
  almoxPedidoItens: { planilha: 'dados', colunas: [t('pedidoId'), t('cod'), n('qtdPedida'), n('qtdRecebida'), n('valorEstimado')] },
  ocorrencias: {
    planilha: 'dados',
    colunas: [n('numero'), t('titulo'), t('descricao'), t('categoria'), t('local'), t('prioridade'), t('status'), t('origem'), t('relatorNome'),
      t('relatorPessoaId'), t('relatorContato'), t('eventoId'), t('fotoId'), t('chamadoNumero'), t('chamadoLink'), t('chamadoAbertoEm'),
      t('resolvidaEm'), t('respostaFormularioId')],
  },
  ocorrenciasHistorico: { planilha: 'dados', colunas: [t('ocorrenciaId'), d('quando'), t('quemId'), t('de'), t('para'), t('observacao')] },
  contratos: {
    planilha: 'dados',
    colunas: [t('numero'), t('eventoId'), t('contratanteId'), t('processoPen'), n('valorBase'), t('itemTabela'), t('vencimento'), j('areas'), n('cortesiasQtd'),
      t('ingressoSolidario'), t('statusContrato'), t('statusFatura'), t('numeroFatura'), t('statusEcad'), t('statusIss'), t('statusFundep'), t('statusCortesias'),
      b('fichaTecnicaRecebida'), t('canceladoMotivo'), t('observacoes'), t('pdfAssinadoId'), t('pdfFaturaId')],
  },
  aditivos: {
    planilha: 'dados',
    colunas: [t('contratoId'), n('numero'), t('data'), t('descricao'), n('valorDelta'), t('novaData'), t('statusFatura'), t('numeroFatura')],
  },
  contratantes: {
    planilha: 'sigiloso',
    colunas: [t('razaoSocial'), t('documento'), t('inscricaoMunicipal'), t('inscricaoEstadual'), t('endereco'), t('cep'), t('representanteNome'), t('email'),
      t('contatoFaturaNome'), t('contatoFaturaEmail'), t('contatoFaturaTelefone')],
  },
  dadosPessoais: { planilha: 'sigiloso', colunas: [t('cpf'), t('banco'), t('agencia'), t('conta'), t('nascimento'), t('camiseta')] },
  fichas: { planilha: 'dados', colunas: [t('status'), t('trava'), j('dados'), t('enviadaEm'), j('agenda'), t('dadosApagadosEm')] },
  fichasSigilo: { planilha: 'sigiloso', colunas: [t('token'), t('documento'), t('email'), t('telefone')] },
  cortesiasDestinos: { planilha: 'dados', colunas: [t('eventoId'), t('nome'), n('quantidade'), b('pedirMatricula'), t('trava'), t('atualizadoPeloDestinoEm'), t('apagadoEm'), n('nomesApagados')] },
  cortesiasSigilo: { planilha: 'sigiloso', colunas: [t('token'), j('pessoas')] },
  pedidos: {
    planilha: 'dados',
    colunas: [t('protocolo'), t('status'), j('dados'), t('recebidoEm'), t('decididoEm'), t('decididoPor'), t('motivoRecusa'), t('eventoId'), t('dadosApagadosEm')],
  },
  pedidosSigilo: { planilha: 'sigiloso', colunas: [j('solicitante'), j('responsavel')] },
  credenciais: {
    planilha: 'sigiloso',
    colunas: [t('hash'), t('sal'), n('iteracoes'), b('senhaInicial'), n('versaoToken'), n('falhas'), t('bloqueadoAte')],
  },
};

const CARIMBOS: Coluna[] = [d('criadoEm'), d('atualizadoEm'), t('atualizadoPor')];

export function colunas(tabela: NomeTabela): Coluna[] {
  return [t('id'), ...ESQUEMA[tabela].colunas, ...CARIMBOS];
}

export function cabecalhos(tabela: NomeTabela): string[] {
  return colunas(tabela).map((c) => c.nome);
}
