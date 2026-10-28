import { ErroApi } from '@shared';
import { conferirSenha, criarHash, ITERACOES_PADRAO } from '../auth/senhas';
import { emitirToken } from '../auth/tokens';
import { montarPessoa, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import type { Cripto, Portas } from '../nucleo/portas';

export interface Credencial {
  id: string;
  hash: string;
  sal: string;
  iteracoes: number;
  senhaInicial: boolean;
  versaoToken: number;
  falhas: number;
  bloqueadoAte: string;
}

const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60_000;
const MIN_SENHA = 8;

export function criarCredencialInicial(cripto: Cripto, pessoaId: string, matricula: string, versaoToken = 1): Credencial {
  return {
    id: pessoaId, ...criarHash(cripto, matricula, ITERACOES_PADRAO), senhaInicial: true, versaoToken,
    falhas: 0, bloqueadoAte: '',
  };
}

const segredo = (p: Portas) => {
  const s = p.props.obter('SEGREDO_TOKEN');
  if (!s) throw new Error('SEGREDO_TOKEN não configurado (rode instalar()).');
  return s;
};

const credencialDe = (p: Portas, pessoaId: string) => p.repo.listar<Credencial>('credenciais').find((c) => c.id === pessoaId);

function exigirSenhaNova(nova: string) {
  if (nova.length < MIN_SENHA) throw new ErroApi('SENHA_CURTA', 'A nova senha deve ter pelo menos 8 caracteres.');
}

function gravarSenha(ctx: Contexto, cred: Credencial, nova: string): Credencial {
  const atualizada: Credencial = {
    ...cred, ...criarHash(ctx.portas.cripto, nova), senhaInicial: false, versaoToken: cred.versaoToken + 1,
    falhas: 0, bloqueadoAte: '',
  };
  ctx.portas.repo.atualizar('credenciais', atualizada);
  return atualizada;
}

/** Senhas valem sem os espaços das pontas, em todo lugar (o celular às vezes acrescenta um). */
const limpa = (s: unknown) => String(s ?? '').trim();

const CREDENCIAIS = () => new ErroApi('CREDENCIAIS', 'E-mail ou senha incorretos.');

/** Recuperação pelo editor do Apps Script (só o dono da conta chega lá): a senha volta a ser a matrícula. */
export function recuperarAcesso(portas: Portas, email: string, matricula: string): string {
  const alvo = email.trim().toLowerCase();
  const pessoa = portas.repo.listar<{ id: string; emailAcademico: string; ativo: boolean }>('pessoas').find(
    (p) => p.ativo && p.emailAcademico.trim().toLowerCase() === alvo,
  );
  if (!pessoa) throw new Error(`Ninguém ativo com o e-mail ${alvo}.`);
  const cred = credencialDe(portas, pessoa.id);
  const nova = criarCredencialInicial(portas.cripto, pessoa.id, limpa(matricula), (cred?.versaoToken ?? 0) + 1);
  if (cred) portas.repo.atualizar('credenciais', nova);
  else portas.repo.inserir('credenciais', nova);
  registrar({ portas, eu: null, idRequisicao: '' }, 'pessoa', pessoa.id, 'senha voltou para a matrícula (recuperação de acesso pelo editor)', null, null);
  return pessoa.id;
}

const EMISSORES_GOOGLE = ['accounts.google.com', 'https://accounts.google.com'];

export const handlersAuth: Handlers = {
  'auth.entrar': ({ email, senha }, ctx) => {
    const { repo, relogio, cripto } = ctx.portas;
    const alvo = String(email ?? '').trim().toLowerCase();
    const linha = repo.listar<{ id: string; emailAcademico: string; ativo: boolean }>('pessoas').find(
      (p) => p.ativo && p.emailAcademico.trim().toLowerCase() === alvo,
    );
    const cred = linha && credencialDe(ctx.portas, linha.id);
    if (!linha || !cred) throw CREDENCIAIS();

    const agora = relogio.agora();
    if (cred.bloqueadoAte && cred.bloqueadoAte > agora) {
      throw new ErroApi('BLOQUEADO', `Muitas tentativas. Tente de novo às ${cred.bloqueadoAte.slice(11, 16)}.`);
    }
    if (!conferirSenha(cripto, limpa(senha), cred)) {
      const falhas = cred.falhas + 1;
      const bloqueia = falhas >= MAX_FALHAS;
      repo.atualizar('credenciais', { ...cred, falhas: bloqueia ? 0 : falhas, bloqueadoAte: bloqueia ? relogio.formatar(relogio.agoraMs() + BLOQUEIO_MS) : '' });
      if (bloqueia) registrar({ ...ctx, eu: null }, 'pessoa', linha.id, 'login bloqueado por 15 min após 5 tentativas', null, null);
      throw CREDENCIAIS();
    }
    if (cred.falhas || cred.bloqueadoAte) repo.atualizar('credenciais', { ...cred, falhas: 0, bloqueadoAte: '' });
    return {
      token: emitirToken(cripto, segredo(ctx.portas), linha.id, cred.versaoToken, relogio.agoraMs()),
      pessoa: montarPessoa(repo, linha.id)!,
      senhaInicial: cred.senhaInicial,
    };
  },

  'auth.entrarGoogle': ({ credencial }, ctx) => {
    const { repo, relogio, cripto, props, identidade } = ctx.portas;
    const clienteId = props.obter('GOOGLE_CLIENT_ID');
    if (!clienteId) throw new ErroApi('NAO_DISPONIVEL', 'O login com Google ainda não foi ligado. Entre com e-mail e senha.');
    // o Google confere a assinatura; aqui conferimos que o comprovante é deste site, do Google, recente e de e-mail confirmado
    const conta = typeof credencial === 'string' && credencial.length < 5000 ? identidade.verificar(credencial) : null;
    if (!conta || conta.audiencia !== clienteId || !EMISSORES_GOOGLE.includes(conta.emissor) || !conta.emailVerificado || conta.expiraEm * 1000 < relogio.agoraMs()) {
      throw new ErroApi('GOOGLE', 'Não foi possível confirmar a sua conta Google. Tente de novo.');
    }
    const alvo = conta.email.trim().toLowerCase();
    const linha = repo.listar<{ id: string; emailAcademico: string; ativo: boolean }>('pessoas').find((p) => p.ativo && p.emailAcademico.trim().toLowerCase() === alvo);
    const cred = linha && credencialDe(ctx.portas, linha.id);
    if (!linha || !cred) throw new ErroApi('SEM_CADASTRO', `A conta ${alvo} não está cadastrada no GestorCC. Peça a um gestor para conferir o seu e-mail em Pessoas.`);
    // quem entra pelo Google não precisa trocar a senha inicial agora: a senha continua só como alternativa
    return { token: emitirToken(cripto, segredo(ctx.portas), linha.id, cred.versaoToken, relogio.agoraMs()), pessoa: montarPessoa(repo, linha.id)!, senhaInicial: false };
  },

  'auth.trocarSenha': (d, ctx) => {
    const atual = limpa(d.atual);
    const nova = limpa(d.nova);
    const cred = credencialDe(ctx.portas, ctx.eu!.id);
    if (!cred || !conferirSenha(ctx.portas.cripto, atual, cred)) throw new ErroApi('SENHA_ATUAL', 'A senha atual não confere.');
    exigirSenhaNova(nova);
    const atualizada = gravarSenha(ctx, cred, nova);
    registrar(ctx, 'pessoa', ctx.eu!.id, 'trocou a própria senha', null, null);
    return { token: emitirToken(ctx.portas.cripto, segredo(ctx.portas), ctx.eu!.id, atualizada.versaoToken, ctx.portas.relogio.agoraMs()) };
  },

  'pessoas.redefinirSenha': ({ pessoaId }, ctx) => {
    const pessoa = montarPessoa(ctx.portas.repo, pessoaId);
    const cred = credencialDe(ctx.portas, pessoaId);
    if (!pessoa) throw new ErroApi('NAO_ENCONTRADO', 'Pessoa não encontrada.');
    const nova = criarCredencialInicial(ctx.portas.cripto, pessoaId, pessoa.matricula, (cred?.versaoToken ?? 0) + 1);
    if (cred) ctx.portas.repo.atualizar('credenciais', nova);
    else ctx.portas.repo.inserir('credenciais', nova);
    registrar(ctx, 'pessoa', pessoaId, 'redefiniu a senha para a matrícula', null, null);
    return null;
  },
};
