import { somarDias, type Evento, type Sessao } from '@shared';
import type { EventoAgenda, QuandoAgenda } from '../nucleo/portas';

const DIA_MIN = 24 * 60;
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Do início ao fim; sem fim, dura 1 h; fim no mesmo horário ou antes do início cai no dia seguinte. */
function intervalo(dia: string, inicio: string, fim: string | null): QuandoAgenda {
  const ini = minutos(inicio);
  let fimMin = fim ? minutos(fim) : ini + 60;
  if (fimMin <= ini) fimMin += DIA_MIN;
  const diaFim = fimMin >= DIA_MIN ? somarDias(dia, 1) : dia;
  return { diaInteiro: false, inicio: `${dia}T${inicio}`, fim: `${diaFim}T${hora(fimMin % DIA_MIN)}` };
}

/**
 * Evento da sessão na agenda do setor (spec 7.11). A descrição leva organizador, responsável, chegada e link;
 * nunca o contato do organizador nem outros dados pessoais.
 */
export function eventoDaAgenda(
  evento: Evento,
  sessao: Sessao,
  o: { responsavel: string; linkApp: string | null; convidados: string[] },
): EventoAgenda {
  const cancelado = sessao.status === 'cancelada' || evento.status === 'cancelado';
  const inicio = sessao.inicio ?? sessao.chegada;
  const diaInteiro = sessao.horarioADefinir || !inicio;

  let titulo = sessao.rotulo ? `${evento.nome} – ${sessao.rotulo}` : evento.nome;
  if (cancelado) titulo = `CANCELADO – ${titulo}`;
  if (diaInteiro) titulo += ' (horário a definir)';

  const chegada = !sessao.horarioADefinir && sessao.chegada ? sessao.chegada : 'a definir';
  const descricao = [
    evento.organizador && `Organizador: ${evento.organizador}`,
    o.responsavel && `Servidor responsável: ${o.responsavel}`,
    `Chegada da equipe: ${chegada}`,
    o.linkApp && `Ver no GestorCC: ${o.linkApp}/agenda/${evento.id}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    titulo,
    descricao,
    quando: diaInteiro ? { diaInteiro: true, dia: sessao.data } : intervalo(sessao.data, inicio!, sessao.fim),
    convidados: o.convidados,
  };
}
