import { formatarDataHora, type Sessao } from '@shared';
import { useState } from 'react';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { TEXTO_ESTADO, useMarcacoes } from '../escalas/useMarcacoes';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Carregando, Cartao, EstadoVazio, Etiqueta, Pagina } from '../../componentes';
import { agora, janela } from '../../util/hoje';
import { dataLonga, horarioTexto, tituloSessao } from '../../util/sessoes';
import { CalendarioDisponibilidade, type Resposta } from './CalendarioDisponibilidade';
import './pessoal.css';

function SimNao({ rotulo, valor, desabilitado, aoMarcar }: { rotulo: string; valor: Resposta; desabilitado: boolean; aoMarcar: (v: boolean) => void }) {
  return (
    <div className="sim-nao" role="group" aria-label={`Disponibilidade para ${rotulo}`}>
      <button data-valor="sim" aria-pressed={valor === true} disabled={desabilitado} onClick={() => aoMarcar(true)}>
        Sim
      </button>
      <button data-valor="nao" aria-pressed={valor === false} disabled={desabilitado} onClick={() => aoMarcar(false)}>
        Não
      </button>
    </div>
  );
}

function Legenda() {
  return (
    <div className="disp-legenda pequeno texto-2" aria-hidden>
      <span>
        <i data-estado="sim" /> Sim
      </span>
      <span>
        <i data-estado="nao" /> Não
      </span>
      <span>
        <i data-estado="pendente" /> Sem resposta
      </span>
      <span className="so-desktop">Toque na sessão para alternar.</span>
      <span className="so-celular">Toque no dia para responder.</span>
    </div>
  );
}

export function MinhaDisponibilidade() {
  const eu = useEu();
  const { de, ate } = janela(30, 180);
  const periodo = usePeriodo(de, ate);
  const rodadas = useConsulta('rodadas.listar', null);
  const escalas = useConsulta('escalas.listar', { de, ate });
  const idsPeriodo = periodo.sessoes.map((s) => s.id);
  const disp = useConsulta('disponibilidades.listar', { sessaoIds: idsPeriodo });
  const marcacoes = useMarcacoes();
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  if (periodo.isLoading || rodadas.isLoading || disp.isLoading) return <Carregando />;

  const momento = agora();
  const doServidor = new Map((disp.data ?? []).filter((d) => d.pessoaId === eu.id).map((d) => [d.sessaoId, d.disponivel]));
  const resposta = (id: string): Resposta => marcacoes.valor(id, doServidor.get(id));
  const jaEscalado = new Set((escalas.data ?? []).filter((e) => e.pessoaId === eu.id && e.status !== 'cancelado').map((e) => e.sessaoId));
  const titulo = (s: Sessao) => tituloSessao(periodo.evento.get(s.eventoId), s);

  const convocacoes = periodo.sessoes.filter(
    (s) => s.status === 'ativa' && s.convocacao && s.convocacao.abertaAte >= momento && !jaEscalado.has(s.id),
  );
  const abertas = (rodadas.data ?? []).filter((r) => r.status === 'aberta');
  const novas = new Set(abertas.flatMap((r) => r.sessoesNovas ?? []));
  const novasDaRodada = (r: (typeof abertas)[number], sessoes: Sessao[]) =>
    sessoes.filter((s) => r.sessoesNovas?.includes(s.id) && s.status !== 'cancelada');

  /** Marca na hora; as marcações vão juntas para o servidor logo depois do último toque. */
  const aoMarcar = (s: Sessao, v: boolean) => marcacoes.marcar([{ sessaoId: s.id, disponivel: v }]);

  const linhaSessao = (s: Sessao, encerrada: boolean) => (
    <div key={s.id} className="disp-sessao">
      <div>
        <div className="negrito">
          {titulo(s)} {s.status === 'cancelada' && <Etiqueta tom="neutro">Cancelada</Etiqueta>}
          {novas.has(s.id) && s.status !== 'cancelada' && <Etiqueta tom="destaque">nova</Etiqueta>}
        </div>
        <div className="pequeno texto-2">{horarioTexto(s)}</div>
      </div>
      <SimNao rotulo={titulo(s)} valor={resposta(s.id)} desabilitado={encerrada || s.status === 'cancelada'} aoMarcar={(v) => aoMarcar(s, v)} />
    </div>
  );

  return (
    <Pagina titulo="Minha disponibilidade" subtitulo="Marque nos dias em que você pode trabalhar. Tudo é salvo na hora.">
      {marcacoes.erro && <Alerta tom="erro">{marcacoes.erro}</Alerta>}

      {convocacoes.length > 0 && (
        <Cartao destaque titulo="Precisamos de mais gente">
          <div className="pilha-2">
            {convocacoes.map((s) => (
              <div key={s.id} className="pilha-2">
                <p className="pequeno">
                  {dataLonga(s.data)} · +{s.convocacao!.vagas} vaga(s) — responda até {formatarDataHora(s.convocacao!.abertaAte)}
                </p>
                {linhaSessao(s, false)}
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {abertas.length === 0 && convocacoes.length === 0 && (
        <EstadoVazio titulo="Nenhuma disponibilidade aberta agora" texto="Quando os gestores abrirem a rodada do próximo mês, ela aparece aqui." />
      )}

      {abertas.map((r) => {
        const encerrada = r.prazo < momento;
        const sessoes = periodo.sessoes.filter((s) => r.sessaoIds.includes(s.id));
        const meses = [...new Set(sessoes.map((s) => s.data.slice(0, 7)))].sort();
        const respondidas = sessoes.filter((s) => resposta(s.id) !== undefined).length;
        const diasComSessao = [...new Set(sessoes.map((s) => s.data))].sort();
        const dia = diaSelecionado && diasComSessao.includes(diaSelecionado) ? diaSelecionado : diasComSessao[0];
        const doDia = sessoes.filter((s) => s.data === dia).sort((a, b) => (a.chegada ?? '99').localeCompare(b.chegada ?? '99'));
        return (
          <Cartao
            key={r.id}
            titulo={`Rodada ${r.nome}`}
            acoes={
              <>
                {TEXTO_ESTADO[marcacoes.estado] && <span className="salvo">{TEXTO_ESTADO[marcacoes.estado]}</span>}
                <Etiqueta tom={encerrada ? 'neutro' : 'destaque'}>{encerrada ? 'Encerrada' : `Até ${formatarDataHora(r.prazo)}`}</Etiqueta>
              </>
            }
          >
            <div className="pilha">
              {encerrada ? (
                <Alerta tom="aviso">Prazo encerrado em {formatarDataHora(r.prazo)}. Se precisar mudar algo, fale com um gestor.</Alerta>
              ) : (
                <p className="pequeno texto-2">
                  Você respondeu {respondidas} de {sessoes.length} sessões. Sem resposta conta como indisponível.
                </p>
              )}
              {!encerrada && novasDaRodada(r, sessoes).length > 0 && (
                <Alerta tom="info">
                  <Etiqueta tom="destaque">nova</Etiqueta> Entraram depois da abertura:{' '}
                  {novasDaRodada(r, sessoes).map((s) => `${titulo(s)} (${s.data.slice(8, 10)}/${s.data.slice(5, 7)})`).join(', ')}.
                </Alerta>
              )}
              <Legenda />
              {meses.map((mes) => (
                <CalendarioDisponibilidade
                  key={mes}
                  mes={mes}
                  sessoes={sessoes.filter((s) => s.data.startsWith(mes))}
                  titulo={titulo}
                  resposta={resposta}
                  desabilitado={encerrada}
                  diaSelecionado={dia ?? null}
                  aoSelecionarDia={setDiaSelecionado}
                  aoMarcar={aoMarcar}
                />
              ))}
              {dia && (
                <div className="disp-painel-dia">
                  <h3>{dataLonga(dia)}</h3>
                  {doDia.map((s) => linhaSessao(s, encerrada))}
                </div>
              )}
            </div>
          </Cartao>
        );
      })}
    </Pagina>
  );
}
