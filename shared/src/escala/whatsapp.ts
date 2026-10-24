import { diaDaSemana, formatarData, formatarDataHora } from '../datas';
import type { Evento, Rodada, Sessao } from '../tipos';

function tituloSessao(evento: Evento, sessao: Sessao): string {
  return sessao.rotulo ? `${evento.nome} – ${sessao.rotulo}` : evento.nome;
}

function dataComDia(sessao: Sessao): string {
  return `${formatarData(sessao.data)} (${diaDaSemana(sessao.data)})`;
}

export function textoWhatsappSessao(evento: Evento, sessao: Sessao, servidores: string[], bolsistas: string[]): string {
  const lista = (nomes: string[]) => nomes.map((n) => `- ${n}`).join('\n');
  const blocoServidores = servidores.length ? `Servidor(es) responsável(is):\n${lista(servidores)}\n\n` : '';
  const blocoBolsistas = `Bolsistas escalados:\n${bolsistas.length ? lista(bolsistas) : '- (Nenhum bolsista escalado)'}`;
  const comparecer = sessao.chegada
    ? `Vocês deverão comparecer ao Centro de Convenções às ${sessao.chegada}.`
    : 'Vocês deverão comparecer ao Centro de Convenções em horário a definir.';
  return (
    `Olá pessoal, segue a escala do dia ${dataComDia(sessao)} - ${tituloSessao(evento, sessao)}\n\n` +
    `${blocoServidores}${blocoBolsistas}\n\n${comparecer}`
  );
}

export function textoWhatsappIndividual(nome: string, itens: { evento: Evento; sessao: Sessao }[]): string {
  const blocos = itens
    .map(
      ({ evento, sessao }) =>
        `📌 *${tituloSessao(evento, sessao)}*\n🗓️ Data: ${dataComDia(sessao)}\n⏰ Chegada CC: ${sessao.chegada ?? 'a definir'}\n\n`,
    )
    .join('');
  const corpo = itens.length ? blocos : 'Você não tem escalas neste período.\n\n';
  return `Olá *${nome}*, segue a sua escala de eventos:\n\n${corpo}Por favor, confirme o recebimento desta mensagem! ✅`;
}

export function textoConvocacao(evento: Evento, sessao: Sessao, vagas: number, abertaAte: string): string {
  const chegada = sessao.chegada ? `chegada às ${sessao.chegada}` : 'horário a definir';
  return (
    `Precisamos de mais ${vagas} bolsista(s) para *${tituloSessao(evento, sessao)}* em ${dataComDia(sessao)}, ${chegada}. ` +
    `Quem puder, marque disponibilidade no GestorCC até ${formatarDataHora(abertaAte)}.`
  );
}

export function textoLembreteRodada(rodada: Rodada, faltam: string[]): string {
  return (
    `Lembrete: a disponibilidade de *${rodada.nome}* fecha em ${formatarDataHora(rodada.prazo)}. ` +
    `Ainda faltam responder: ${faltam.join(', ')}.`
  );
}

export function linkWhatsapp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
