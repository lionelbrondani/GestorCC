import { interpretarSimulado } from '../../busca/interpretarSimulado';
import {
  ehGestor,
  ErroApi,
  formatarCod,
  meusGanhos,
  normalizarMatricula,
  pode,
  validarRetirada,
  validarTransicao,
  ROTULO_STATUS_OCORRENCIA,
  type Ocorrencia,
  type Acao,
  type Entrada,
  type Escala,
  type Id,
  type Modulo,
  type Pessoa,
  type Saida,
} from '@shared';
import type { ApiCliente } from '../cliente';
import { criarArmazenamento, type Banco } from './armazenamento';

export interface OpcoesMock {
  latenciaMs?: number;
  hoje?: string;
  persistir?: boolean;
}

type Contexto = { banco: Banco; eu: Pessoa | null; hoje: string; agora: string };
type Handler<A extends Acao> = (dados: Entrada<A>, ctx: Contexto) => Saida<A>;
type Regra = 'publica' | 'logado' | [Modulo, 'ver' | 'editar'];

const erro = (codigo: string, mensagem: string) => new ErroApi(codigo, mensagem);
const SEM_PERMISSAO = () => erro('SEM_PERMISSAO', 'Você não tem permissão para esta ação.');

let contadorId = 0;
const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}-${(++contadorId).toString(36)}`;

function exigir(ctx: Contexto, modulo: Modulo, nivel: 'ver' | 'editar') {
  if (!ctx.eu || !pode(ctx.eu.permissoes, modulo, nivel)) throw SEM_PERMISSAO();
}

function registrar(ctx: Contexto, entidade: string, entidadeId: Id, acao: string, justificativa = '') {
  ctx.banco.historico.unshift({ id: novoId('h'), quando: ctx.agora, quemId: ctx.eu?.id ?? '', entidade, entidadeId, acao, justificativa });
}

function notificar(ctx: Contexto, pessoaIds: Id[], texto: string, link: string) {
  for (const pessoaId of new Set(pessoaIds)) {
    ctx.banco.notificacoes.unshift({ id: novoId('n'), pessoaId, texto, link, criadaEm: ctx.agora, lida: false });
  }
}

function nomeSessao(ctx: Contexto, sessaoId: Id): string {
  const s = ctx.banco.sessoes.find((x) => x.id === sessaoId);
  const ev = s && ctx.banco.eventos.find((e) => e.id === s.eventoId);
  if (!s || !ev) return 'sessão';
  return `${ev.nome}${s.rotulo ? ` – ${s.rotulo}` : ''} (${s.data.split('-').reverse().join('/')})`;
}

function sessaoAbertaParaMim(ctx: Contexto, sessaoId: Id): boolean {
  const s = ctx.banco.sessoes.find((x) => x.id === sessaoId);
  if (!s || s.status !== 'ativa') return false;
  if (s.convocacao && s.convocacao.abertaAte >= ctx.agora) return true;
  return ctx.banco.rodadas.some((r) => r.status === 'aberta' && r.prazo >= ctx.agora && r.sessaoIds.includes(sessaoId));
}

/** PDFs anexados no protótipo (só na memória da página). */
const ANEXOS_PROTOTIPO = new Map<string, string>();

function publicoDaPessoa(p: Pessoa): Pessoa {
  return { ...p, emailAcademico: '', emailAlternativo: undefined, matricula: '', siape: undefined };
}

const REGRAS: Record<Acao, Regra> = {
  'sistema.ping': 'publica',
  'pessoas.importar': ['pessoas', 'editar'],
  'auth.entrar': 'publica',
  'auth.trocarSenha': 'logado',
  'perfil.salvarAgenda': 'logado',
  'pessoas.listar': 'logado',
  'pessoas.salvar': ['pessoas', 'editar'],
  'pessoas.redefinirSenha': ['pessoas', 'editar'],
  'dadosPessoais.obter': 'logado',
  'dadosPessoais.salvar': 'logado',
  'eventos.listar': 'logado',
  'eventos.salvar': ['eventos', 'editar'],
  'eventos.cancelar': ['eventos', 'editar'],
  'sessoes.cancelar': ['eventos', 'editar'],
  'feriados.listar': 'logado',
  'feriados.salvar': ['configuracoes', 'editar'],
  'rodadas.listar': 'logado',
  'rodadas.salvar': ['escalas', 'editar'],
  'disponibilidades.listar': 'logado',
  'disponibilidades.marcar': 'logado',
  'escalas.listar': 'logado',
  'escalas.salvarRascunho': ['escalas', 'editar'],
  'escalas.publicar': ['escalas', 'editar'],
  'escalas.trocar': ['escalas', 'editar'],
  'escalas.convocar': ['escalas', 'editar'],
  'escalas.confirmarPresenca': ['escalas', 'editar'],
  'avaliacoes.listar': ['escalas', 'ver'],
  'avaliacoes.salvar': ['escalas', 'editar'],
  'lotes.listar': ['pagamentos', 'ver'],
  'lotes.criar': ['pagamentos', 'editar'],
  'lotes.retirarItem': ['pagamentos', 'editar'],
  'lotes.marcarPago': ['pagamentos', 'editar'],
  'lotes.cancelar': ['pagamentos', 'editar'],
  'ganhos.meus': 'logado',
  'externos.registrarEnvio': ['pagamentos', 'editar'],
  'almox.importar': ['almoxEstoque', 'editar'],
  'contratos.listar': ['contratos', 'ver'],
  'contratos.salvar': ['contratos', 'editar'],
  'contratos.salvarAditivo': ['contratos', 'editar'],
  'contratantes.salvar': ['contratos', 'editar'],
  'contratos.anexar': ['contratos', 'editar'],
  'contratos.anexo': ['contratos', 'ver'],
  'documentos.gerar': ['contratos', 'editar'],
  'almox.listar': 'logado',
  'almox.movimentos': ['almoxEstoque', 'ver'],
  'almox.salvarItem': ['almoxEstoque', 'editar'],
  'almox.ajustar': ['almoxEstoque', 'editar'],
  'almox.retirar': ['almoxSaidas', 'editar'],
  'almox.pedidos': ['almoxEstoque', 'ver'],
  'almox.criarPedido': ['almoxEstoque', 'editar'],
  'almox.receber': ['almoxEstoque', 'editar'],
  'infra.listar': 'logado',
  'infra.relatar': 'logado',
  'infra.atualizar': ['infraestrutura', 'editar'],
  'infra.importarFormulario': ['infraestrutura', 'editar'],
  'infra.foto': 'logado',
  'busca.interpretar': ['busca', 'ver'],
  'avisos.listar': 'logado',
  'avisos.salvar': ['mural', 'editar'],
  'avisos.confirmarLeitura': 'logado',
  'notificacoes.listar': 'logado',
  'notificacoes.marcarLidas': 'logado',
  'historico.listar': 'logado',
  'config.obter': 'logado',
  'config.salvar': ['configuracoes', 'editar'],
};

type Handlers = { [A in Acao]: Handler<A> };

const handlers: Handlers = {
  'auth.entrar': ({ email, senha }, ctx) => {
    const p = ctx.banco.pessoas.find((x) => x.emailAcademico.toLowerCase() === email.trim().toLowerCase() && x.ativo);
    const cred = p && ctx.banco.senhas[p.id];
    if (!p || !cred || cred.senha !== senha.trim()) throw erro('CREDENCIAIS', 'E-mail ou senha incorretos.');
    return { token: `tok-${p.id}`, pessoa: p, senhaInicial: cred.inicial };
  },
  'sistema.ping': () => ({ versao: 'prototipo' }),
  'pessoas.importar': () => ({ importadas: 0, atualizadas: 0, problemas: [] }),
  'auth.trocarSenha': ({ atual, nova }, ctx) => {
    const cred = ctx.banco.senhas[ctx.eu!.id];
    if (cred.senha !== atual) throw erro('SENHA_ATUAL', 'A senha atual não confere.');
    if (nova.length < 8) throw erro('SENHA_CURTA', 'A nova senha deve ter pelo menos 8 caracteres.');
    ctx.banco.senhas[ctx.eu!.id] = { senha: nova, inicial: false };
    registrar(ctx, 'pessoa', ctx.eu!.id, 'trocou a senha');
    return { token: `tok-${ctx.eu!.id}` };
  },

  'perfil.salvarAgenda': ({ email }, ctx) => {
    const p = ctx.banco.pessoas.find((x) => x.id === ctx.eu!.id)!;
    if (email !== null && ![p.emailAcademico, p.emailAlternativo].includes(email)) {
      throw erro('EMAIL', 'Escolha um dos e-mails do seu cadastro.');
    }
    p.convitesAgenda = email;
    registrar(ctx, 'pessoa', p.id, email ? 'ativou convites do Google Agenda' : 'desativou convites do Google Agenda');
    return p;
  },

  'pessoas.listar': (_d, ctx) =>
    pode(ctx.eu!.permissoes, 'pessoas', 'ver') || ehGestor(ctx.eu!.permissoes)
      ? ctx.banco.pessoas
      : ctx.banco.pessoas.filter((p) => p.ativo).map(publicoDaPessoa),
  'pessoas.salvar': (p, ctx) => {
    if (!normalizarMatricula(p.matricula)) throw erro('MATRICULA', 'Matrícula inválida: use 9 ou 10 dígitos.');
    const emailEmUso = ctx.banco.pessoas.some(
      (x) => x.id !== p.id && x.ativo && x.emailAcademico.toLowerCase() === p.emailAcademico.toLowerCase(),
    );
    if (emailEmUso) throw erro('EMAIL', 'Já existe uma pessoa ativa com este e-mail acadêmico.');
    const i = ctx.banco.pessoas.findIndex((x) => x.id === p.id);
    const salvo = { ...p, id: p.id || novoId('p') };
    if (i >= 0) ctx.banco.pessoas[i] = salvo;
    else {
      ctx.banco.pessoas.push(salvo);
      ctx.banco.senhas[salvo.id] = { senha: salvo.matricula, inicial: true };
    }
    registrar(ctx, 'pessoa', salvo.id, i >= 0 ? 'alterou cadastro/permissões' : 'cadastrou pessoa');
    return salvo;
  },
  'pessoas.redefinirSenha': ({ pessoaId }, ctx) => {
    const p = ctx.banco.pessoas.find((x) => x.id === pessoaId);
    if (!p) throw erro('NAO_ENCONTRADO', 'Pessoa não encontrada.');
    ctx.banco.senhas[p.id] = { senha: p.matricula, inicial: true };
    registrar(ctx, 'pessoa', p.id, 'redefiniu a senha para a matrícula');
    return null;
  },
  'dadosPessoais.obter': ({ pessoaId }, ctx) => {
    if (pessoaId !== ctx.eu!.id) exigir(ctx, 'dadosPessoais', 'ver');
    return ctx.banco.dadosPessoais.find((d) => d.pessoaId === pessoaId) ?? null;
  },
  'dadosPessoais.salvar': (d, ctx) => {
    const proprio = d.pessoaId === ctx.eu!.id;
    if (!proprio) exigir(ctx, 'dadosPessoais', 'editar');
    const i = ctx.banco.dadosPessoais.findIndex((x) => x.pessoaId === d.pessoaId);
    const anterior = i >= 0 ? ctx.banco.dadosPessoais[i] : null;
    if (i >= 0) ctx.banco.dadosPessoais[i] = d;
    else ctx.banco.dadosPessoais.push(d);
    const mudouBanco = !anterior || anterior.banco !== d.banco || anterior.agencia !== d.agencia || anterior.conta !== d.conta;
    if (proprio && mudouBanco) {
      const gestores = ctx.banco.pessoas.filter((p) => pode(p.permissoes, 'dadosPessoais', 'editar')).map((p) => p.id);
      notificar(ctx, gestores, `${ctx.eu!.nome} atualizou os dados bancários.`, `/pessoas/${ctx.eu!.id}`);
    }
    registrar(ctx, 'dadosPessoais', d.pessoaId, 'atualizou dados pessoais');
    return d;
  },

  'eventos.listar': ({ de, ate }, ctx) => {
    const sessoes = ctx.banco.sessoes.filter((s) => s.data >= de && s.data <= ate);
    const ids = new Set(sessoes.map((s) => s.eventoId));
    return { eventos: ctx.banco.eventos.filter((e) => ids.has(e.id)), sessoes };
  },
  'eventos.salvar': ({ evento, sessoes }, ctx) => {
    const ev = { ...evento, id: evento.id || novoId('e') };
    const i = ctx.banco.eventos.findIndex((x) => x.id === ev.id);
    if (i >= 0) ctx.banco.eventos[i] = ev;
    else ctx.banco.eventos.push(ev);
    const novas = sessoes.map((s) => ({ ...s, id: s.id || novoId('s'), eventoId: ev.id }));
    const antigas = ctx.banco.sessoes.filter((s) => s.eventoId === ev.id);
    for (const s of novas) {
      const anterior = antigas.find((a) => a.id === s.id);
      if (anterior?.horarioADefinir && !s.horarioADefinir) {
        const escalados = ctx.banco.escalas.filter((e) => e.sessaoId === s.id && e.status === 'publicado').map((e) => e.pessoaId);
        notificar(ctx, escalados, `Horário definido: ${ev.nome}, chegada às ${s.chegada}.`, '/minhas-escalas');
      }
    }
    ctx.banco.sessoes = ctx.banco.sessoes.filter((s) => s.eventoId !== ev.id).concat(novas);
    // sessão nova entra na rodada aberta do mesmo mês com o selo "nova" (spec 7.2.3), como na API
    for (const s of novas.filter((n) => !antigas.some((a) => a.id === n.id))) {
      for (const r of ctx.banco.rodadas.filter((x) => x.status === 'aberta' && x.prazo >= ctx.agora)) {
        const meses = new Set(ctx.banco.sessoes.filter((x) => r.sessaoIds.includes(x.id)).map((x) => x.data.slice(0, 7)));
        if (meses.has(s.data.slice(0, 7)) && !r.sessaoIds.includes(s.id)) {
          r.sessaoIds.push(s.id);
          r.sessoesNovas = [...(r.sessoesNovas ?? []), s.id];
        }
      }
    }
    registrar(ctx, 'evento', ev.id, i >= 0 ? 'alterou evento' : 'criou evento');
    return { evento: ev, sessoes: novas };
  },
  'eventos.cancelar': ({ eventoId, justificativa }, ctx) => {
    if (!justificativa.trim()) throw erro('JUSTIFICATIVA', 'Informe o motivo do cancelamento.');
    const ev = ctx.banco.eventos.find((e) => e.id === eventoId);
    if (!ev) throw erro('NAO_ENCONTRADO', 'Evento não encontrado.');
    ev.status = 'cancelado';
    for (const s of ctx.banco.sessoes.filter((x) => x.eventoId === eventoId)) cancelarSessao(ctx, s.id, justificativa);
    registrar(ctx, 'evento', eventoId, 'cancelou o evento', justificativa);
    return null;
  },
  'sessoes.cancelar': ({ sessaoId, justificativa }, ctx) => {
    if (!justificativa.trim()) throw erro('JUSTIFICATIVA', 'Informe o motivo do cancelamento.');
    cancelarSessao(ctx, sessaoId, justificativa);
    return null;
  },
  'feriados.listar': ({ ano }, ctx) => ctx.banco.feriados.filter((f) => f.data.startsWith(String(ano))),
  'feriados.salvar': ({ ano, feriados }, ctx) => {
    ctx.banco.feriados = ctx.banco.feriados.filter((f) => !f.data.startsWith(String(ano))).concat(feriados);
    registrar(ctx, 'config', 'feriados', `atualizou feriados de ${ano}`);
    return feriados;
  },

  'rodadas.listar': (_d, ctx) => ctx.banco.rodadas,
  'rodadas.salvar': (r, ctx) => {
    const salvo = { ...r, id: r.id || novoId('r') };
    const i = ctx.banco.rodadas.findIndex((x) => x.id === salvo.id);
    if (i >= 0) ctx.banco.rodadas[i] = salvo;
    else ctx.banco.rodadas.push(salvo);
    registrar(ctx, 'rodada', salvo.id, i >= 0 ? `alterou a rodada (${salvo.status})` : 'abriu a rodada');
    return salvo;
  },
  'disponibilidades.listar': ({ sessaoIds }, ctx) =>
    ctx.banco.disponibilidades.filter(
      (d) => sessaoIds.includes(d.sessaoId) && (pode(ctx.eu!.permissoes, 'escalas', 'ver') || d.pessoaId === ctx.eu!.id),
    ),
  'disponibilidades.marcar': ({ sessaoId, disponivel, pessoaId }, ctx) => {
    const alvo = pessoaId ?? ctx.eu!.id;
    const porOutro = alvo !== ctx.eu!.id;
    if (porOutro) exigir(ctx, 'escalas', 'editar');
    else if (!sessaoAbertaParaMim(ctx, sessaoId)) {
      throw erro('PRAZO', 'O prazo para marcar disponibilidade nesta sessão terminou.');
    }
    const s = ctx.banco.sessoes.find((x) => x.id === sessaoId);
    const origem = porOutro ? 'gestor' : s?.convocacao && s.convocacao.abertaAte >= ctx.agora ? 'convocacao' : 'proprio';
    const nova = { pessoaId: alvo, sessaoId, disponivel, origem } as const;
    ctx.banco.disponibilidades = ctx.banco.disponibilidades
      .filter((d) => !(d.pessoaId === alvo && d.sessaoId === sessaoId))
      .concat(nova);
    if (porOutro) registrar(ctx, 'sessao', sessaoId, `marcou disponibilidade por outra pessoa (${disponivel ? 'Sim' : 'Não'})`);
    return nova;
  },

  'escalas.listar': ({ de, ate }, ctx) => {
    const sessoes = new Set(ctx.banco.sessoes.filter((s) => s.data >= de && s.data <= ate).map((s) => s.id));
    const doPeriodo = ctx.banco.escalas.filter((e) => sessoes.has(e.sessaoId));
    if (pode(ctx.eu!.permissoes, 'escalas', 'ver')) return doPeriodo;
    const minhas = new Set(doPeriodo.filter((e) => e.pessoaId === ctx.eu!.id && e.status !== 'rascunho').map((e) => e.sessaoId));
    return doPeriodo.filter((e) => minhas.has(e.sessaoId) && e.status !== 'rascunho');
  },
  'escalas.salvarRascunho': ({ sessaoId, itens }, ctx) => {
    const atuais = ctx.banco.escalas.filter((e) => e.sessaoId === sessaoId);
    const publicadas = atuais.filter((e) => e.status !== 'rascunho');
    const novas: Escala[] = itens
      .filter((i) => !publicadas.some((p) => p.pessoaId === i.pessoaId && p.status !== 'cancelado'))
      .map((i) => ({ id: novoId('x'), sessaoId, pessoaId: i.pessoaId, papel: i.papel, status: 'rascunho', adicaoDireta: i.adicaoDireta, loteId: null }));
    ctx.banco.escalas = ctx.banco.escalas.filter((e) => !(e.sessaoId === sessaoId && e.status === 'rascunho')).concat(novas);
    registrar(ctx, 'sessao', sessaoId, `salvou rascunho (${novas.length} pessoa(s))`);
    return ctx.banco.escalas.filter((e) => e.sessaoId === sessaoId);
  },
  'escalas.publicar': ({ sessaoIds }, ctx) => {
    const afetados: Id[] = [];
    for (const e of ctx.banco.escalas) {
      if (sessaoIds.includes(e.sessaoId) && e.status === 'rascunho') {
        e.status = 'publicado';
        afetados.push(e.pessoaId);
      }
    }
    for (const s of ctx.banco.sessoes) if (sessaoIds.includes(s.id)) s.publicadaEm = ctx.agora;
    notificar(ctx, afetados, 'Sua escala foi publicada. Confira os horários.', '/minhas-escalas');
    registrar(ctx, 'escala', sessaoIds.join(','), `publicou ${sessaoIds.length} sessão(ões)`);
    return null;
  },
  'escalas.trocar': ({ sessaoId, sai, entra, justificativa }, ctx) => {
    if (!justificativa.trim()) throw erro('JUSTIFICATIVA', 'Informe a justificativa da troca.');
    if (!sai && !entra) throw erro('TROCA_VAZIA', 'Escolha quem sai e/ou quem entra.');
    const daSessao = ctx.banco.escalas.filter((e) => e.sessaoId === sessaoId && ['publicado', 'rascunho'].includes(e.status));
    const saindo = sai ? daSessao.find((e) => e.pessoaId === sai) : undefined;
    if (sai && !saindo) throw erro('NAO_ENCONTRADO', 'Esta pessoa não está escalada nesta sessão.');
    const papel = saindo?.papel ?? (ctx.banco.pessoas.find((p) => p.id === entra)?.tipo === 'servidor' ? 'servidor' : 'bolsista');
    if (entra) {
      const quem = ctx.banco.pessoas.find((p) => p.id === entra);
      if (!quem) throw erro('NAO_ENCONTRADO', 'Pessoa não encontrada.');
      const papelEntra = quem.tipo === 'servidor' ? 'servidor' : 'bolsista';
      if (papelEntra !== papel) throw erro('PAPEL', 'Servidor só pode ser trocado por servidor, e bolsista por bolsista.');
      if (daSessao.some((e) => e.pessoaId === entra)) throw erro('DUPLICADO', 'Esta pessoa já está escalada nesta sessão.');
    }
    if (saindo) ctx.banco.escalas = ctx.banco.escalas.filter((e) => e.id !== saindo.id);
    if (entra) {
      const disp = ctx.banco.disponibilidades.some((d) => d.pessoaId === entra && d.sessaoId === sessaoId && d.disponivel);
      ctx.banco.escalas.push({ id: novoId('x'), sessaoId, pessoaId: entra, papel, status: saindo?.status ?? 'publicado', adicaoDireta: !disp, loteId: null });
    }
    const nome = nomeSessao(ctx, sessaoId);
    if (sai) notificar(ctx, [sai], `Você foi retirado(a) da escala: ${nome}.`, '/minhas-escalas');
    if (entra) notificar(ctx, [entra], `Você foi escalado(a): ${nome}.`, '/minhas-escalas');
    const nomeDe = (id: Id | null) => (id ? ctx.banco.pessoas.find((p) => p.id === id)?.nomeCurto ?? id : '—');
    registrar(ctx, 'sessao', sessaoId, `troca: sai ${nomeDe(sai)}, entra ${nomeDe(entra)}`, justificativa);
    return ctx.banco.escalas.filter((e) => e.sessaoId === sessaoId);
  },
  'escalas.convocar': ({ sessaoId, vagas, abertaAte }, ctx) => {
    const s = ctx.banco.sessoes.find((x) => x.id === sessaoId);
    if (!s) throw erro('NAO_ENCONTRADO', 'Sessão não encontrada.');
    if (vagas < 1) throw erro('VAGAS', 'Informe ao menos 1 vaga extra.');
    s.convocacao = { abertaAte, vagas };
    s.vagasBolsistas += vagas;
    const escalados = new Set(ctx.banco.escalas.filter((e) => e.sessaoId === sessaoId).map((e) => e.pessoaId));
    const alvos = ctx.banco.pessoas.filter((p) => p.ativo && p.tipo === 'bolsista' && !escalados.has(p.id)).map((p) => p.id);
    notificar(ctx, alvos, `Precisamos de mais ${vagas} bolsista(s): ${nomeSessao(ctx, sessaoId)}. Marque se puder.`, '/disponibilidade');
    registrar(ctx, 'sessao', sessaoId, `abriu convocação extra (+${vagas})`, 'convocação extra');
    return s;
  },
  'escalas.confirmarPresenca': ({ sessaoId, faltaram }, ctx) => {
    for (const e of ctx.banco.escalas) {
      if (e.sessaoId !== sessaoId || e.status !== 'publicado') continue;
      e.status = faltaram.includes(e.pessoaId) ? 'faltou' : 'realizado';
    }
    registrar(ctx, 'sessao', sessaoId, `confirmou presença (${faltaram.length} falta(s))`);
    return ctx.banco.escalas.filter((e) => e.sessaoId === sessaoId);
  },
  'avaliacoes.listar': ({ mes }, ctx) => ctx.banco.avaliacoes.filter((a) => a.mes === mes),
  'avaliacoes.salvar': (a, ctx) => {
    ctx.banco.avaliacoes = ctx.banco.avaliacoes.filter((x) => !(x.pessoaId === a.pessoaId && x.mes === a.mes)).concat(a);
    return a;
  },

  'lotes.listar': (_d, ctx) => ({ lotes: ctx.banco.lotes, itens: ctx.banco.loteItens }),
  'lotes.criar': (d, ctx) => {
    if (!d.escalaIds.length) throw erro('LOTE_VAZIO', 'Selecione ao menos uma sessão.');
    const id = novoId('L');
    const lote = {
      id, titulo: d.titulo, periodoReferencia: d.periodoReferencia, edital: d.edital, iniciativa: d.iniciativa,
      incluirZerados: d.incluirZerados, status: 'enviado' as const, criadoEm: ctx.agora, pagoEm: null,
    };
    for (const escalaId of d.escalaIds) {
      const e = ctx.banco.escalas.find((x) => x.id === escalaId);
      const s = e && ctx.banco.sessoes.find((x) => x.id === e.sessaoId);
      if (!e || !s || e.status !== 'realizado') throw erro('NAO_ELEGIVEL', 'Alguma sessão selecionada não pode ser paga.');
      e.loteId = id;
      ctx.banco.loteItens.push({ loteId: id, escalaId, pessoaId: e.pessoaId, valor: s.diaria ?? ctx.banco.config.diariaPadrao });
    }
    ctx.banco.lotes.push(lote);
    registrar(ctx, 'lote', id, `criou lote com ${d.escalaIds.length} escala(s)`);
    return lote;
  },
  'lotes.retirarItem': ({ loteId, escalaId }, ctx) => {
    const lote = ctx.banco.lotes.find((l) => l.id === loteId);
    if (!lote || lote.status !== 'enviado') throw erro('LOTE_FECHADO', 'Só é possível alterar lotes ainda não pagos.');
    ctx.banco.loteItens = ctx.banco.loteItens.filter((i) => !(i.loteId === loteId && i.escalaId === escalaId));
    const e = ctx.banco.escalas.find((x) => x.id === escalaId);
    if (e) e.loteId = null;
    registrar(ctx, 'lote', loteId, 'retirou uma sessão do lote');
    return lote;
  },
  'lotes.marcarPago': ({ loteId, data }, ctx) => {
    const lote = ctx.banco.lotes.find((l) => l.id === loteId);
    if (!lote || lote.status !== 'enviado') throw erro('LOTE_FECHADO', 'Este lote não está aguardando pagamento.');
    lote.status = 'pago';
    lote.pagoEm = data;
    const pessoas = ctx.banco.loteItens.filter((i) => i.loteId === loteId).map((i) => i.pessoaId);
    notificar(ctx, pessoas, `Pagamento do ${lote.titulo} realizado.`, '/ganhos');
    registrar(ctx, 'lote', loteId, 'marcou como pago');
    return lote;
  },
  'lotes.cancelar': ({ loteId, justificativa }, ctx) => {
    if (!justificativa.trim()) throw erro('JUSTIFICATIVA', 'Informe o motivo do cancelamento do lote.');
    const lote = ctx.banco.lotes.find((l) => l.id === loteId);
    if (!lote || lote.status !== 'enviado') throw erro('LOTE_FECHADO', 'Só é possível cancelar lotes ainda não pagos.');
    lote.status = 'cancelado';
    for (const e of ctx.banco.escalas) if (e.loteId === loteId) e.loteId = null;
    registrar(ctx, 'lote', loteId, 'cancelou o lote', justificativa);
    return lote;
  },
  'ganhos.meus': (_d, ctx) =>
    meusGanhos(
      ctx.eu!.id,
      { eventos: ctx.banco.eventos, sessoes: ctx.banco.sessoes, escalas: ctx.banco.escalas, lotes: ctx.banco.lotes, itens: ctx.banco.loteItens },
      ctx.banco.config.diariaPadrao,
    ),
  'almox.importar': () => ({ itens: 0, autorizados: 0, problemas: [] }),
  'externos.registrarEnvio': ({ eventoId, campos }, ctx) => {
    ctx.banco.envioExterno.push({ eventoId, enviadoEm: ctx.agora, campos });
    registrar(ctx, 'evento', eventoId, 'registrou envio de dados ao pagador externo');
    return null;
  },

  'contratos.listar': (_d, ctx) => ({ contratos: ctx.banco.contratos, aditivos: ctx.banco.aditivos, contratantes: ctx.banco.contratantes }),
  'contratos.salvar': (c, ctx) => {
    const salvo = { ...c, id: c.id || novoId('c') };
    const i = ctx.banco.contratos.findIndex((x) => x.id === salvo.id);
    if (i >= 0) ctx.banco.contratos[i] = salvo;
    else ctx.banco.contratos.push(salvo);
    registrar(ctx, 'contrato', salvo.id, i >= 0 ? 'alterou contrato' : 'criou contrato');
    return salvo;
  },

  'contratos.salvarAditivo': (ad, ctx) => {
    const salvo = { ...ad, id: ad.id || novoId('ad') };
    const i = ctx.banco.aditivos.findIndex((x) => x.id === salvo.id);
    if (i >= 0) ctx.banco.aditivos[i] = salvo;
    else ctx.banco.aditivos.push(salvo);
    registrar(ctx, 'contrato', salvo.contratoId, i >= 0 ? 'alterou aditivo' : 'registrou aditivo');
    return salvo;
  },
  'contratantes.salvar': (k, ctx) => {
    if (!k.razaoSocial.trim()) throw erro('RAZAO_SOCIAL', 'Informe a razão social ou o nome do contratante.');
    const salvo = { ...k, id: k.id || novoId('k') };
    const i = ctx.banco.contratantes.findIndex((x) => x.id === salvo.id);
    if (i >= 0) ctx.banco.contratantes[i] = salvo;
    else ctx.banco.contratantes.push(salvo);
    registrar(ctx, 'contratante', salvo.id, i >= 0 ? 'alterou contratante' : 'cadastrou contratante');
    return salvo;
  },

  'contratos.anexar': ({ contratoId, tipo, arquivo }, ctx) => {
    const c = ctx.banco.contratos.find((x) => x.id === contratoId);
    if (!c) throw erro('NAO_ENCONTRADO', 'Contrato não encontrado.');
    if (!arquivo.startsWith('data:application/pdf')) throw erro('ARQUIVO', 'Envie o arquivo em PDF.');
    ANEXOS_PROTOTIPO.set(`${contratoId}:${tipo}`, arquivo);
    if (tipo === 'assinado') c.pdfAssinado = true;
    else c.pdfFatura = true;
    return c;
  },
  'contratos.anexo': ({ contratoId, tipo }) => ANEXOS_PROTOTIPO.get(`${contratoId}:${tipo}`) ?? null,
  'documentos.gerar': () => {
    throw erro('MODELO', 'No protótipo os documentos não são gerados: eles saem dos modelos do Google Docs quando o sistema está ligado à conta do setor.');
  },

  'almox.listar': (_d, ctx) => {
    const p = ctx.eu!.permissoes;
    if (!pode(p, 'almoxEstoque', 'ver') && !pode(p, 'almoxSaidas', 'ver')) throw SEM_PERMISSAO();
    return { itens: ctx.banco.almoxItens, autorizadosExternos: ctx.banco.autorizadosExternos };
  },
  'almox.movimentos': ({ cod, ocorrenciaId }, ctx) =>
    ctx.banco.almoxMovimentos
      .filter((m) => (!cod || formatarCod(m.cod) === formatarCod(cod)) && (!ocorrenciaId || m.ocorrenciaId === ocorrenciaId))
      .sort((a, b) => b.quando.localeCompare(a.quando)),
  'almox.salvarItem': (item, ctx) => {
    const cod = formatarCod(item.cod);
    const i = ctx.banco.almoxItens.findIndex((x) => x.cod === cod);
    const salvo = { ...item, cod, saldo: i >= 0 ? ctx.banco.almoxItens[i].saldo : 0 };
    if (i >= 0) ctx.banco.almoxItens[i] = salvo;
    else ctx.banco.almoxItens.push(salvo);
    registrar(ctx, 'almox', cod, i >= 0 ? 'alterou item do catálogo' : 'cadastrou item');
    return salvo;
  },
  'almox.ajustar': ({ cod, qtd, motivo }, ctx) => {
    if (!motivo.trim()) throw erro('MOTIVO', 'Informe o motivo do ajuste.');
    const item = ctx.banco.almoxItens.find((x) => x.cod === formatarCod(cod));
    if (!item) throw erro('NAO_ENCONTRADO', 'Item não encontrado.');
    if (item.saldo + qtd < 0) throw erro('ESTOQUE', 'O ajuste deixaria o saldo negativo.');
    item.saldo += qtd;
    ctx.banco.almoxMovimentos.push({ id: novoId('m'), quando: ctx.agora, tipo: 'ajuste', cod: item.cod, qtd, valorUnitario: item.valor, motivo });
    registrar(ctx, 'almox', item.cod, `ajuste de estoque (${qtd > 0 ? '+' : ''}${qtd})`, motivo);
    return item;
  },
  'almox.retirar': (d, ctx) => {
    if (!d.finalidade.trim()) throw erro('FINALIDADE', 'Informe a finalidade da retirada.');
    const erros = validarRetirada(d.itens, ctx.banco.almoxItens);
    if (erros.length) throw erro('ESTOQUE', erros.map((e) => `${e.cod}: ${e.erro}`).join('; '));
    const movs = d.itens.map((i) => {
      const item = ctx.banco.almoxItens.find((x) => x.cod === formatarCod(i.cod))!;
      item.saldo -= i.qtd;
      return {
        id: novoId('m'), quando: ctx.agora, tipo: 'saida' as const, cod: item.cod, qtd: -i.qtd, valorUnitario: item.valor,
        retiradoPorPessoaId: d.retiradoPorPessoaId, retiradoPorExterno: d.retiradoPorExterno, eventoId: d.eventoId, finalidade: d.finalidade,
        ocorrenciaId: d.ocorrenciaId,
      };
    });
    ctx.banco.almoxMovimentos.push(...movs);
    registrar(ctx, 'almox', movs.map((m) => m.cod).join(','), `registrou retirada de ${movs.length} item(ns)`, d.finalidade);
    return movs;
  },
  'almox.pedidos': (_d, ctx) => ctx.banco.pedidos,
  'almox.criarPedido': ({ itens }, ctx) => {
    if (!itens.length) throw erro('PEDIDO_VAZIO', 'Inclua ao menos um item no pedido.');
    const pedido = {
      id: novoId('PED'), criadoEm: ctx.agora, solicitanteId: ctx.eu!.id, status: 'aberto' as const,
      itens: itens.map((i) => ({ ...i, cod: formatarCod(i.cod), qtdRecebida: 0 })),
    };
    ctx.banco.pedidos.unshift(pedido);
    registrar(ctx, 'pedido', pedido.id, `registrou pedido com ${itens.length} item(ns)`);
    return pedido;
  },
  'almox.receber': ({ pedidoId, itens }, ctx) => {
    const pedido = ctx.banco.pedidos.find((p) => p.id === pedidoId);
    if (!pedido) throw erro('NAO_ENCONTRADO', 'Pedido não encontrado.');
    for (const r of itens) {
      if (r.qtd <= 0) continue;
      const linha = pedido.itens.find((i) => i.cod === formatarCod(r.cod));
      const item = ctx.banco.almoxItens.find((x) => x.cod === formatarCod(r.cod));
      if (!linha || !item) continue;
      linha.qtdRecebida += r.qtd;
      item.saldo += r.qtd;
      ctx.banco.almoxMovimentos.push({ id: novoId('m'), quando: ctx.agora, tipo: 'recebimento', cod: item.cod, qtd: r.qtd, valorUnitario: item.valor, pedidoId });
    }
    pedido.status = pedido.itens.every((i) => i.qtdRecebida >= i.qtdPedida) ? 'recebido' : 'parcial';
    registrar(ctx, 'pedido', pedidoId, `registrou recebimento (${pedido.status})`);
    return pedido;
  },

  'infra.listar': (_d, ctx) =>
    ctx.banco.ocorrencias
      .filter((o) => pode(ctx.eu!.permissoes, 'infraestrutura', 'ver') || o.relatorPessoaId === ctx.eu!.id)
      .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
  'infra.relatar': (d, ctx) => {
    if (!d.titulo.trim()) throw erro('TITULO', 'Conte em poucas palavras o que aconteceu.');
    if (!d.local) throw erro('LOCAL', 'Informe onde está o problema.');
    const o = novaOcorrencia(ctx, {
      ...d, status: 'nova', origem: 'app', relatorNome: ctx.eu!.nome, relatorPessoaId: ctx.eu!.id, criadaEm: ctx.agora,
      chamadoNumero: '', chamadoLink: '', chamadoAbertoEm: null, resolvidaEm: null,
    });
    return o;
  },
  'infra.atualizar': (d, ctx) => {
    const o = ctx.banco.ocorrencias.find((x) => x.id === d.id);
    if (!o) throw erro('NAO_ENCONTRADO', 'Ocorrência não encontrada.');
    if (d.chamadoNumero !== undefined) o.chamadoNumero = d.chamadoNumero.trim();
    if (d.chamadoLink !== undefined) o.chamadoLink = d.chamadoLink.trim();
    if (d.prioridade) o.prioridade = d.prioridade;
    if (d.categoria) o.categoria = d.categoria;
    if (d.local) o.local = d.local;
    if (d.para) {
      const problema = validarTransicao(o, d.para, { chamadoNumero: o.chamadoNumero, observacao: d.observacao });
      if (problema) throw erro('TRANSICAO', problema);
      o.historico.push({ quando: ctx.agora, quemId: ctx.eu!.id, de: o.status, para: d.para, observacao: d.observacao.trim() });
      o.status = d.para;
      if (d.para === 'chamado') o.chamadoAbertoEm = ctx.agora;
      if (d.para === 'resolvida' || d.para === 'naoProcede') o.resolvidaEm = ctx.agora;
      if (o.relatorPessoaId) notificar(ctx, [o.relatorPessoaId], `Sua ocorrência #${o.numero} (${o.titulo}) agora está: ${ROTULO_STATUS_OCORRENCIA[d.para]}.`, '/relatar');
    } else if (d.observacao.trim()) {
      o.historico.push({ quando: ctx.agora, quemId: ctx.eu!.id, de: null, para: o.status, observacao: d.observacao.trim() });
    }
    registrar(ctx, 'ocorrencia', o.id, d.para ? `situação: ${ROTULO_STATUS_OCORRENCIA[d.para]}` : 'atualizou a ocorrência', d.observacao);
    return o;
  },
  'infra.foto': ({ id }, ctx) => ctx.banco.ocorrencias.find((o) => o.id === id)?.foto ?? null,
  'busca.interpretar': ({ pergunta }, ctx) => ({ consulta: interpretarSimulado(pergunta, ctx.hoje), ajuda: null, motivo: null }),
  'infra.importarFormulario': (_d, ctx) => {
    const pendentes = ctx.banco.respostasFormularioInfra;
    for (const r of pendentes) novaOcorrencia(ctx, r);
    ctx.banco.respostasFormularioInfra = [];
    registrar(ctx, 'ocorrencia', 'formulario', `importou ${pendentes.length} resposta(s) do formulário`);
    return { importadas: pendentes.length };
  },

  'avisos.listar': (_d, ctx) => {
    const eu = ctx.eu!;
    const gestor = ehGestor(eu.permissoes);
    const editor = pode(eu.permissoes, 'mural', 'editar');
    return ctx.banco.avisos
      .filter((a) => editor || !a.validoAte || a.validoAte >= ctx.hoje)
      .filter(
        (a) =>
          editor ||
          a.publico === 'todos' ||
          (a.publico === 'gestores' && gestor) ||
          (a.publico === 'bolsistas' && eu.tipo === 'bolsista') ||
          (a.publico === 'pessoas' && a.pessoasIds.includes(eu.id)),
      )
      .sort((a, b) => Number(b.fixado) - Number(a.fixado) || b.criadoEm.localeCompare(a.criadoEm));
  },
  'avisos.salvar': (a, ctx) => {
    if (!a.titulo.trim()) throw erro('TITULO', 'Informe o título do aviso.');
    const salvo = { ...a, id: a.id || novoId('a'), autorId: a.autorId || ctx.eu!.id, criadoEm: a.criadoEm || ctx.agora };
    const i = ctx.banco.avisos.findIndex((x) => x.id === salvo.id);
    if (i >= 0) ctx.banco.avisos[i] = salvo;
    else ctx.banco.avisos.unshift(salvo);
    registrar(ctx, 'aviso', salvo.id, i >= 0 ? 'alterou aviso' : 'publicou aviso');
    return salvo;
  },
  'avisos.confirmarLeitura': ({ avisoId }, ctx) => {
    const a = ctx.banco.avisos.find((x) => x.id === avisoId);
    if (a && !a.leituras.includes(ctx.eu!.id)) a.leituras.push(ctx.eu!.id);
    return null;
  },
  'notificacoes.listar': (_d, ctx) => ctx.banco.notificacoes.filter((n) => n.pessoaId === ctx.eu!.id),
  'notificacoes.marcarLidas': (_d, ctx) => {
    for (const n of ctx.banco.notificacoes) if (n.pessoaId === ctx.eu!.id) n.lida = true;
    return null;
  },
  'historico.listar': ({ entidade, entidadeId }, ctx) => {
    if (!ehGestor(ctx.eu!.permissoes)) throw SEM_PERMISSAO();
    return ctx.banco.historico.filter(
      (h) => (!entidade || h.entidade === entidade) && (!entidadeId || h.entidadeId.split(',').includes(entidadeId)),
    );
  },
  'config.obter': (_d, ctx) => ctx.banco.config,
  'config.salvar': (c, ctx) => {
    ctx.banco.config = c;
    registrar(ctx, 'config', 'geral', 'alterou configurações');
    return c;
  },
};

function novaOcorrencia(ctx: Contexto, dados: Omit<Ocorrencia, 'id' | 'numero' | 'historico'>): Ocorrencia {
  const numero = Math.max(0, ...ctx.banco.ocorrencias.map((o) => o.numero)) + 1;
  const o: Ocorrencia = { ...dados, id: novoId('oc'), numero, historico: [] };
  ctx.banco.ocorrencias.push(o);
  const responsaveis = ctx.banco.pessoas.filter((p) => p.ativo && pode(p.permissoes, 'infraestrutura', 'editar')).map((p) => p.id);
  notificar(ctx, responsaveis, `Nova ocorrência #${numero}: ${o.titulo} (${o.local}).`, `/infra/${o.id}`);
  return o;
}

function cancelarSessao(ctx: Contexto, sessaoId: Id, justificativa: string) {
  const s = ctx.banco.sessoes.find((x) => x.id === sessaoId);
  if (!s) throw erro('NAO_ENCONTRADO', 'Sessão não encontrada.');
  s.status = 'cancelada';
  const afetados: Id[] = [];
  for (const e of ctx.banco.escalas) {
    if (e.sessaoId !== sessaoId || e.status === 'cancelado') continue;
    if (e.loteId && ctx.banco.lotes.some((l) => l.id === e.loteId && l.status !== 'cancelado')) continue;
    e.status = 'cancelado';
    afetados.push(e.pessoaId);
  }
  notificar(ctx, afetados, `Sessão cancelada: ${nomeSessao(ctx, sessaoId)}. Você não precisa comparecer.`, '/minhas-escalas');
  registrar(ctx, 'sessao', sessaoId, 'cancelou a sessão', justificativa);
}

/** Copia profunda simples para que a tela nunca altere o banco por referência. */
const copiar = <T,>(v: T): T => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function criarMockCliente(opcoes: OpcoesMock = {}): ApiCliente & { restaurar(): void } {
  const latencia = opcoes.latenciaMs ?? 250;
  const hoje = opcoes.hoje ?? '2026-10-24';
  const arm = criarArmazenamento(opcoes.persistir ?? true, hoje);
  let token: string | null = null;

  return {
    definirToken(t) {
      token = t;
    },
    restaurar() {
      arm.restaurar();
    },
    async chamar<A extends Acao>(acao: A, dados: Entrada<A>): Promise<Saida<A>> {
      if (latencia > 0) await new Promise((r) => setTimeout(r, latencia));
      const eu = token ? arm.banco.pessoas.find((p) => `tok-${p.id}` === token && p.ativo) ?? null : null;
      const regra = REGRAS[acao];
      if (regra !== 'publica' && !eu) throw erro('SESSAO', 'Sua sessão expirou. Entre novamente.');
      const agora = `${hoje}T${new Date().toTimeString().slice(0, 5)}`;
      const ctx: Contexto = { banco: arm.banco, eu, hoje, agora };
      if (Array.isArray(regra)) exigir(ctx, regra[0], regra[1]);
      const resultado = (handlers[acao] as Handler<A>)(copiar(dados), ctx);
      arm.salvar();
      return copiar(resultado);
    },
  };
}
