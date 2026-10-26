import { descreverLugares, formatarData } from '@shared';
import { Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Botao, Carregando, EstadoVazio, Pagina } from '../../componentes';
import { janela } from '../../util/hoje';
import { eventoDaFicha } from './FichaTecnicaEvento';
import { corDoGrupo, MapaPoltronas } from './MapaPoltronas';
import { ResumoFicha } from './ResumoFicha';
import './ficha.css';

/** Resumo da ficha para a equipe (som, luz, recepção, bolsistas): página 1 com os dados, página 2 com o mapa. */
export function ImprimirFicha() {
  const { eventoId = '' } = useParams();
  const { de, ate } = janela(400, 400);
  const periodo = usePeriodo(de, ate);
  const ficha = useConsulta('fichas.obter', { eventoId });

  if (periodo.isLoading || ficha.isLoading) return <Carregando />;
  const evento = periodo.evento.get(eventoId);
  if (!evento || !ficha.data) {
    return <EstadoVazio titulo="Ficha técnica não encontrada" acao={<Link to={`/agenda/${eventoId}`}>Voltar para o evento</Link>} />;
  }
  const ev = eventoDaFicha(evento, periodo.sessoes.filter((s) => s.eventoId === eventoId));
  const d = ficha.data.dados;
  const comPoltronas = !!d.reservarPoltronas && d.grupos.some((g) => g.lugares.length);

  return (
    <Pagina
      titulo={`Ficha técnica: ${evento.nome}`}
      subtitulo={ev.sessoes.map((s) => formatarData(s.data)).join(', ')}
      acoes={
        <>
          <Link to={`/agenda/${eventoId}`} className="cc-botao" data-variante="secundario">
            Voltar
          </Link>
          <Botao variante="primario" onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Imprimir
          </Botao>
        </>
      }
    >
      <div className="folha-impressao ficha-impressa">
        <section className="pagina-impressao">
          <h1 className="so-impressao">Ficha técnica · {evento.nome}</h1>
          <ResumoFicha evento={ev} dados={d} />
        </section>
        {comPoltronas && (
          <section className="pagina-impressao ficha-pagina-mapa">
            <h2>Poltronas reservadas · {evento.nome}</h2>
            <ul className="ficha-lista-lugares">
              {d.grupos.map(
                (g, i) =>
                  g.lugares.length > 0 && (
                    <li key={i}>
                      <strong style={{ color: corDoGrupo(i) }}>{g.nome || `Grupo ${i + 1}`}</strong> ({g.lugares.length}): {descreverLugares(g.lugares)}
                    </li>
                  ),
              )}
            </ul>
            <MapaPoltronas grupos={d.grupos} impressao />
          </section>
        )}
      </div>
    </Pagina>
  );
}
