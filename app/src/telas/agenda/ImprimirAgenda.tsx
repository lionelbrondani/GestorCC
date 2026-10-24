import { diaDaSemana, diaDaSemanaCurto, diasDoMes, formatarData, mesExtenso, type Evento, type Sessao } from '@shared';
import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Botao, Carregando } from '../../componentes';
import { hoje } from '../../util/hoje';
import { mesCurto } from '../../util/sessoes';
import { CabecalhoImpresso, SeletorModelo, useModelo } from '../impressao/ModeloImpressao';
import './agenda.css';

function rotuloDia(d: string): string {
  const dia = diaDaSemana(d);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${d.slice(8, 10)}`;
}

function horario(s: Sessao): string {
  const h = s.horarioADefinir || !s.inicio ? 'a definir' : s.fim ? `${s.inicio} - ${s.fim}` : s.inicio;
  return s.rotulo ? `${s.rotulo}: ${h}` : h;
}

interface Base {
  dias: string[];
  doDia: (d: string) => { sessoes: Sessao[]; eventos: Evento[] };
  feriado: Map<string, string>;
  responsavel: (e: Evento) => string;
  mes: number;
  ano: number;
}

function AgendaLegado({ dias, doDia, feriado, responsavel, mes, ano }: Base) {
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
          {dias.map((d) => {
            const { sessoes, eventos } = doDia(d);
            if (feriado.has(d) && eventos.length === 0) {
              return (
                <tr key={d} className="feriado">
                  <td>{rotuloDia(d)}</td>
                  <td colSpan={4}>FERIADO{feriado.get(d) ? ` – ${feriado.get(d)}` : ''}</td>
                </tr>
              );
            }
            return (
              <tr key={d}>
                <td>{rotuloDia(d)}</td>
                <td>
                  {eventos.map((e) => (
                    <div key={e.id}>{e.nome}</div>
                  ))}
                </td>
                <td>
                  {eventos.map((e) => (
                    <div key={e.id}>
                      {e.organizador}
                      {e.contatoOrganizador ? ` / ${e.contatoOrganizador}` : ''}
                    </div>
                  ))}
                </td>
                <td>
                  {eventos.map((e) => (
                    <div key={e.id}>{responsavel(e)}</div>
                  ))}
                </td>
                <td>
                  {sessoes.map((s) => (
                    <div key={s.id}>{horario(s)}</div>
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
                            .map((s) => horario(s))
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
      {modelo === 'legado' ? <AgendaLegado {...base} /> : <AgendaAtualizada {...base} />}
    </div>
  );
}
