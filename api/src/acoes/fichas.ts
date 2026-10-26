import {
  ErroApi,
  errosDaFicha,
  fichaTravada,
  fichaVazia,
  formatarData,
  limparFicha,
  MAX_ANEXOS_FICHA,
  prazoDaFicha,
  type AnexoFicha,
  type FichaPublica,
  type FichaResumo,
  type FichaTecnica,
  type FichaTecnicaDados,
  type TravaFicha,
} from '@shared';
import { paraBase64Url } from '../auth/bytes';
import { exigirVersao, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { linhasEventos, linhasSessoes, type LinhaEvento, type LinhaSessao } from './eventos';
import { configAtual } from './sistema';

/** Ficha do evento (id = id do evento). Os dados sigilosos do responsável ficam em `fichasSigilo`. */
interface LinhaFicha {
  id: string;
  status: FichaTecnica['status'];
  trava: TravaFicha;
  dados: FichaTecnicaDados | null;
  enviadaEm: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/** Na planilha Sigiloso: a chave do link e CPF/CNPJ, e-mail e telefone do responsável. */
interface LinhaSigilo {
  id: string;
  token: string;
  documento: string;
  email: string;
  telefone: string;
}

const SEM_LINK = () => new ErroApi('LINK', 'Este link não vale mais. Peça um novo ao Centro de Convenções.');
const TRAVAS: TravaFicha[] = ['auto', 'travada', 'destravada'];
/** PDF, imagem ou Word, até ~10 MB (o arquivo chega em base64, que ocupa 4/3 do tamanho). */
const TIPOS_ANEXO = /^data:(application\/pdf|image\/(png|jpeg|webp)|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,/;
const MAX_ANEXO_BASE64 = 14_000_000;

const linhasFichas = (ctx: Contexto) => ctx.portas.repo.listar<LinhaFicha>('fichas');
const linhasSigilo = (ctx: Contexto) => ctx.portas.repo.listar<LinhaSigilo>('fichasSigilo');
const novoToken = (ctx: Contexto) => paraBase64Url(ctx.portas.cripto.aleatorio(32));
const nomeDe = (ctx: Contexto) => (id: string) =>
  ctx.portas.repo.listar<{ id: string; nome: string }>('pessoas').find((p) => p.id === id)?.nome ?? 'Outra pessoa';

function sessoesAtivas(ctx: Contexto, eventoId: string): LinhaSessao[] {
  return linhasSessoes(ctx)
    .filter((s) => s.eventoId === eventoId && s.status === 'ativa')
    .sort((a, b) => a.data.localeCompare(b.data) || (a.inicio ?? '').localeCompare(b.inicio ?? ''));
}

interface Contexto_ {
  linha: LinhaFicha;
  sigilo: LinhaSigilo;
  evento: LinhaEvento;
  sessoes: LinhaSessao[];
}

/** Junta a ficha com o sigilo e acerta as linhas de horário às sessões atuais do evento. */
function montar(ctx: Contexto, f: Contexto_): FichaTecnica {
  const bruto = f.linha.dados ?? fichaVazia(f.sessoes);
  const dados = limparFicha({ ...bruto, responsavel: { ...bruto.responsavel, documento: f.sigilo.documento, email: f.sigilo.email, telefone: f.sigilo.telefone } }, f.sessoes);
  const prazo = prazoDaFicha(f.sessoes.map((s) => s.data));
  return {
    eventoId: f.linha.id, status: f.linha.status, trava: f.linha.trava, travada: fichaTravada({ trava: f.linha.trava, prazo, hoje: ctx.portas.relogio.hoje() }),
    prazo, enviadaEm: f.linha.enviadaEm, atualizadoEm: f.linha.atualizadoEm, token: f.sigilo.token, dados,
  };
}

function publica(ctx: Contexto, f: Contexto_): FichaPublica {
  const m = montar(ctx, f);
  return {
    evento: { nome: f.evento.nome, sessoes: f.sessoes.map((s) => ({ id: s.id, data: s.data, rotulo: s.rotulo ?? '', inicio: s.inicio || null, fim: s.fim || null })) },
    status: m.status, travada: m.travada, prazo: m.prazo, enviadaEm: m.enviadaEm, dados: m.dados,
    linkFolder: configAtual(ctx).linksFormularios.find((l) => /folder/i.test(l.nome))?.url ?? '',
  };
}

function doEvento(ctx: Contexto, eventoId: string): Contexto_ | null {
  const evento = linhasEventos(ctx).find((e) => e.id === eventoId);
  if (!evento) throw new ErroApi('NAO_ENCONTRADO', 'Evento não encontrado.');
  const linha = linhasFichas(ctx).find((f) => f.id === eventoId);
  const sigilo = linhasSigilo(ctx).find((s) => s.id === eventoId);
  return linha && sigilo ? { linha, sigilo, evento, sessoes: sessoesAtivas(ctx, eventoId) } : null;
}

function doEventoOuErro(ctx: Contexto, eventoId: string): Contexto_ {
  const f = doEvento(ctx, eventoId);
  if (!f) throw new ErroApi('NAO_ENCONTRADO', 'Gere o link da ficha técnica primeiro.');
  return f;
}

function porToken(ctx: Contexto, token: unknown): Contexto_ {
  if (typeof token !== 'string' || token.length < 20) throw SEM_LINK();
  const sigilo = linhasSigilo(ctx).find((s) => s.token === token);
  const linha = sigilo && linhasFichas(ctx).find((f) => f.id === sigilo.id);
  const evento = sigilo && linhasEventos(ctx).find((e) => e.id === sigilo.id);
  if (!sigilo || !linha || !evento) throw SEM_LINK();
  if (evento.status === 'cancelado') throw new ErroApi('LINK', 'Este evento foi cancelado.');
  return { linha, sigilo, evento, sessoes: sessoesAtivas(ctx, evento.id) };
}

/** Grava separando o sigilo; anexos só os que já estavam na ficha (o produtor não aponta para arquivos alheios). */
function gravar(ctx: Contexto, f: Contexto_, dados: FichaTecnicaDados, extra: Partial<Pick<LinhaFicha, 'status' | 'enviadaEm' | 'trava'>> = {}, anexosNovos?: AnexoFicha[]) {
  const anteriores = montar(ctx, f).dados.anexos;
  const anexos = anexosNovos ?? dados.anexos.filter((a) => anteriores.some((x) => x.id === a.id));
  const { documento, email, telefone } = dados.responsavel;
  const { atualizadoPor: _p, ...linha } = f.linha;
  ctx.portas.repo.atualizar('fichas', { ...linha, ...extra, dados: { ...dados, anexos, responsavel: { ...dados.responsavel, documento: '', email: '', telefone: '' } } });
  ctx.portas.repo.atualizar('fichasSigilo', { ...f.sigilo, documento, email, telefone });
}

function exigirAberta(ctx: Contexto, f: Contexto_) {
  const m = montar(ctx, f);
  if (m.travada) throw new ErroApi('TRAVADA', `O prazo da ficha terminou (${m.prazo ? formatarData(m.prazo) : 'evento sem data'}). Fale com o Centro de Convenções para alterar.`);
}

export const handlersFichas: Handlers = {
  'fichas.listar': (_d, ctx) => {
    const sigilos = new Map(linhasSigilo(ctx).map((x) => [x.id, x]));
    const eventos = new Map(linhasEventos(ctx).map((e) => [e.id, e]));
    const lista: FichaResumo[] = [];
    for (const linha of linhasFichas(ctx)) {
      const sigilo = sigilos.get(linha.id);
      const evento = eventos.get(linha.id);
      if (!sigilo || !evento) continue;
      const sessoes = sessoesAtivas(ctx, evento.id);
      const f = montar(ctx, { linha, sigilo, evento, sessoes });
      const d = f.dados;
      lista.push({
        eventoId: evento.id, evento: evento.nome, eventoCancelado: evento.status === 'cancelado', datas: sessoes.map((s) => s.data),
        status: f.status, travada: f.travada, prazo: f.prazo, enviadaEm: f.enviadaEm, atualizadoEm: f.atualizadoEm, token: f.token,
        responsavel: d.responsavel.nome, tipo: d.tipo === 'Outro' ? d.tipoOutro : d.tipo, publico: d.publico, elenco: d.elenco,
        poltronas: d.reservarPoltronas ? d.grupos.reduce((n, g) => n + g.lugares.length, 0) : 0,
        camarins: d.camarinsIndividuais.length + d.camarinsColetivos.length, coffeeBreak: d.coffeeBreak,
      });
    }
    const primeira = (f: FichaResumo) => f.datas[0] ?? '9999';
    return lista.sort((a, b) => primeira(a).localeCompare(primeira(b)) || a.evento.localeCompare(b.evento));
  },

  'fichas.obter': ({ eventoId }, ctx) => {
    const f = doEvento(ctx, eventoId);
    return f ? montar(ctx, f) : null;
  },

  'fichas.link': ({ eventoId, novo }, ctx) => {
    const atual = doEvento(ctx, eventoId);
    if (!atual) {
      const sessoes = sessoesAtivas(ctx, eventoId);
      ctx.portas.repo.inserir('fichas', { id: eventoId, status: 'rascunho', trava: 'auto', dados: fichaVazia(sessoes), enviadaEm: '' });
      ctx.portas.repo.inserir('fichasSigilo', { id: eventoId, token: novoToken(ctx), documento: '', email: '', telefone: '' });
      registrar(ctx, 'evento', eventoId, 'gerou o link da ficha técnica', null, null);
    } else if (novo) {
      ctx.portas.repo.atualizar('fichasSigilo', { ...atual.sigilo, token: novoToken(ctx) });
      registrar(ctx, 'evento', eventoId, 'gerou um novo link da ficha técnica (o anterior deixou de valer)', null, null);
    }
    return montar(ctx, doEventoOuErro(ctx, eventoId));
  },

  'fichas.salvar': ({ eventoId, dados, versao }, ctx) => {
    const f = doEventoOuErro(ctx, eventoId);
    exigirVersao(f.linha, versao, nomeDe(ctx));
    gravar(ctx, f, limparFicha(dados, f.sessoes));
    registrar(ctx, 'evento', eventoId, 'corrigiu a ficha técnica', null, null);
    return montar(ctx, doEventoOuErro(ctx, eventoId));
  },

  'fichas.travar': ({ eventoId, trava }, ctx) => {
    if (!TRAVAS.includes(trava)) throw new ErroApi('VALIDACAO', 'Trava inválida.');
    const f = doEventoOuErro(ctx, eventoId);
    const { atualizadoPor: _p, ...linha } = f.linha;
    ctx.portas.repo.atualizar('fichas', { ...linha, trava });
    registrar(ctx, 'evento', eventoId, trava === 'auto' ? 'voltou a ficha técnica ao prazo automático' : `${trava === 'travada' ? 'travou' : 'destravou'} a ficha técnica`, null, null);
    return montar(ctx, doEventoOuErro(ctx, eventoId));
  },

  'fichas.anexo': ({ eventoId, anexoId }, ctx) => {
    const f = doEventoOuErro(ctx, eventoId);
    return montar(ctx, f).dados.anexos.some((a) => a.id === anexoId) ? ctx.portas.arquivos.lerImagem(anexoId) : null;
  },

  'ficha.abrir': ({ token }, ctx) => publica(ctx, porToken(ctx, token)),

  'ficha.salvar': ({ token, dados, enviar }, ctx) => {
    const f = porToken(ctx, token);
    exigirAberta(ctx, f);
    const limpa = limparFicha(dados, f.sessoes);
    if (enviar) {
      const erros = errosDaFicha(limpa, f.sessoes);
      if (erros.length) {
        const n = erros.length;
        throw new ErroApi('FICHA_INCOMPLETA', `Faltam ${n} ${n === 1 ? 'item' : 'itens'}: ${erros.slice(0, 5).map((e) => e.mensagem).join(' ')}`);
      }
    }
    gravar(ctx, f, limpa, enviar ? { status: 'enviada', enviadaEm: ctx.portas.relogio.agora() } : {});
    return publica(ctx, porToken(ctx, token));
  },

  'ficha.anexar': ({ token, nome, arquivo }, ctx) => {
    const f = porToken(ctx, token);
    exigirAberta(ctx, f);
    const atuais = montar(ctx, f).dados;
    if (atuais.anexos.length >= MAX_ANEXOS_FICHA) throw new ErroApi('ARQUIVO', `Limite de ${MAX_ANEXOS_FICHA} arquivos por ficha.`);
    if (typeof arquivo !== 'string' || !TIPOS_ANEXO.test(arquivo) || arquivo.length > MAX_ANEXO_BASE64) {
      throw new ErroApi('ARQUIVO', 'Envie PDF, imagem ou documento do Word de até 10 MB.');
    }
    const anexo = { id: '', nome: String(nome ?? 'arquivo').slice(0, 120) };
    anexo.id = ctx.portas.arquivos.salvarImagem(arquivo, `${f.evento.nome} - ${anexo.nome}`, 'Fichas técnicas');
    gravar(ctx, f, atuais, {}, [...atuais.anexos, anexo]);
    return anexo;
  },
};
