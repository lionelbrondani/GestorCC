import { formatarDataHora, type Sessao } from '@shared';
import { useState } from 'react';
import { usePeriodo } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Carregando, Cartao, EstadoVazio, Etiqueta, Pagina } from '../../componentes';
import { agora, janela } from '../../util/hoje';
import { dataLonga, horarioTexto, tituloSessao } from '../../util/sessoes';
import './pessoal.css';

function SimNao({
  rotulo,
  valor,
  desabilitado,
  aoMarcar,
  salvo,
}: {
  rotulo: string;
  valor: boolean | undefined;
  desabilitado: boolean;
  aoMarcar: (v: boolean) => void;
  salvo: boolean;
}) {
  return (
    <div className="linha" role="group" aria-label={`Disponibilidade para ${rotulo}`}>
      {salvo && <span className="salvo">Salvo</span>}
      <div className="sim-nao">
        <button data-valor="sim" aria-pressed={valor === true} disabled={desabilitado} onClick={() => aoMarcar(true)}>
          Sim
        </button>
        <button data-valor="nao" aria-pressed={valor === false} disabled={desabilitado} onClick={() => aoMarcar(false)}>
          Não
        </button>
      </div>
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
  const marcar = useMutacao('disponibilidades.marcar', ['disponibilidades.listar']);
  const [salvos, setSalvos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  if (periodo.isLoading || rodadas.isLoading || disp.isLoading) return <Carregando />;

  const momento = agora();
  const minhaDisp = new Map((disp.data ?? []).filter((d) => d.pessoaId === eu.id).map((d) => [d.sessaoId, d.disponivel]));
  const jaEscalado = new Set((escalas.data ?? []).filter((e) => e.pessoaId === eu.id && e.status !== 'cancelado').map((e) => e.sessaoId));

  const convocacoes = periodo.sessoes.filter(
    (s) => s.status === 'ativa' && s.convocacao && s.convocacao.abertaAte >= momento && !jaEscalado.has(s.id),
  );
  const abertas = (rodadas.data ?? []).filter((r) => r.status === 'aberta');

  async function aoMarcar(s: Sessao, v: boolean) {
    setErro(null);
    try {
      await marcar.mutateAsync({ sessaoId: s.id, disponivel: v });
      setSalvos((atual) => new Set(atual).add(s.id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  function listaPorDia(sessoes: Sessao[], encerrada: boolean) {
    const porDia = new Map<string, Sessao[]>();
    for (const s of [...sessoes].sort((a, b) => a.data.localeCompare(b.data) || (a.chegada ?? '').localeCompare(b.chegada ?? ''))) {
      porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);
    }
    return [...porDia.entries()].map(([dia, lista]) => (
      <div key={dia} className="dia-grupo">
        <h3>{dataLonga(dia)}</h3>
        {lista.map((s) => {
          const ev = periodo.evento.get(s.eventoId);
          const titulo = tituloSessao(ev, s);
          return (
            <div key={s.id} className="disp-sessao">
              <div>
                <div className="negrito">
                  {titulo} {s.status === 'cancelada' && <Etiqueta tom="neutro">Cancelada</Etiqueta>}
                </div>
                <div className="pequeno texto-2">{horarioTexto(s)}</div>
              </div>
              <SimNao
                rotulo={titulo}
                valor={minhaDisp.get(s.id)}
                desabilitado={encerrada || s.status === 'cancelada'}
                aoMarcar={(v) => aoMarcar(s, v)}
                salvo={salvos.has(s.id)}
              />
            </div>
          );
        })}
      </div>
    ));
  }

  return (
    <Pagina titulo="Minha disponibilidade" subtitulo="Marque Sim nas sessões em que você pode trabalhar. Tudo é salvo na hora.">
      {erro && <Alerta tom="erro">{erro}</Alerta>}

      {convocacoes.length > 0 && (
        <Cartao destaque titulo="Precisamos de mais gente">
          <div className="pilha-2">
            {convocacoes.map((s) => (
              <p key={s.id} className="pequeno">
                {tituloSessao(periodo.evento.get(s.eventoId), s)}: +{s.convocacao!.vagas} vaga(s) — responda até{' '}
                {formatarDataHora(s.convocacao!.abertaAte)}
              </p>
            ))}
            <div className="pilha">{listaPorDia(convocacoes, false)}</div>
          </div>
        </Cartao>
      )}

      {abertas.length === 0 && convocacoes.length === 0 && (
        <EstadoVazio titulo="Nenhuma disponibilidade aberta agora" texto="Quando os gestores abrirem a rodada do próximo mês, ela aparece aqui." />
      )}

      {abertas.map((r) => {
        const encerrada = r.prazo < momento;
        const sessoes = periodo.sessoes.filter((s) => r.sessaoIds.includes(s.id));
        const respondidas = sessoes.filter((s) => minhaDisp.has(s.id)).length;
        return (
          <Cartao
            key={r.id}
            titulo={`Rodada ${r.nome}`}
            acoes={<Etiqueta tom={encerrada ? 'neutro' : 'destaque'}>{encerrada ? 'Encerrada' : `Até ${formatarDataHora(r.prazo)}`}</Etiqueta>}
          >
            <div className="pilha">
              {encerrada ? (
                <Alerta tom="aviso">Prazo encerrado em {formatarDataHora(r.prazo)}. Se precisar mudar algo, fale com um gestor.</Alerta>
              ) : (
                <p className="pequeno texto-2">
                  Você respondeu {respondidas} de {sessoes.length} sessões. Sem resposta conta como indisponível.
                </p>
              )}
              {listaPorDia(sessoes, encerrada)}
            </div>
          </Cartao>
        );
      })}
    </Pagina>
  );
}
