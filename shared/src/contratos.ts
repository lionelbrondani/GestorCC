import { diferencaDias, formatarData } from './datas';
import { formatarReais } from './dinheiro';
import type { Aditivo, Centavos, Config, Contratante, Contrato, DataISO } from './tipos';

export const OPCOES_STATUS: Record<'contrato' | 'fatura' | 'ecad' | 'iss' | 'fundep' | 'cortesias', string[]> = {
  contrato: ['Não enviado', 'Enviado', 'Enviado ao PEN-SIE', 'Assinado', 'Cancelado'],
  fatura: ['Não enviada p/ emissão', 'Enviada p/ emissão', 'Não paga', 'Paga', 'Isento'],
  ecad: ['Não enviado', 'Enviado p/ processamento', 'Não pago', 'Pago', 'Isento'],
  iss: ['Não enviado', 'Enviado p/ processamento', 'Não pago', 'Pago', 'Isento'],
  fundep: ['Não enviado', 'Enviado', 'Ok'],
  cortesias: ['Não recebidas', 'Recebidas', 'Distribuídas'],
};

export const AREAS_CEDIDAS = ['Hall de entrada', 'Mezanino', 'Plateia', 'Palco', 'Camarins'];

const EMAIL_CC = 'centrodeconvencoes@ufsm.br';

export function valorTotalContrato(c: Contrato, aditivos: Aditivo[]): Centavos {
  return c.valorBase + aditivos.filter((a) => a.contratoId === c.id).reduce((acc, a) => acc + a.valorDelta, 0);
}

export type AlertaContrato = 'faturaVencendo' | 'faturaVencida' | 'ecadIssPendente' | 'naoAssinado' | 'cortesiasPendentes';

const QUITADO = ['Paga', 'Pago', 'Isento'];

export function alertasContrato(c: Contrato, primeiraData: DataISO, hoje: DataISO): AlertaContrato[] {
  if (c.statusContrato === 'Cancelado') return [];
  const alertas: AlertaContrato[] = [];
  const diasFatura = diferencaDias(hoje, c.vencimento);
  const diasEvento = diferencaDias(hoje, primeiraData);
  const faturaAberta = !QUITADO.includes(c.statusFatura);

  if (faturaAberta && diasFatura >= 0 && diasFatura <= 7) alertas.push('faturaVencendo');
  if (faturaAberta && diasFatura < 0) alertas.push('faturaVencida');
  if (diasEvento >= 0 && diasEvento <= 5 && (!QUITADO.includes(c.statusEcad) || !QUITADO.includes(c.statusIss))) {
    alertas.push('ecadIssPendente');
  }
  if (c.statusContrato !== 'Assinado' && diasEvento >= 0 && diasEvento < 10) alertas.push('naoAssinado');
  if (c.statusCortesias === 'Não recebidas' && diasEvento >= 0 && diasEvento <= 1) alertas.push('cortesiasPendentes');
  return alertas;
}

export interface EmailFundep {
  assunto: string;
  destinatarios: string[];
  corpoTexto: string;
  corpoHtml: string;
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function montarEmailFundep(
  itens: { contrato: Contrato; contratante: Contratante; aditivo?: Aditivo }[],
  config: Config,
): EmailFundep {
  const abertura = [
    'Prezadas, bom dia!',
    'Solicitamos o cadastramento dos contratos/clientes abaixo para a emissão das faturas da taxa de locação do Centro de Convenções da UFSM.',
    `Seguem os dados abaixo. Favor emitir as referidas faturas assim que possível, e enviar ao e-mail do interessado com cópia para ${EMAIL_CC}.`,
  ];

  const blocos = itens.map(({ contrato, contratante: k, aditivo }) => {
    const titulo = aditivo
      ? `ADITIVO Nº ${aditivo.numero} AO CONTRATO Nº ${contrato.numero}:`
      : `CONTRATO Nº ${contrato.numero}:`;
    const rotuloDoc = k.documento.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ';
    const valor = aditivo ? aditivo.valorDelta : contrato.valorBase;
    const vencimento = aditivo?.novaData ?? contrato.vencimento;
    const linhas = [
      `${rotuloDoc}: ${k.documento} - ${k.razaoSocial}`,
      `Se CNPJ, Inscrição Municipal: ${k.inscricaoMunicipal}`,
      `Se CNPJ, Inscrição Estadual: ${k.inscricaoEstadual}`,
      `Endereço completo com CEP: ${k.endereco} - CEP: ${k.cep}.`,
      `Pessoa de contato para envio da Fatura: ${k.contatoFaturaNome}`,
      `E-mail: ${k.contatoFaturaEmail}, com cópia para ${EMAIL_CC}`,
      `Telefone: ${k.contatoFaturaTelefone}`,
    ];
    const linhaValor = { valor: formatarReais(valor), venc: formatarData(vencimento) };
    return { titulo, linhas, linhaValor };
  });

  const fechamento = ['Atenciosamente,', config.assinaturaEmail];

  const corpoTexto = [
    ...abertura,
    ...blocos.map(
      (b) => [b.titulo, ...b.linhas, `Valor: ${b.linhaValor.valor} com vencimento para dia ${b.linhaValor.venc}.`].join('\n'),
    ),
    ...fechamento,
  ].join('\n\n');

  const p = (s: string) => `<p>${s}</p>`;
  const corpoHtml = [
    ...abertura.map((s) => p(escaparHtml(s))),
    ...blocos.map((b) =>
      [
        p(`<b><u>${escaparHtml(b.titulo)}</u></b>`),
        ...b.linhas.map((l) => p(escaparHtml(l))),
        p(`<b>Valor: ${b.linhaValor.valor}</b> com vencimento para dia <b>${b.linhaValor.venc}</b>.`),
      ].join(''),
    ),
    ...fechamento.map((s) => p(escaparHtml(s).replace(/\n/g, '<br>'))),
  ].join('');

  return {
    assunto: `[${config.projetoFundep}] Cadastramento dos contratos/clientes para emissão de fatura`,
    destinatarios: config.destinatariosFundep,
    corpoTexto,
    corpoHtml,
  };
}
