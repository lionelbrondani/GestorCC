import { diaDaSemanaCurto, diasDoMes, mesExtenso, somarDias, type Sessao } from '@shared';
import { hoje } from '../../util/hoje';

const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export type Resposta = boolean | undefined;

export function estadoTexto(v: Resposta): string {
  return v === true ? 'disponível' : v === false ? 'indisponível' : 'sem resposta';
}

/** Próximo valor ao tocar na sessão: sem resposta → Sim → Não → Sim… */
export function proximaResposta(v: Resposta): boolean {
  return v !== true;
}

export function CalendarioDisponibilidade({
  mes,
  sessoes,
  titulo,
  resposta,
  desabilitado,
  diaSelecionado,
  aoSelecionarDia,
  aoMarcar,
}: {
  mes: string;
  sessoes: Sessao[];
  titulo: (s: Sessao) => string;
  resposta: (sessaoId: string) => Resposta;
  desabilitado: boolean;
  diaSelecionado: string | null;
  aoSelecionarDia: (d: string) => void;
  aoMarcar: (s: Sessao, v: boolean) => void;
}) {
  const [ano, m] = mes.split('-').map(Number);
  const dias = diasDoMes(ano, m);
  const deslocamento = SEMANA.indexOf(diaDaSemanaCurto(dias[0]));
  const grade = Array.from({ length: Math.ceil((deslocamento + dias.length) / 7) * 7 }, (_, i) => somarDias(dias[0], i - deslocamento));

  return (
    <div className="disp-calendario" role="grid" aria-label={`Calendário de ${mesExtenso(m)}/${ano}`}>
      {SEMANA.map((d) => (
        <div key={d} className="disp-cabeca" aria-hidden>
          {d}
        </div>
      ))}
      {grade.map((d) => {
        const doDia = sessoes.filter((s) => s.data === d).sort((a, b) => (a.chegada ?? '99').localeCompare(b.chegada ?? '99'));
        const fora = !d.startsWith(mes);
        if (!doDia.length || fora) {
          return (
            <div key={d} className="disp-dia" data-fora={fora || undefined} data-vazio aria-hidden={fora || undefined}>
              <span className="disp-numero">{Number(d.slice(8, 10))}</span>
            </div>
          );
        }
        const pendentes = doDia.filter((s) => resposta(s.id) === undefined).length;
        return (
          <div
            key={d}
            className="disp-dia"
            data-selecionado={d === diaSelecionado || undefined}
            data-hoje={d === hoje() || undefined}
            onClick={() => aoSelecionarDia(d)}
          >
            <button
              type="button"
              className="disp-numero disp-numero-botao"
              aria-label={`Dia ${Number(d.slice(8, 10))}, ${doDia.length} sessão(ões)${pendentes ? `, ${pendentes} sem resposta` : ''}`}
              aria-pressed={d === diaSelecionado}
              onClick={(e) => {
                e.stopPropagation();
                aoSelecionarDia(d);
              }}
            >
              {Number(d.slice(8, 10))}
            </button>
            <div className="disp-chips">
              {doDia.map((s) => {
                const v = resposta(s.id);
                const nome = titulo(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="disp-chip"
                    data-estado={v === true ? 'sim' : v === false ? 'nao' : 'pendente'}
                    aria-label={`${nome}: ${estadoTexto(v)}`}
                    title={`${nome} · ${s.chegada ? `chegada ${s.chegada}` : 'horário a definir'} — toque para ${proximaResposta(v) ? 'marcar Sim' : 'marcar Não'}`}
                    disabled={desabilitado || s.status === 'cancelada'}
                    onClick={(e) => {
                      e.stopPropagation();
                      aoSelecionarDia(d);
                      aoMarcar(s, proximaResposta(v));
                    }}
                  >
                    <span className="disp-chip-marca" aria-hidden>
                      {v === true ? '✓' : v === false ? '✕' : '?'}
                    </span>
                    <span className="disp-chip-texto">
                      {s.chegada ? `${s.chegada} ` : ''}
                      {nome}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
