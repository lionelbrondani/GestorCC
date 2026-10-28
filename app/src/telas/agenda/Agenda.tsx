import { diasDoMes, ehApoio, mesExtenso, pode, somarDias, TIPOS_EVENTO, diaDaSemanaCurto } from '@shared';
import { ChevronLeft, ChevronRight, Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Abas, Botao, Carregando, Etiqueta, Pagina, Tabela } from '../../componentes';
import { hoje } from '../../util/hoje';
import { dataLonga, horarioTexto, tituloSessao } from '../../util/sessoes';
import { CartaoAgendaSetor } from '../pessoal/AgendaGoogle';
import { Estatisticas } from './Estatisticas';
import './agenda.css';

const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function Agenda() {
  const eu = useEu();
  const navegar = useNavigate();
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [aba, setAba] = useState<'mes' | 'lista' | 'estatisticas'>('mes');
  const [tipo, setTipo] = useState('');
  const [ano, m] = mes.split('-').map(Number);
  const dias = diasDoMes(ano, m);
  const inicioGrade = somarDias(dias[0], -SEMANA.indexOf(diaDaSemanaCurto(dias[0])));
  const grade = Array.from({ length: Math.ceil((SEMANA.indexOf(diaDaSemanaCurto(dias[0])) + dias.length) / 7) * 7 }, (_, i) => somarDias(inicioGrade, i));
  const periodo = usePeriodo(grade[0], grade[grade.length - 1]);
  const feriados = useConsulta('feriados.listar', { ano });

  const feriado = new Map((feriados.data ?? []).map((f) => [f.data, f.nome]));
  const sessoes = periodo.sessoes
    .filter((s) => !tipo || periodo.evento.get(s.eventoId)?.tipo === tipo)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.chegada ?? '').localeCompare(b.chegada ?? ''));

  return (
    <Pagina
      titulo="Agenda"
      subtitulo="Eventos e sessões do Centro de Convenções."
      acoes={
        <>
          <Link to={`/agenda/imprimir?mes=${mes}`} className="cc-botao" data-variante="secundario">
            <Printer size={16} aria-hidden /> Imprimir agenda do mês
          </Link>
          {pode(eu.permissoes, 'eventos', 'editar') && (
            <Botao variante="primario" onClick={() => navegar('/agenda/novo')}>
              <Plus size={16} aria-hidden /> Novo evento
            </Botao>
          )}
        </>
      }
    >
      <CartaoAgendaSetor />
      <Abas
        abas={[
          { id: 'mes', rotulo: 'Mês' },
          { id: 'lista', rotulo: 'Lista' },
          { id: 'estatisticas', rotulo: 'Estatísticas' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'estatisticas' ? (
        <Estatisticas />
      ) : (
        <>
          <div className="linha-entre">
            <div className="linha">
              <Botao variante="fantasma" tamanho="pequeno" onClick={() => setMes(moverMes(mes, -1))} aria-label="Mês anterior">
                <ChevronLeft size={18} />
              </Botao>
              <h2 style={{ minWidth: 180, textAlign: 'center' }}>
                {mesExtenso(m)} {ano}
              </h2>
              <Botao variante="fantasma" tamanho="pequeno" onClick={() => setMes(moverMes(mes, 1))} aria-label="Próximo mês">
                <ChevronRight size={18} />
              </Botao>
            </div>
            <select className="cc-entrada" style={{ width: 'auto' }} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Filtrar por tipo">
              <option value="">Todos os tipos</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {periodo.isLoading ? (
            <Carregando />
          ) : aba === 'mes' ? (
            <div className="calendario" role="grid" aria-label={`Calendário de ${mesExtenso(m)}`}>
              {SEMANA.map((d) => (
                <div key={d} className="calendario-cabeca">
                  {d}
                </div>
              ))}
              {grade.map((d) => (
                <div key={d} className="calendario-dia" data-fora={!d.startsWith(mes) || undefined} data-hoje={d === hoje() || undefined}>
                  <span className="calendario-numero">{Number(d.slice(8, 10))}</span>
                  {feriado.has(d) && <span className="calendario-feriado">{feriado.get(d)}</span>}
                  {sessoes
                    .filter((s) => s.data === d)
                    .map((s) => {
                      const ev = periodo.evento.get(s.eventoId);
                      return (
                        <Link
                          key={s.id}
                          to={`/agenda/${s.eventoId}`}
                          className="calendario-evento"
                          data-cancelado={s.status === 'cancelada' || undefined}
                          data-externo={ev?.pagamento === 'externo' || undefined}
                          title={`${tituloSessao(ev, s)} · ${horarioTexto(s)}`}
                          data-apoio={ehApoio(s) || undefined}
                        >
                          {s.chegada ? `${s.chegada} ` : ''}
                          {tituloSessao(ev, s)}
                        </Link>
                      );
                    })}
                </div>
              ))}
            </div>
          ) : (
            <Tabela
              colunas={[
                { chave: 'data', titulo: 'Data', render: (s) => dataLonga(s.data) },
                {
                  chave: 'evento',
                  titulo: 'Evento',
                  render: (s) => (
                    <span className="negrito">
                      {tituloSessao(periodo.evento.get(s.eventoId), s)}
                    </span>
                  ),
                },
                { chave: 'horario', titulo: 'Horário', render: (s) => horarioTexto(s) },
                { chave: 'tipo', titulo: 'Tipo', render: (s) => periodo.evento.get(s.eventoId)?.tipo },
                {
                  chave: 'status',
                  titulo: '',
                  render: (s) =>
                    s.status === 'cancelada' ? <Etiqueta tom="erro">Cancelada</Etiqueta> : periodo.evento.get(s.eventoId)?.pagamento === 'externo' ? <Etiqueta tom="info">Externo</Etiqueta> : null,
                },
              ]}
              linhas={sessoes.filter((s) => s.data.startsWith(mes))}
              chaveLinha={(s) => s.id}
              aoClicar={(s) => navegar(`/agenda/${s.eventoId}`)}
              vazio="Nenhum evento neste mês."
            />
          )}
        </>
      )}
    </Pagina>
  );
}
