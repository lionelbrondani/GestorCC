import { agendaDoMes, diaDaSemanaCurto, diasDoMes, formatarData, horarioSessao, mesExtenso, rotuloDiaAgenda, type Evento, type LinhaAgendaMes, type Sessao } from '@shared';
import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Botao, Carregando } from '../../componentes';
import { hoje } from '../../util/hoje';
import { mesCurto } from '../../util/sessoes';
import { CabecalhoImpresso, SeletorModelo, useModelo } from '../impressao/ModeloImpressao';
import './agenda.css';

interface Base {
  dias: string[];
  doDia: (d: string) => { sessoes: Sessao[]; eventos: Evento[] };
  feriado: Map<string, string>;
  responsavel: (e: Evento) => string;
  mes: number;
  ano: number;
}

function AgendaLegado({ linhas, mes, ano }: { linhas: LinhaAgendaMes[]; mes: number; ano: number }) {
  return (
    <div className="folha-impressao agenda-impressa">
      <h1>
        {mesExtenso(mes)}/{ano}
      </h1>
      <table>
        <thead>
          <tr>
            <th>DIA</th>
            <th>EVENTO</th>
            <th>RESPONSÁVEL</th>
            <th>RESP NUGAC</th>
            <th>HORÁRIO</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ dia, feriado, eventos, horarios }) => {
            if (feriado !== null && eventos.length === 0) {
              return (
                <tr key={dia} className="feriado">
                  <td>{rotuloDiaAgenda(dia)}</td>
                  <td colSpan={4}>FERIADO{feriado ? ` – ${feriado}` : ''}</td>
                </tr>
              );
            }
            return (
              <tr key={dia}>
                <td>{rotuloDiaAgenda(dia)}</td>
                <td>
                  {eventos.map((e, i) => (
                    <div key={i}>{e.nome}</div>
                  ))}
                </td>
                <td>
                  {eventos.map((e, i) => (
                    <div key={i}>{e.responsavel}</div>
                  ))}
                </td>
                <td>
                  {eventos.map((e, i) => (
                    <div key={i}>{e.respNugac}</div>
                  ))}
                </td>
                <td>
                  {horarios.map((h, i) => (
                    <div key={i}>{h}</div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgendaAtualizada({ dias, doDia, feriado, responsavel, mes, ano }: Base) {
  const semanas: string[][] = [];
  for (const d of dias) {
    if (!semanas.length || diaDaSemanaCurto(d) === 'DOM') semanas.push([]);
    semanas[semanas.length - 1].push(d);
  }
  const totalEventos = new Set(dias.flatMap((d) => doDia(d).eventos.map((e) => e.id))).size;

  return (
    <div className="impresso impresso-retrato">
      <CabecalhoImpresso titulo="AGENDA DO CENTRO DE CONVENÇÕES" subtitulo={`${mesExtenso(mes)}/${ano} · ${totalEventos} eventos`} />
      {semanas.map((semana) => {
        const comAlgo = semana.filter((d) => doDia(d).eventos.length > 0 || feriado.has(d));
        if (!comAlgo.length) return null;
        return (
          <section key={semana[0]} className="impresso-semana" data-testid="semana">
            <h2 className="semana-titulo">
              Semana de {formatarData(semana[0]).slice(0, 5)} a {formatarData(semana[semana.length - 1]).slice(0, 5)}
            </h2>
            {comAlgo.map((d) => {
              const { sessoes, eventos } = doDia(d);
              return (
                <div key={d} data-testid={`dia-${d}`}>
                  {feriado.has(d) && (
                    <p className="impresso-feriado">
                      {formatarData(d).slice(0, 5)} · Feriado: {feriado.get(d)}
                    </p>
                  )}
                  {eventos.map((e) => (
                    <section key={e.id} className="impresso-bloco">
                      <div className="impresso-data">
                        <small>{diaDaSemanaCurto(d)}</small>
                        <strong>{d.slice(8, 10)}</strong>
                        <small>
                          {mesCurto(d)}
                        </small>
                      </div>
                      <div>
                        <h2>{e.nome}</h2>
                        <p className="impresso-meta">
                          {sessoes
                            .filter((s) => s.eventoId === e.id)
                            .map((s) => horarioSessao(s))
                            .join(' · ')}
                        </p>
                        <p className="impresso-meta">
                          Organização: <strong>{e.organizador || '—'}</strong>
                          {e.contatoOrganizador ? ` (${e.contatoOrganizador})` : ''} · Responsável CC: <strong>{responsavel(e) || '—'}</strong>
                        </p>
                      </div>
                    </section>
                  ))}
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="impresso-rodape">Gerado pelo GestorCC em {formatarData(hoje())}</p>
    </div>
  );
}

export function ImprimirAgenda() {
  const [params] = useSearchParams();
  const [modelo, setModelo] = useModelo();
  const mesParam = params.get('mes') ?? hoje().slice(0, 7);
  const [ano, m] = mesParam.split('-').map(Number);
  const dias = diasDoMes(ano, m);
  const periodo = usePeriodo(dias[0], dias[dias.length - 1]);
  const feriados = useConsulta('feriados.listar', { ano });
  const pessoas = usePessoas();

  if (periodo.isLoading || feriados.isLoading) return <Carregando />;

  const base: Base = {
    dias,
    mes: m,
    ano,
    feriado: new Map((feriados.data ?? []).map((f) => [f.data, f.nome])),
    doDia: (d) => {
      const sessoes = periodo.sessoes.filter((s) => s.data === d && s.status === 'ativa');
      const eventos = [...new Set(sessoes.map((s) => s.eventoId))].map((id) => periodo.evento.get(id)!).filter((e) => e?.status === 'ativo');
      return { sessoes, eventos };
    },
    responsavel: (e) => (e.servidorResponsavelId && pessoas.pessoa.get(e.servidorResponsavelId)?.nome.split(' ')[0]) || '',
  };

  return (
    <div className="pilha">
      <SeletorModelo modelo={modelo} aoMudar={setModelo} />
      <div className="linha nao-imprimir">
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </Botao>
        <span className="texto-2 pequeno">
          {modelo === 'legado' ? 'Modelo legado: um dia por linha, como a planilha.' : 'Modelo atualizado: só os dias com evento, por semana.'} A4 retrato;
          escolha "Salvar como PDF" se preferir.
        </span>
      </div>
      {modelo === 'legado' ? (
        <AgendaLegado
          mes={m}
          ano={ano}
          linhas={agendaDoMes(ano, m, {
            eventos: periodo.eventos,
            sessoes: periodo.sessoes,
            feriados: feriados.data ?? [],
            nomeServidor: (id) => pessoas.pessoa.get(id)?.nome ?? '',
          })}
        />
      ) : (
        <AgendaAtualizada {...base} />
      )}
    </div>
  );
}
