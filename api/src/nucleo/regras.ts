import type { Acao, Modulo } from '@shared';

export type Regra = 'publica' | 'logado' | [Modulo, 'ver' | 'editar'];

/** Ações disponíveis até a fase atual e como cada uma é protegida. As demais respondem NAO_DISPONIVEL. */
export const ACOES_FASE: Partial<Record<Acao, { regra: Regra; escrita: boolean }>> = {
  'sistema.ping': { regra: 'publica', escrita: false },
  'auth.entrar': { regra: 'publica', escrita: true },
  'auth.trocarSenha': { regra: 'logado', escrita: true },
  'perfil.salvarAgenda': { regra: 'logado', escrita: true },
  'pessoas.listar': { regra: 'logado', escrita: false },
  'pessoas.salvar': { regra: ['pessoas', 'editar'], escrita: true },
  'pessoas.redefinirSenha': { regra: ['pessoas', 'editar'], escrita: true },
  'pessoas.importar': { regra: ['pessoas', 'editar'], escrita: true },
  'dadosPessoais.obter': { regra: 'logado', escrita: false },
  'dadosPessoais.salvar': { regra: 'logado', escrita: true },
  'avisos.listar': { regra: 'logado', escrita: false },
  'avisos.salvar': { regra: ['mural', 'editar'], escrita: true },
  'avisos.confirmarLeitura': { regra: 'logado', escrita: true },
  'notificacoes.listar': { regra: 'logado', escrita: false },
  'notificacoes.marcarLidas': { regra: 'logado', escrita: true },
  'historico.listar': { regra: 'logado', escrita: false },
  'config.obter': { regra: 'logado', escrita: false },
  'config.salvar': { regra: ['configuracoes', 'editar'], escrita: true },
  'feriados.listar': { regra: 'logado', escrita: false },
  'feriados.salvar': { regra: ['configuracoes', 'editar'], escrita: true },
  // fase 2: bolsistas também listam (vão precisar das sessões na fase 3)
  'eventos.listar': { regra: 'logado', escrita: false },
  'eventos.salvar': { regra: ['eventos', 'editar'], escrita: true },
  'eventos.cancelar': { regra: ['eventos', 'editar'], escrita: true },
  'sessoes.cancelar': { regra: ['eventos', 'editar'], escrita: true },
  // fase 3
  'rodadas.listar': { regra: 'logado', escrita: false },
  'rodadas.salvar': { regra: ['escalas', 'editar'], escrita: true },
  'disponibilidades.listar': { regra: 'logado', escrita: false },
  'disponibilidades.marcar': { regra: 'logado', escrita: true },
  'escalas.listar': { regra: 'logado', escrita: false },
  'escalas.salvarRascunho': { regra: ['escalas', 'editar'], escrita: true },
  'escalas.publicar': { regra: ['escalas', 'editar'], escrita: true },
  'escalas.trocar': { regra: ['escalas', 'editar'], escrita: true },
  'escalas.convocar': { regra: ['escalas', 'editar'], escrita: true },
  'escalas.confirmarPresenca': { regra: ['escalas', 'editar'], escrita: true },
  'avaliacoes.listar': { regra: ['escalas', 'ver'], escrita: false },
  'avaliacoes.salvar': { regra: ['escalas', 'editar'], escrita: true },
  // fase 4
  'lotes.listar': { regra: ['pagamentos', 'ver'], escrita: false },
  'lotes.criar': { regra: ['pagamentos', 'editar'], escrita: true },
  'lotes.retirarItem': { regra: ['pagamentos', 'editar'], escrita: true },
  'lotes.marcarPago': { regra: ['pagamentos', 'editar'], escrita: true },
  'lotes.cancelar': { regra: ['pagamentos', 'editar'], escrita: true },
  'ganhos.meus': { regra: 'logado', escrita: false },
  'externos.registrarEnvio': { regra: ['pagamentos', 'editar'], escrita: true },
};
