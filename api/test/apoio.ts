// Ambiente de teste da API: portas em memória, uma pessoa gestora e uma bolsista fictícias.
import { MODELOS, MODULOS, type Acao, type Entrada, type Pessoa } from '@shared';
import { agendaMemoria, arquivosMemoria, cacheMemoria, documentosMemoria, emailMemoria, formularioMemoria, iaMemoria, criarRepositorioMemoria, propriedadesMemoria, relogioFixo, travaMemoria } from '../src/adaptadores/memoria';
import { criptoNode } from '../src/adaptadores/node';
import { criarHash } from '../src/auth/senhas';
import { emitirToken } from '../src/auth/tokens';
import type { AgendaGoogle, Arquivos, Documentos, Email, Formulario, IA, Portas, Trava } from '../src/nucleo/portas';
import { tratarRequisicao, type Handlers } from '../src/nucleo/roteador';

export const SEGREDO = 'segredo-dos-testes';

type PessoaBase = Omit<Pessoa, 'permissoes' | 'atualizadoEm'>;

export const GESTOR: PessoaBase = {
  id: 'p01', nome: 'Gestora Teste', nomeCurto: 'GESTORA', emailAcademico: 'gestor@ufsm.br', matricula: '1000000001',
  tipo: 'servidor', vinculo: 'fixo', experiente: false, escalarMenos: false, ativo: true,
};
export const BOLSISTA: PessoaBase = {
  id: 'p02', nome: 'Bolsista Teste', nomeCurto: 'BOLSISTA', emailAcademico: 'bolsista@acad.ufsm.br', matricula: '2026000001',
  tipo: 'bolsista', vinculo: 'eventual', experiente: false, escalarMenos: false, ativo: true,
};

function linhasPermissoes(pessoaId: string, modelo: keyof typeof MODELOS) {
  return MODULOS.map((m) => ({ id: `${pessoaId}:${m.id}`, pessoaId, modulo: m.id, nivel: MODELOS[modelo][m.id] }));
}

function credencial(pessoaId: string, senha: string) {
  return { id: pessoaId, ...criarHash(criptoNode, senha, 10), senhaInicial: true, versaoToken: 1, falhas: 0, bloqueadoAte: '' };
}

export function criarAmbiente(opcoes: { trava?: Trava; handlers?: Handlers; agenda?: AgendaGoogle; arquivos?: Arquivos; formulario?: Formulario; documentos?: Documentos; ia?: IA; email?: Email } = {}) {
  const relogio = relogioFixo('2026-10-24T10:00');
  const repo = criarRepositorioMemoria(
    {
      pessoas: [GESTOR, BOLSISTA] as never,
      permissoes: [...linhasPermissoes('p01', 'gestor'), ...linhasPermissoes('p02', 'eventual')] as never,
      credenciais: [credencial('p01', GESTOR.matricula), credencial('p02', BOLSISTA.matricula)] as never,
    },
    relogio,
  );
  const portas: Portas = {
    repo, cripto: criptoNode, trava: opcoes.trava ?? travaMemoria(), cache: cacheMemoria(), relogio,
    props: propriedadesMemoria({ SEGREDO_TOKEN: SEGREDO }),
    agenda: opcoes.agenda ?? agendaMemoria(),
    arquivos: opcoes.arquivos ?? arquivosMemoria(),
    formulario: opcoes.formulario ?? formularioMemoria(),
    documentos: opcoes.documentos ?? documentosMemoria(),
    ia: opcoes.ia ?? iaMemoria(),
    email: opcoes.email ?? emailMemoria(),
  };
  let handlers: Handlers = opcoes.handlers ?? {};
  let seq = 0;

  const token = (pessoaId: string, versao = 1) => emitirToken(criptoNode, SEGREDO, pessoaId, versao, relogio.agoraMs());

  function chamar<A extends Acao>(acao: A, dados: Entrada<A>, opcoesChamada: { token?: string; idRequisicao?: string } = {}) {
    const corpo = JSON.stringify({ acao, dados, token: opcoesChamada.token, idRequisicao: opcoesChamada.idRequisicao ?? `r${++seq}` });
    return JSON.parse(tratarRequisicao(corpo, portas, handlers)) as
      | { ok: true; dados: unknown }
      | { ok: false; erro: { codigo: string; mensagem: string } };
  }

  return {
    portas, repo, relogio, token, chamar,
    handlers: () => handlers,
    usar(h: Handlers) {
      handlers = { ...handlers, ...h };
    },
  };
}
