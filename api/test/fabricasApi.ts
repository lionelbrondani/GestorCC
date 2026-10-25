// Linhas de planilha prontas para os testes (dados fictícios).
import type { LinhaEvento, LinhaSessao } from '../src/acoes/eventos';
import type { LinhaEscala } from '../src/escalas/comum';

export function linhaSessao(p: Partial<LinhaSessao> & Pick<LinhaSessao, 'id' | 'eventoId' | 'data'>): LinhaSessao {
  return {
    rotulo: '', chegada: '07:30', inicio: '08:00', fim: '12:00', horarioADefinir: false, vagasBolsistas: 8, vagasServidores: 1, diaria: null,
    minimoExperientes: 1, status: 'ativa', publicadaEm: '', convocacaoAbertaAte: '', convocacaoVagas: 0, googleEventoId: '', agendaPendente: false, ...p,
  };
}
export function linhaEvento(id: string, nome = 'Formatura Teste'): LinhaEvento {
  return {
    id, nome, tipo: 'Formatura', organizador: 'Comissão', contatoOrganizador: '', servidorResponsavelId: '', publicoEstimado: null, publicoReal: null,
    pagamento: 'interno', pagadorExterno: '', instrumento: 'contrato', status: 'ativo', observacoes: '',
  };
}
export const linhaEscala = (p: Partial<LinhaEscala> & Pick<LinhaEscala, 'id' | 'sessaoId' | 'pessoaId'>): LinhaEscala => ({
  papel: 'bolsista', status: 'publicado', adicaoDireta: false, loteId: '', ...p,
});
