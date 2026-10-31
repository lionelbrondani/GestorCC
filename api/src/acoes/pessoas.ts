import {
  cpfValido,
  ehGestor,
  ErroApi,
  MODELOS,
  MODULOS,
  normalizarCpf,
  normalizarMatricula,
  pode,
  type DadosPessoais,
  type Pessoa,
} from '@shared';
import { sincronizarAgenda } from '../agenda/sincronizar';
import { prepararImportacao } from '../importarPessoas';
import { comPermissoes, exigirVersao, montarPessoa, notificar, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { criarCredencialInicial, type Credencial } from './auth';

type LinhaPessoa = Omit<Pessoa, 'permissoes'> & { atualizadoPor?: string };
type LinhaPermissao = { id: string; pessoaId: string; modulo: string; nivel: Pessoa['permissoes'][keyof Pessoa['permissoes']] };
type LinhaDados = Omit<DadosPessoais, 'pessoaId'> & { id: string };

const linhasPessoas = (ctx: Contexto) => ctx.portas.repo.listar<LinhaPessoa>('pessoas');
const nomeDe = (ctx: Contexto) => (id: string) => linhasPessoas(ctx).find((p) => p.id === id)?.nome ?? 'Outra pessoa';

function gravarPermissoes(ctx: Contexto, pessoaId: string, permissoes: Pessoa['permissoes']) {
  const { repo } = ctx.portas;
  for (const m of MODULOS) {
    const id = `${pessoaId}:${m.id}`;
    const linha = { id, pessoaId, modulo: m.id, nivel: permissoes[m.id] ?? 'nenhum' };
    if (repo.listar<LinhaPermissao>('permissoes').some((p) => p.id === id)) repo.atualizar('permissoes', linha);
    else repo.inserir('permissoes', linha);
  }
}

function semCarimbos<T extends { id: string }>(linha: T): Omit<T, 'criadoEm' | 'atualizadoEm' | 'atualizadoPor'> {
  const { criadoEm: _c, atualizadoEm: _a, atualizadoPor: _p, ...resto } = linha as T & { criadoEm?: string; atualizadoEm?: string; atualizadoPor?: string };
  return resto;
}

function gravarDados(ctx: Contexto, pessoaId: string, dados: Omit<DadosPessoais, 'pessoaId'>) {
  const { repo } = ctx.portas;
  const linha: LinhaDados = { id: pessoaId, ...dados };
  if (repo.listar<LinhaDados>('dadosPessoais').some((d) => d.id === pessoaId)) repo.atualizar('dadosPessoais', linha);
  else repo.inserir('dadosPessoais', linha);
}

export const handlersPessoas: Handlers = {
  'pessoas.listar': (_d, ctx) => {
    const eu = ctx.eu!;
    const permissoes = ctx.portas.repo.listar<LinhaPermissao>('permissoes');
    const todas = linhasPessoas(ctx).map((l) => comPermissoes(l, permissoes));
    if (pode(eu.permissoes, 'pessoas', 'ver') || ehGestor(eu.permissoes)) return todas;
    return todas
      .filter((p) => p.ativo)
      .map((p) => ({ ...p, emailAcademico: '', emailAlternativo: undefined, matricula: '', siape: undefined, convitesAgenda: null, permissoes: MODELOS.eventual }));
  },

  'pessoas.salvar': (p, ctx) => {
    const { repo, cripto } = ctx.portas;
    const matricula = normalizarMatricula(String(p.matricula ?? ''));
    if (!matricula) throw new ErroApi('MATRICULA', 'Matrícula inválida: use 9 ou 10 dígitos, sem pontos.');
    if (!String(p.nome ?? '').trim()) throw new ErroApi('NOME', 'Informe o nome.');
    const email = String(p.emailAcademico ?? '').trim().toLowerCase();
    if (!email.includes('@')) throw new ErroApi('EMAIL', 'Informe um e-mail acadêmico válido.');
    const emUso = linhasPessoas(ctx).some((x) => x.id !== p.id && x.ativo && x.emailAcademico.trim().toLowerCase() === email);
    if (emUso) throw new ErroApi('EMAIL', 'Já existe uma pessoa ativa com este e-mail acadêmico.');

    const anterior = p.id ? linhasPessoas(ctx).find((x) => x.id === p.id) : undefined;
    if (p.id && !anterior) throw new ErroApi('NAO_ENCONTRADO', 'Pessoa não encontrada.');
    if (anterior) exigirVersao(anterior, p.atualizadoEm, nomeDe(ctx));

    const id = anterior?.id ?? novoId(ctx.portas, 'p');
    const linha = {
      id, nome: p.nome.trim(), nomeCurto: (p.nomeCurto || p.nome.split(' ')[0]).trim().toUpperCase(), emailAcademico: email,
      emailAlternativo: p.emailAlternativo?.trim() ?? '', matricula, siape: p.siape?.trim() ?? '', tipo: p.tipo, vinculo: p.vinculo,
      experiente: !!p.experiente, escalarMenos: !!p.escalarMenos, ativo: p.ativo !== false, convitesAgenda: p.convitesAgenda ?? '',
    };
    if (anterior) repo.atualizar('pessoas', linha);
    else repo.inserir('pessoas', linha);
    gravarPermissoes(ctx, id, p.permissoes);

    const cred = repo.listar<Credencial>('credenciais').find((c) => c.id === id);
    if (!cred) repo.inserir('credenciais', criarCredencialInicial(cripto, id, matricula));
    else if (anterior?.ativo && !linha.ativo) repo.atualizar('credenciais', { ...cred, versaoToken: cred.versaoToken + 1 });

    registrar(ctx, 'pessoa', id, anterior ? 'alterou cadastro/permissões' : 'cadastrou pessoa', anterior ? semCarimbos(anterior) : null, linha);
    return montarPessoa(repo, id)!;
  },

  'pessoas.importar': (_d, ctx) => {
    const { repo, cripto } = ctx.portas;
    const existentes = linhasPessoas(ctx).map((l) => comPermissoes(l, []));
    const r = prepararImportacao(repo.lerAbaLivre('sigiloso', 'IMPORTAR_PESSOAS'), existentes);
    for (const n of r.novas) {
      const id = novoId(ctx.portas, 'p');
      repo.inserir('pessoas', { id, ...n.pessoa, emailAlternativo: '', siape: '', convitesAgenda: '' });
      gravarPermissoes(ctx, id, MODELOS.eventual);
      repo.inserir('credenciais', criarCredencialInicial(cripto, id, n.pessoa.matricula));
      gravarDados(ctx, id, n.dados);
    }
    for (const a of r.atualizacoes) gravarDados(ctx, a.pessoaId, a.dados);
    registrar(ctx, 'pessoa', 'importacao', `importou ${r.novas.length} pessoa(s) e atualizou ${r.atualizacoes.length}`, null, { problemas: r.problemas.length });
    return { importadas: r.novas.length, atualizadas: r.atualizacoes.length, problemas: r.problemas };
  },

  'dadosPessoais.obter': ({ pessoaId }, ctx) => {
    if (pessoaId !== ctx.eu!.id && !pode(ctx.eu!.permissoes, 'dadosPessoais', 'ver')) {
      throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    }
    const linha = ctx.portas.repo.listar<LinhaDados>('dadosPessoais').find((d) => d.id === pessoaId);
    if (!linha) return null;
    const { id, ...resto } = semCarimbos(linha);
    return { pessoaId: id, ...resto };
  },

  'dadosPessoais.salvar': (d, ctx) => {
    const proprio = d.pessoaId === ctx.eu!.id;
    if (!proprio && !pode(ctx.eu!.permissoes, 'dadosPessoais', 'editar')) {
      throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');
    }
    let cpf = '';
    if (d.cpf?.trim()) {
      if (!cpfValido(d.cpf)) throw new ErroApi('CPF', 'CPF inválido. Confira os números.');
      cpf = normalizarCpf(d.cpf)!;
    }
    const anterior = ctx.portas.repo.listar<LinhaDados>('dadosPessoais').find((x) => x.id === d.pessoaId);
    const dados = { cpf, banco: d.banco?.trim() ?? '', agencia: d.agencia?.trim() ?? '', conta: d.conta?.trim() ?? '', nascimento: d.nascimento ?? '', camiseta: d.camiseta ?? '' };
    gravarDados(ctx, d.pessoaId, dados);
    const mudouBanco = !anterior || anterior.banco !== dados.banco || anterior.agencia !== dados.agencia || anterior.conta !== dados.conta;
    if (proprio && mudouBanco) {
      const permissoes = ctx.portas.repo.listar<LinhaPermissao>('permissoes');
      const gestores = linhasPessoas(ctx)
        .filter((p) => p.ativo && p.id !== ctx.eu!.id)
        .filter((p) => permissoes.some((x) => x.pessoaId === p.id && x.modulo === 'dadosPessoais' && x.nivel === 'editar'))
        .map((p) => p.id);
      notificar(ctx, gestores, `${ctx.eu!.nome} atualizou os dados bancários.`, `/pessoas/${ctx.eu!.id}`);
    }
    // o histórico registra só que houve alteração, sem os valores sigilosos
    registrar(ctx, 'dadosPessoais', d.pessoaId, 'atualizou dados pessoais', null, null);
    return { pessoaId: d.pessoaId, ...dados };
  },

  'perfil.salvarAgenda': ({ email }, ctx) => {
    const linha = linhasPessoas(ctx).find((p) => p.id === ctx.eu!.id)!;
    if (email !== null && ![linha.emailAcademico, linha.emailAlternativo].filter(Boolean).includes(email)) {
      throw new ErroApi('EMAIL', 'Escolha um dos e-mails do seu cadastro.');
    }
    ctx.portas.repo.atualizar('pessoas', { ...semCarimbos(linha), convitesAgenda: email ?? '' });
    registrar(ctx, 'pessoa', linha.id, email ? 'ativou convites do Google Agenda' : 'desativou convites do Google Agenda', null, null);
    // leva a preferência para as próximas sessões em que a pessoa já está publicada
    const hoje = ctx.portas.relogio.hoje();
    const futuras = new Set(ctx.portas.repo.listar<{ id: string; data: string }>('sessoes').filter((s) => s.data >= hoje).map((s) => s.id));
    const minhas = ctx.portas.repo
      .listar<{ id: string; sessaoId: string; pessoaId: string; status: string }>('escalas')
      .filter((e) => e.pessoaId === linha.id && e.status === 'publicado' && futuras.has(e.sessaoId))
      .map((e) => e.sessaoId);
    sincronizarAgenda(ctx.portas, minhas);
    return montarPessoa(ctx.portas.repo, linha.id)!;
  },
};
