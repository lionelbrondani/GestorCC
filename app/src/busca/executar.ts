import {
  alertasContrato,
  diasEmAberto,
  ROTULO_STATUS_OCORRENCIA,
  STATUS_ABERTOS,
  contaNaEscala,
  estoqueCritico,
  formatarData,
  formatarReais,
  somarDias,
  type DataISO,
} from '@shared';
import type { ApiCliente } from '../api/cliente';
import { semAcento } from './buscaComum';
import type { Consulta } from './interpretarSimulado';

export interface RespostaBusca {
  titulo: string;
  itens: { texto: string; detalhe?: string; link: string }[];
  vazio?: string;
}

const nomeSessao = (ev: { nome: string } | undefined, rotulo?: string) => `${ev?.nome ?? 'Evento'}${rotulo ? ` – ${rotulo}` : ''}`;

/** Executa a consulta com as permissões de quem pergunta. Nenhum dado é enviado a serviços externos. */
export async function executarConsulta(c: Consulta, api: ApiCliente, hoje: DataISO): Promise<RespostaBusca> {
  try {
    switch (c.nome) {
      case 'escalaDoDia': {
        const { eventos, sessoes } = await api.chamar('eventos.listar', { de: c.data, ate: c.data });
        const escalas = await api.chamar('escalas.listar', { de: c.data, ate: c.data });
        const pessoas = await api.chamar('pessoas.listar', null);
        const nome = (id: string) => pessoas.find((p) => p.id === id)?.nomeCurto ?? '—';
        return {
          titulo: `Escala de ${formatarData(c.data)}`,
          itens: sessoes
            .filter((s) => s.status === 'ativa')
            .map((s) => {
              const daSessao = escalas.filter((e) => e.sessaoId === s.id && contaNaEscala(e) && e.status !== 'rascunho');
              return {
                texto: `${nomeSessao(eventos.find((e) => e.id === s.eventoId), s.rotulo)} · chegada ${s.chegada ?? 'a definir'}`,
                detalhe: daSessao.length ? daSessao.map((e) => nome(e.pessoaId)).join(', ') : 'Ninguém escalado ainda.',
                link: `/agenda/${s.eventoId}`,
              };
            }),
          vazio: `Nenhuma sessão em ${formatarData(c.data)}.`,
        };
      }
      case 'escalasDaPessoa': {
        const pessoas = await api.chamar('pessoas.listar', null);
        const alvo = pessoas.find((p) => semAcento(`${p.nome} ${p.nomeCurto}`).includes(semAcento(c.termo)));
        if (!alvo) return { titulo: 'Escalas', itens: [], vazio: `Não encontrei ninguém com "${c.termo}".` };
        const ate = somarDias(hoje, 90);
        const { eventos, sessoes } = await api.chamar('eventos.listar', { de: hoje, ate });
        const escalas = (await api.chamar('escalas.listar', { de: hoje, ate })).filter((e) => e.pessoaId === alvo.id && contaNaEscala(e));
        return {
          titulo: `Próximas escalas de ${alvo.nome}`,
          itens: escalas.map((e) => {
            const s = sessoes.find((x) => x.id === e.sessaoId)!;
            return { texto: nomeSessao(eventos.find((x) => x.id === s.eventoId), s.rotulo), detalhe: `${formatarData(s.data)} · chegada ${s.chegada ?? 'a definir'}`, link: `/agenda/${s.eventoId}` };
          }),
          vazio: 'Nenhuma escala nos próximos 90 dias.',
        };
      }
      case 'proximosEventos': {
        const { eventos, sessoes } = await api.chamar('eventos.listar', { de: hoje, ate: somarDias(hoje, 7) });
        return {
          titulo: 'Próximos 7 dias',
          itens: sessoes
            .filter((s) => s.status === 'ativa')
            .sort((a, b) => a.data.localeCompare(b.data))
            .map((s) => ({ texto: nomeSessao(eventos.find((e) => e.id === s.eventoId), s.rotulo), detalhe: formatarData(s.data), link: `/agenda/${s.eventoId}` })),
          vazio: 'Nada marcado para os próximos 7 dias.',
        };
      }
      case 'vagasFaltando': {
        const ate = somarDias(hoje, 60);
        const { eventos, sessoes } = await api.chamar('eventos.listar', { de: hoje, ate });
        const escalas = await api.chamar('escalas.listar', { de: hoje, ate });
        return {
          titulo: 'Sessões publicadas com vagas abertas',
          itens: sessoes
            .filter((s) => s.status === 'ativa' && s.publicadaEm)
            .map((s) => ({ s, n: escalas.filter((e) => e.sessaoId === s.id && e.papel === 'bolsista' && contaNaEscala(e)).length }))
            .filter(({ s, n }) => n < s.vagasBolsistas)
            .map(({ s, n }) => ({ texto: nomeSessao(eventos.find((e) => e.id === s.eventoId), s.rotulo), detalhe: `${formatarData(s.data)} · ${n}/${s.vagasBolsistas} bolsistas`, link: '/escalas?aba=publicadas' })),
          vazio: 'Todas as sessões publicadas estão completas.',
        };
      }
      case 'naoResponderam': {
        const rodada = (await api.chamar('rodadas.listar', null)).find((r) => r.status === 'aberta');
        if (!rodada) return { titulo: 'Disponibilidade', itens: [], vazio: 'Não há rodada de disponibilidade aberta.' };
        const disp = await api.chamar('disponibilidades.listar', { sessaoIds: rodada.sessaoIds });
        const pessoas = (await api.chamar('pessoas.listar', null)).filter((p) => p.ativo);
        const responderam = new Set(disp.map((d) => d.pessoaId));
        return {
          titulo: `Ainda não responderam (${rodada.nome})`,
          itens: pessoas.filter((p) => !responderam.has(p.id)).map((p) => ({ texto: p.nome, link: '/escalas?aba=rodadas' })),
          vazio: 'Todos já responderam.',
        };
      }
      case 'saldoItem': {
        const { itens } = await api.chamar('almox.listar', null);
        return {
          titulo: `Estoque: "${c.termo}"`,
          itens: itens
            .filter((i) => i.status === 'Ativo' && semAcento(`${i.nomeComum} ${i.nomeAlmox} ${i.cod}`).includes(semAcento(c.termo)))
            .map((i) => ({ texto: i.nomeComum || i.nomeAlmox, detalhe: `Saldo ${i.saldo} ${i.unidade} · mínimo ${i.qtdMinima}${estoqueCritico(i) ? ' · crítico' : ''}`, link: '/almox?aba=estoque' })),
          vazio: `Não encontrei item com "${c.termo}".`,
        };
      }
      case 'estoqueCritico': {
        const { itens } = await api.chamar('almox.listar', null);
        return {
          titulo: 'Itens no estoque mínimo',
          itens: itens.filter(estoqueCritico).map((i) => ({ texto: i.nomeComum || i.nomeAlmox, detalhe: `Saldo ${i.saldo} · mínimo ${i.qtdMinima}`, link: '/almox?aba=pedidos' })),
          vazio: 'Nenhum item no mínimo.',
        };
      }
      case 'contratosPendentes': {
        const { contratos } = await api.chamar('contratos.listar', null);
        const { eventos, sessoes } = await api.chamar('eventos.listar', { de: somarDias(hoje, -400), ate: somarDias(hoje, 400) });
        return {
          titulo: 'Contratos com pendência',
          itens: contratos
            .map((c2) => ({ c2, alertas: alertasContrato(c2, sessoes.filter((s) => s.eventoId === c2.eventoId).map((s) => s.data).sort()[0] ?? '9999-12-31', hoje) }))
            .filter((x) => x.alertas.length)
            .map(({ c2, alertas }) => ({ texto: `Contrato ${c2.numero} · ${eventos.find((e) => e.id === c2.eventoId)?.nome ?? ''}`, detalhe: alertas.join(', '), link: `/contratos/${c2.id}` })),
          vazio: 'Nenhum contrato com pendência.',
        };
      }
      case 'ocorrenciasAbertas': {
        const lista = (await api.chamar('infra.listar', null)).filter(
          (o) => STATUS_ABERTOS.includes(o.status) && (!c.termo || semAcento(`${o.titulo} ${o.descricao} ${o.categoria}`).includes(semAcento(c.termo))),
        );
        return {
          titulo: c.termo ? `Ocorrências abertas: "${c.termo}"` : 'Ocorrências de infraestrutura abertas',
          itens: lista.map((o) => ({
            texto: `#${o.numero} ${o.titulo}`,
            detalhe: `${o.local} · ${ROTULO_STATUS_OCORRENCIA[o.status]}${o.chamadoNumero ? ` · chamado ${o.chamadoNumero}` : ''} · ${diasEmAberto(o, hoje)} dia(s)`,
            link: `/infra/${o.id}`,
          })),
          vazio: 'Nenhuma ocorrência aberta com esse termo.',
        };
      }
      case 'lotesEmAberto': {
        const { lotes, itens } = await api.chamar('lotes.listar', null);
        return {
          titulo: 'Lotes aguardando pagamento',
          itens: lotes
            .filter((l) => l.status === 'enviado')
            .map((l) => ({ texto: l.titulo, detalhe: formatarReais(itens.filter((i) => i.loteId === l.id).reduce((a, i) => a + i.valor, 0)), link: `/pagamentos/${l.id}` })),
          vazio: 'Nenhum lote em aberto.',
        };
      }
    }
  } catch {
    return { titulo: 'Sem acesso', itens: [], vazio: 'Você não tem acesso a esta informação.' };
  }
}
