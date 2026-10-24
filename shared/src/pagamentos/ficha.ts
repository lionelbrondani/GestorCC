import { formatarData } from '../datas';
import type { Centavos, DadosPessoais, Lote, LoteItem, Pessoa } from '../tipos';
import type { BasePagamentos } from './lotes';

export function mascararCpf(cpf: string): string {
  const so = cpf.replace(/\D/g, '');
  if (so.length !== 11) return cpf ? '***.***.***-**' : '';
  return `***.***.${so.slice(6, 9)}-**`;
}

export interface LinhaFicha {
  ordem: number;
  nome: string;
  matricula: string;
  cpf: string;
  banco: string;
  agencia: string;
  conta: string;
  valor: Centavos;
}

export interface Ficha {
  titulo: 'FICHA DE INDICAÇÃO DE BOLSISTAS';
  periodoReferencia: string;
  iniciativaEdital: string;
  linhas: LinhaFicha[];
  total: Centavos;
  textoEncaminhamento: string;
  discriminacao: { nome: string; eventos: string }[];
  observacao: string;
}

export function montarFicha(params: {
  lote: Lote;
  itens: LoteItem[];
  pessoas: Pessoa[];
  dados: DadosPessoais[];
  base: BasePagamentos;
  mascarar: boolean;
}): Ficha {
  const { lote, pessoas, dados, base, mascarar } = params;
  const itens = params.itens.filter((i) => i.loteId === lote.id);
  const valorDe = (id: string) => itens.filter((i) => i.pessoaId === id).reduce((acc, i) => acc + i.valor, 0);

  const incluidas = pessoas
    .filter((p) => p.tipo === 'bolsista' && (p.ativo || valorDe(p.id) > 0))
    .filter((p) => lote.incluirZerados || valorDe(p.id) > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  const linhas: LinhaFicha[] = incluidas.map((p, i) => {
    const d = dados.find((x) => x.pessoaId === p.id);
    return {
      ordem: i + 1,
      nome: p.nome,
      matricula: p.matricula,
      cpf: d ? (mascarar ? mascararCpf(d.cpf) : d.cpf) : '',
      banco: d ? (mascarar ? '***' : d.banco) : '',
      agencia: d ? (mascarar ? '***' : d.agencia) : '',
      conta: d ? (mascarar ? '***' : d.conta) : '',
      valor: valorDe(p.id),
    };
  });

  const discriminacao = incluidas.map((p) => {
    const eventos = itens
      .filter((i) => i.pessoaId === p.id)
      .map((i) => base.escalas.find((e) => e.id === i.escalaId))
      .map((e) => e && base.sessoes.find((s) => s.id === e.sessaoId))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((s) => {
        const ev = base.eventos.find((x) => x.id === s.eventoId);
        const nome = ev ? (s.rotulo ? `${ev.nome} – ${s.rotulo}` : ev.nome) : 'Evento';
        return `${nome} (${formatarData(s.data)})`;
      })
      .join(', ');
    return { nome: p.nome, eventos };
  });

  return {
    titulo: 'FICHA DE INDICAÇÃO DE BOLSISTAS',
    periodoReferencia: lote.periodoReferencia,
    iniciativaEdital: `Iniciativa: ${lote.iniciativa} - ${lote.edital}.`,
    linhas,
    total: linhas.reduce((acc, l) => acc + l.valor, 0),
    textoEncaminhamento:
      `Segue em anexo a ficha de indicação referente ao pagamento dos bolsistas que atuaram nos eventos do CC ` +
      `no período de ${lote.periodoReferencia} - ${lote.edital} - PRE.`,
    discriminacao,
    observacao: `O recurso sairá da ${lote.iniciativa}.`,
  };
}
