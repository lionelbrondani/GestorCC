import { ErroApi, formatarData, formatarReais, horarioSessao, valorTotalContrato, type Aditivo, type Contratante, type Contrato } from '@shared';
import { exigirVersao, novoId, registrar, type Contexto, type Handlers } from '../nucleo/roteador';
import { marcarRelatorios } from '../relatorios/pendentes';
import { linhasEventos, linhasSessoes, paraSessao } from './eventos';

export type LinhaContrato = Omit<Contrato, 'areas'> & { areas: string[] | null; pdfAssinadoId: string; pdfFaturaId: string; atualizadoEm?: string; atualizadoPor?: string };
export type LinhaAditivo = Aditivo & { numeroFatura?: string };
type LinhaContratante = Contratante;

export const linhasContratos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaContrato>('contratos');
export const linhasAditivos = (ctx: Contexto) => ctx.portas.repo.listar<LinhaAditivo>('aditivos');
export const linhasContratantes = (ctx: Contexto) => ctx.portas.repo.listar<LinhaContratante>('contratantes');

export function paraContrato(l: LinhaContrato): Contrato {
  const { pdfAssinadoId, pdfFaturaId, atualizadoPor: _p, ...c } = l;
  return {
    ...c, valorBase: Number(c.valorBase), cortesiasQtd: Number(c.cortesiasQtd), areas: c.areas ?? [], fichaTecnicaRecebida: !!c.fichaTecnicaRecebida,
    pdfAssinado: !!pdfAssinadoId, pdfFatura: !!pdfFaturaId,
  };
}
const paraAditivo = (a: LinhaAditivo): Aditivo => ({
  id: a.id, contratoId: a.contratoId, numero: Number(a.numero), data: a.data, descricao: a.descricao, valorDelta: Number(a.valorDelta),
  novaData: a.novaData || null, statusFatura: a.statusFatura,
});

/** Ano do contrato: o da primeira sessão do evento; sem sessões, o ano corrente. */
function anoDoEvento(ctx: Contexto, eventoId: string): string {
  const datas = linhasSessoes(ctx).filter((s) => s.eventoId === eventoId).map((s) => s.data).sort();
  return (datas[0] ?? ctx.portas.relogio.hoje()).slice(0, 4);
}

/** Próximo número 'N/AAAA' do ano, a partir do maior já usado (spec 9.2). */
function proximoNumero(ctx: Contexto, ano: string): string {
  const usados = linhasContratos(ctx).map((c) => /^(\d+)\/(\d{4})$/.exec(c.numero)).filter((m) => m && m[2] === ano).map((m) => Number(m![1]));
  return `${Math.max(0, ...usados) + 1}/${ano}`;
}

/** Nome de cada modelo na pasta GestorCC/Modelos (spec 9.6). */
const MODELOS = { contrato: 'Modelo - Contrato', termo: 'Modelo - Termo de autorização', piano: 'Modelo - Empréstimo do piano' } as const;

function contratoOuErro(ctx: Contexto, id: string): LinhaContrato {
  const c = linhasContratos(ctx).find((x) => x.id === id);
  if (!c) throw new ErroApi('NAO_ENCONTRADO', 'Contrato não encontrado.');
  return c;
}

const nomeDe = (ctx: Contexto) => (id: string) =>
  ctx.portas.repo.listar<{ id: string; nome: string }>('pessoas').find((p) => p.id === id)?.nome ?? 'Outra pessoa';
const marcarContratos = (ctx: Contexto) => marcarRelatorios(ctx.portas.props, ['contratos']);

export const handlersContratos: Handlers = {
  'contratos.listar': (_d, ctx) => ({
    contratos: linhasContratos(ctx).map(paraContrato),
    aditivos: linhasAditivos(ctx).map(paraAditivo),
    contratantes: linhasContratantes(ctx),
  }),

  'contratos.salvar': (c, ctx) => {
    if (!linhasEventos(ctx).some((e) => e.id === c.eventoId)) throw new ErroApi('NAO_ENCONTRADO', 'Evento não encontrado.');
    if (!linhasContratantes(ctx).some((k) => k.id === c.contratanteId)) throw new ErroApi('NAO_ENCONTRADO', 'Contratante não encontrado.');
    if (c.statusContrato === 'Cancelado' && !c.canceladoMotivo?.trim()) throw new ErroApi('MOTIVO', 'Informe o motivo do cancelamento.');
    const anterior = c.id ? linhasContratos(ctx).find((x) => x.id === c.id) : undefined;
    if (c.id && !anterior) throw new ErroApi('NAO_ENCONTRADO', 'Contrato não encontrado.');
    if (anterior) exigirVersao(anterior, c.atualizadoEm, nomeDe(ctx));

    const numero = c.numero?.trim() || anterior?.numero || proximoNumero(ctx, anoDoEvento(ctx, c.eventoId));
    if (linhasContratos(ctx).some((x) => x.numero === numero && x.id !== anterior?.id)) {
      throw new ErroApi('NUMERO_REPETIDO', `Já existe o contrato ${numero}.`);
    }
    const id = anterior?.id ?? novoId(ctx.portas, 'c');
    const { atualizadoEm: _a, pdfAssinado: _pa, pdfFatura: _pf, ...dados } = c;
    const linha: LinhaContrato = {
      ...dados, id, numero, areas: c.areas ?? [], canceladoMotivo: c.canceladoMotivo?.trim() ?? '', observacoes: c.observacoes ?? '',
      pdfAssinadoId: anterior?.pdfAssinadoId ?? '', pdfFaturaId: anterior?.pdfFaturaId ?? '',
    };
    if (anterior) ctx.portas.repo.atualizar('contratos', linha);
    else ctx.portas.repo.inserir('contratos', linha);
    registrar(ctx, 'contrato', id, anterior ? 'alterou contrato' : 'criou contrato', null, { numero, statusContrato: linha.statusContrato });
    marcarContratos(ctx);
    return paraContrato(linhasContratos(ctx).find((x) => x.id === id)!);
  },

  'contratos.salvarAditivo': (ad, ctx) => {
    const contrato = linhasContratos(ctx).find((x) => x.id === ad.contratoId);
    if (!contrato) throw new ErroApi('NAO_ENCONTRADO', 'Contrato não encontrado.');
    const anterior = ad.id ? linhasAditivos(ctx).find((x) => x.id === ad.id) : undefined;
    if (!anterior && contrato.statusContrato === 'Cancelado') throw new ErroApi('CONTRATO_CANCELADO', 'Este contrato foi cancelado e não recebe aditivos.');
    const numero = anterior?.numero ?? Math.max(0, ...linhasAditivos(ctx).filter((a) => a.contratoId === ad.contratoId).map((a) => Number(a.numero))) + 1;
    const linha: LinhaAditivo = {
      id: anterior?.id ?? novoId(ctx.portas, 'ad'), contratoId: ad.contratoId, numero, data: ad.data, descricao: ad.descricao?.trim() ?? '',
      valorDelta: Number(ad.valorDelta) || 0, novaData: ad.novaData ?? null, statusFatura: ad.statusFatura,
    };
    if (anterior) ctx.portas.repo.atualizar('aditivos', linha);
    else ctx.portas.repo.inserir('aditivos', linha);
    registrar(ctx, 'contrato', ad.contratoId, anterior ? `alterou o aditivo nº ${numero}` : `registrou o aditivo nº ${numero}`, null, null);
    marcarContratos(ctx);
    return paraAditivo(linha);
  },

  'contratos.anexar': ({ contratoId, tipo, arquivo }, ctx) => {
    const c = contratoOuErro(ctx, contratoId);
    if (!arquivo?.startsWith('data:application/pdf')) throw new ErroApi('ARQUIVO', 'Envie o arquivo em PDF.');
    const nome = `Contrato ${c.numero.replace('/', '-')} - ${tipo === 'assinado' ? 'assinado' : 'fatura'}`;
    const id = ctx.portas.arquivos.salvarImagem(arquivo, nome, 'Contratos');
    const { atualizadoPor: _p, ...linha } = c;
    ctx.portas.repo.atualizar('contratos', { ...linha, [tipo === 'assinado' ? 'pdfAssinadoId' : 'pdfFaturaId']: id });
    registrar(ctx, 'contrato', c.id, tipo === 'assinado' ? 'anexou o contrato assinado' : 'anexou a fatura', null, null);
    return paraContrato(contratoOuErro(ctx, contratoId));
  },

  'contratos.anexo': ({ contratoId, tipo }, ctx) => {
    const c = contratoOuErro(ctx, contratoId);
    const id = tipo === 'assinado' ? c.pdfAssinadoId : c.pdfFaturaId;
    return id ? ctx.portas.arquivos.lerImagem(id) : null;
  },

  'documentos.gerar': ({ contratoId, tipo }, ctx) => {
    const c = paraContrato(contratoOuErro(ctx, contratoId));
    const evento = linhasEventos(ctx).find((e) => e.id === c.eventoId);
    const k = linhasContratantes(ctx).find((x) => x.id === c.contratanteId);
    const sessoes = linhasSessoes(ctx).filter((s) => s.eventoId === c.eventoId && s.status === 'ativa').sort((a, b) => a.data.localeCompare(b.data));
    const aditivos = linhasAditivos(ctx).map(paraAditivo);
    const campos: Record<string, string> = {
      NUMERO: c.numero, PROCESSO: c.processoPen, EVENTO: evento?.nome ?? '',
      DATAS: sessoes.map((s) => formatarData(s.data)).join(', '),
      HORARIOS: sessoes.map((s) => `${formatarData(s.data).slice(0, 5)}: ${horarioSessao(paraSessao(s))}`).join('; '),
      CONTRATANTE: k?.razaoSocial ?? '', DOCUMENTO: k?.documento ?? '', ENDERECO: k?.endereco ?? '', CEP: k?.cep ?? '',
      REPRESENTANTE: k?.representanteNome ?? '', EMAIL: k?.email ?? '',
      VALOR: formatarReais(valorTotalContrato(c, aditivos)), VALOR_EXTENSO: '', VENCIMENTO: c.vencimento ? formatarData(c.vencimento) : '',
      AREAS: c.areas.join(', '), CORTESIAS: String(c.cortesiasQtd), INGRESSO_SOLIDARIO: c.ingressoSolidario, OBSERVACOES: c.observacoes,
      HOJE: formatarData(ctx.portas.relogio.hoje()),
    };
    const modelo = MODELOS[tipo];
    const nome = `${modelo.replace('Modelo - ', '')} ${c.numero.replace('/', '-')} - ${evento?.nome ?? ''}`.trim();
    const r = ctx.portas.documentos.gerar(modelo, campos, nome);
    registrar(ctx, 'contrato', c.id, `gerou o documento: ${modelo.replace('Modelo - ', '')}`, null, null);
    return r;
  },

  'contratantes.salvar': (k, ctx) => {
    if (!k.razaoSocial?.trim()) throw new ErroApi('RAZAO_SOCIAL', 'Informe a razão social ou o nome do contratante.');
    const anterior = k.id ? linhasContratantes(ctx).find((x) => x.id === k.id) : undefined;
    const linha: LinhaContratante = { ...k, id: anterior?.id ?? novoId(ctx.portas, 'k'), razaoSocial: k.razaoSocial.trim() };
    if (anterior) ctx.portas.repo.atualizar('contratantes', linha);
    else ctx.portas.repo.inserir('contratantes', linha);
    // o histórico não guarda os dados do contratante (planilha sigilosa)
    registrar(ctx, 'contratante', linha.id, anterior ? 'alterou contratante' : 'cadastrou contratante', null, null);
    marcarContratos(ctx);
    return linha;
  },
};
