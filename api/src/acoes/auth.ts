import { ErroApi } from '@shared';
import { paraBase64Url, utf8 } from '../auth/bytes';
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
  resetToken: string;
  resetExpira: string;
}

const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60_000;
const VALIDADE_RESET_MS = 60 * 60_000;
const MIN_SENHA = 8;

export function criarCredencialInicial(cripto: Cripto, pessoaId: string, matricula: string, versaoToken = 1): Credencial {
  return {
    id: pessoaId, ...criarHash(cripto, matricula, ITERACOES_PADRAO), senhaInicial: true, versaoToken,
    falhas: 0, bloqueadoAte: '', resetToken: '', resetExpira: '',
  };
}

const segredo = (p: Portas) => {
  const s = p.props.obter('SEGREDO_TOKEN');
  if (!s) throw new Error('SEGREDO_TOKEN não configurado (rode instalar()).');
  return s;
};

const credencialDe = (p: Portas, pessoaId: string) => p.repo.listar<Credencial>('credenciais').find((c) => c.id === pessoaId);

/** O token de redefinição é guardado só como HMAC (quem lê a planilha não consegue usá-lo). */
const resumoReset = (p: Portas, token: string) => paraBase64Url(p.cripto.hmacSha256(utf8(segredo(p)), utf8(`reset:${token}`)));

function exigirSenhaNova(nova: string) {
  if (nova.length < MIN_SENHA) throw new ErroApi('SENHA_CURTA', 'A nova senha deve ter pelo menos 8 caracteres.');
}

function gravarSenha(ctx: Contexto, cred: Credencial, nova: string): Credencial {
  const atualizada: Credencial = {
    ...cred, ...criarHash(ctx.portas.cripto, nova), senhaInicial: false, versaoToken: cred.versaoToken + 1,
    falhas: 0, bloqueadoAte: '', resetToken: '', resetExpira: '',
  };
  ctx.portas.repo.atualizar('credenciais', atualizada);
  return atualizada;
}

const CREDENCIAIS = () => new ErroApi('CREDENCIAIS', 'E-mail ou senha incorretos.');

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
    if (!conferirSenha(cripto, String(senha ?? '').trim(), cred)) {
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

  'auth.trocarSenha': ({ atual, nova }, ctx) => {
    const cred = credencialDe(ctx.portas, ctx.eu!.id);
    if (!cred || !conferirSenha(ctx.portas.cripto, atual, cred)) throw new ErroApi('SENHA_ATUAL', 'A senha atual não confere.');
    exigirSenhaNova(nova);
    const atualizada = gravarSenha(ctx, cred, nova);
    registrar(ctx, 'pessoa', ctx.eu!.id, 'trocou a própria senha', null, null);
    return { token: emitirToken(ctx.portas.cripto, segredo(ctx.portas), ctx.eu!.id, atualizada.versaoToken, ctx.portas.relogio.agoraMs()) };
  },

  'auth.esqueciSenha': ({ email }, ctx) => {
    const { repo, relogio, cripto, email: correio, props } = ctx.portas;
    const alvo = String(email ?? '').trim().toLowerCase();
    const pessoa = repo.listar<{ id: string; nome: string; emailAcademico: string; ativo: boolean }>('pessoas').find(
      (p) => p.ativo && p.emailAcademico.trim().toLowerCase() === alvo,
    );
    const cred = pessoa && credencialDe(ctx.portas, pessoa.id);
    if (!pessoa || !cred) return null;
    const token = paraBase64Url(cripto.aleatorio(32));
    repo.atualizar('credenciais', { ...cred, resetToken: resumoReset(ctx.portas, token), resetExpira: relogio.formatar(relogio.agoraMs() + VALIDADE_RESET_MS) });
    const link = `${props.obter('URL_APP') ?? ''}/redefinir?token=${encodeURIComponent(token)}`;
    correio.enviar(
      pessoa.emailAcademico,
      'Redefinir sua senha do GestorCC',
      `<p>Olá, ${pessoa.nome.split(' ')[0]}!</p>` +
        `<p>Recebemos um pedido para redefinir sua senha do GestorCC (Centro de Convenções da UFSM).</p>` +
        `<p><a href="${link}">Clique aqui para criar uma nova senha</a>. O link vale por 1 hora e só pode ser usado uma vez.</p>` +
        `<p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
    );
    registrar({ ...ctx, eu: null }, 'pessoa', pessoa.id, 'pediu link de redefinição de senha', null, null);
    return null;
  },

  'auth.redefinirSenha': ({ token, nova }, ctx) => {
    const invalido = () => new ErroApi('LINK_INVALIDO', 'Este link expirou ou já foi usado. Peça um novo.');
    if (!token) throw invalido();
    const resumo = resumoReset(ctx.portas, token);
    const agora = ctx.portas.relogio.agora();
    const cred = ctx.portas.repo.listar<Credencial>('credenciais').find((c) => c.resetToken && c.resetToken === resumo);
    if (!cred || !cred.resetExpira || cred.resetExpira <= agora) throw invalido();
    exigirSenhaNova(nova);
    gravarSenha(ctx, cred, nova);
    registrar({ ...ctx, eu: null }, 'pessoa', cred.id, 'redefiniu a senha pelo link do e-mail', null, null);
    return null;
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
