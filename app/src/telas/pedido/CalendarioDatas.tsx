import { diasDoMes, formatarData, mesExtenso, situacaoDoDia, type DataISO, type SituacaoDia } from '@shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Botao } from '../../componentes';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** 'AAAA-MM' mais n meses. */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Primeiro e último dia do mês 'AAAA-MM'. */
export function limitesDoMes(mes: string): { de: DataISO; ate: DataISO } {
  const dias = diasDoMes(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)));
  return { de: dias[0], ate: dias.at(-1)! };
}

/**
 * Calendário de um mês com a situação de cada dia (livre, ocupado, bloqueado) e os escolhidos.
 * Enquanto a situação não chega, os dias ficam desativados (e o rótulo não diz a situação).
 */
export function CalendarioDatas({
  mes,
  aoMudarMes,
  ocupados,
  bloqueados,
  escolhidos = new Set(),
  minimo,
  carregando,
  aoEscolher,
}: {
  mes: string;
  aoMudarMes: (mes: string) => void;
  ocupados: Set<DataISO>;
  bloqueados: Set<DataISO>;
  escolhidos?: Set<DataISO>;
  /** Dias antes deste não podem ser escolhidos (e não dá para voltar a meses anteriores). */
  minimo?: DataISO;
  carregando?: boolean;
  aoEscolher: (data: DataISO, situacao: SituacaoDia) => void;
}) {
  const [ano, m] = mes.split('-').map(Number);
  const dias = diasDoMes(ano, m);
  const brancos = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const nome = mesExtenso(m);
  return (
    <div className="calendario-datas">
      <div className="calendario-datas-topo">
        <Botao tamanho="pequeno" variante="fantasma" aria-label="Mês anterior" disabled={!!minimo && mes <= minimo.slice(0, 7)} onClick={() => aoMudarMes(somarMeses(mes, -1))}>
          <ChevronLeft size={18} />
        </Botao>
        <h3>
          {nome.charAt(0) + nome.slice(1).toLowerCase()} de {ano}
        </h3>
        <Botao tamanho="pequeno" variante="fantasma" aria-label="Próximo mês" onClick={() => aoMudarMes(somarMeses(mes, 1))}>
          <ChevronRight size={18} />
        </Botao>
      </div>
      <div className="calendario-datas-grade">
        {SEMANA.map((s, i) => (
          <span key={`s${i}`} className="calendario-datas-semana" aria-hidden>
            {s}
          </span>
        ))}
        {Array.from({ length: brancos }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {dias.map((d) => {
          const situacao = situacaoDoDia(d, ocupados, bloqueados);
          const escolhido = escolhidos.has(d);
          const passado = !!minimo && d < minimo;
          return (
            <button
              key={d}
              type="button"
              className="calendario-datas-dia"
              data-situacao={carregando ? undefined : situacao}
              data-escolhido={escolhido || undefined}
              disabled={passado || carregando}
              aria-label={carregando ? formatarData(d) : `${formatarData(d)}, ${situacao}${escolhido ? ', escolhido' : ''}`}
              onClick={() => aoEscolher(d, situacao)}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="calendario-datas-legenda pequeno texto-2" aria-hidden>
        <span data-situacao="livre">Livre</span>
        <span data-situacao="ocupado">Ocupado</span>
        <span data-situacao="bloqueado">Bloqueado</span>
        <span data-escolhido>Escolhido</span>
      </div>
    </div>
  );
}
