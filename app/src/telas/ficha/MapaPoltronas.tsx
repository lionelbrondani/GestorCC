import { lugar, lugaresDaFila, NOMES_TIPO_LUGAR, SETORES, type GrupoPoltronas, type SetorId, type SetorPlanta } from '@shared';
import { Minus, Plus } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { Abas, Botao } from '../../componentes';
import { alternar, contarPorSetor, intervaloNaFila } from './selecao';
import './mapa.css';

/** Cor de cada grupo, na ordem em que foram criados. */
export const CORES_GRUPOS = ['#2d5c8a', '#c2185b', '#2e7d4f', '#ef6c00', '#6a1b9a', '#00838f', '#8d6e63', '#455a64'];
export const corDoGrupo = (i: number) => CORES_GRUPOS[i % CORES_GRUPOS.length];

/** Tamanho da poltrona (px) em cada nível de zoom. */
const ZOOM = [12, 16, 20, 26, 32];
const doisDigitos = (n: number) => String(n).padStart(2, '0');

interface Props {
  grupos: GrupoPoltronas[];
  /** Grupo que recebe as marcações; sem `aoMudar`, o mapa é só para ver. */
  ativo?: number;
  aoMudar?: (grupos: GrupoPoltronas[]) => void;
  /** Os três setores juntos e pequenos, para imprimir. */
  impressao?: boolean;
}

interface PropsPlanta {
  setor: SetorPlanta;
  grupoDe: Map<string, number>;
  tamanho: number;
  aoTocar?: (id: string, intervalo: boolean) => void;
  aoTocarFila?: (fila: string) => void;
}

function Planta({ setor, grupoDe, tamanho, aoTocar, aoTocarFila }: PropsPlanta) {
  const letra = (f: string, lado: string) =>
    aoTocarFila ? (
      <button type="button" className="mapa-letra" data-lado={lado} onClick={() => aoTocarFila(f)} aria-label={`Fila ${f} inteira (${setor.nome})`}>
        {f}
      </button>
    ) : (
      <span className="mapa-letra" data-lado={lado}>
        {f}
      </span>
    );

  function poltrona(f: string, n: number) {
    const id = `${setor.id}:${f}${doisDigitos(n)}`;
    const l = lugar(id)!;
    const g = grupoDe.get(id);
    const comum = {
      className: 'mapa-lugar',
      'data-tipo': l.tipo,
      style: g !== undefined ? ({ '--cor': corDoGrupo(g) } as CSSProperties) : undefined,
      title: `${setor.nome} ${l.nome} · ${NOMES_TIPO_LUGAR[l.tipo]}`,
    };
    if (!aoTocar) {
      return (
        <span key={n} {...comum} data-marcado={g !== undefined || undefined}>
          {doisDigitos(n)}
        </span>
      );
    }
    return (
      <button key={n} type="button" {...comum} aria-pressed={g !== undefined} aria-label={`${l.nome}, ${NOMES_TIPO_LUGAR[l.tipo]}`} onClick={(e) => aoTocar(id, e.shiftKey)}>
        {doisDigitos(n)}
      </button>
    );
  }

  return (
    <div className="mapa-planta" style={{ '--tam': `${tamanho}px` } as CSSProperties}>
      <div className="mapa-palco">{setor.id === 'mezanino' ? 'MEZANINO · FRENTE' : 'PALCO'}</div>
      <div className="mapa-grade">
        {setor.filas.map((f) => (
          <div key={f.fila} className="mapa-fila" role="group" aria-label={`Fila ${f.fila}`}>
            {letra(f.fila, 'esq')}
            {f.blocos.map((bloco, b) => (
              <div key={b} className="mapa-bloco" data-bloco={b}>
                {bloco.map((trecho, t) => (
                  <div key={t} className="mapa-trecho">
                    {trecho.map((n) => poltrona(f.fila, n))}
                  </div>
                ))}
              </div>
            ))}
            {letra(f.fila, 'dir')}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendaTipos() {
  return (
    <ul className="mapa-legenda" aria-label="Legenda">
      {(['pne', 'mobilidade', 'obeso'] as const).map((t) => (
        <li key={t}>
          <span className="mapa-lugar" data-tipo={t} aria-hidden />
          {NOMES_TIPO_LUGAR[t]}
        </li>
      ))}
    </ul>
  );
}

export function MapaPoltronas({ grupos, ativo = 0, aoMudar, impressao }: Props) {
  const [setor, setSetor] = useState<SetorId>('baixa');
  const [zoom, setZoom] = useState(2);
  const ultimo = useRef<string | null>(null);
  const grupoDe = new Map<string, number>();
  grupos.forEach((g, i) => g.lugares.forEach((id) => grupoDe.set(id, i)));

  if (impressao) {
    return (
      <div className="mapa mapa-impressao">
        {SETORES.filter((s) => grupos.some((g) => g.lugares.some((id) => id.startsWith(`${s.id}:`)))).map((s) => (
          <section key={s.id}>
            <h3>{s.nome}</h3>
            <Planta setor={s} grupoDe={grupoDe} tamanho={13} />
          </section>
        ))}
        <LegendaTipos />
      </div>
    );
  }

  const edicao = aoMudar && {
    aoTocar(id: string, intervalo: boolean) {
      const ids = intervalo && ultimo.current ? intervaloNaFila(ultimo.current, id) : [id];
      ultimo.current = id;
      aoMudar(alternar(grupos, ativo, ids));
    },
    aoTocarFila: (f: string) => aoMudar(alternar(grupos, ativo, lugaresDaFila(setor, f))),
  };
  const contagem = contarPorSetor(grupos);

  return (
    <div className="mapa">
      <div className="mapa-topo">
        <Abas abas={SETORES.map((s) => ({ id: s.id, rotulo: contagem[s.id] ? `${s.nome} (${contagem[s.id]})` : s.nome }))} ativa={setor} aoMudar={setSetor} />
        <div className="linha">
          <Botao tamanho="pequeno" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Diminuir o mapa">
            <Minus size={16} aria-hidden />
          </Botao>
          <Botao tamanho="pequeno" onClick={() => setZoom((z) => Math.min(ZOOM.length - 1, z + 1))} disabled={zoom === ZOOM.length - 1} aria-label="Aumentar o mapa">
            <Plus size={16} aria-hidden />
          </Botao>
        </div>
      </div>
      <div className="mapa-rolagem">
        <Planta setor={SETORES.find((s) => s.id === setor)!} grupoDe={grupoDe} tamanho={ZOOM[zoom]} {...edicao} />
      </div>
      <LegendaTipos />
      {aoMudar && (
        <p className="pequeno texto-2" style={{ margin: 0 }}>
          Toque na poltrona para marcar ou desmarcar. Toque na letra para marcar a fila inteira. No computador, Shift+clique marca um trecho da fila.
        </p>
      )}
    </div>
  );
}
