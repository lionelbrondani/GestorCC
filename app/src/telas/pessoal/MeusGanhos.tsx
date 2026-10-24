import { formatarData, formatarReais, type ResumoLoteGanhos } from '@shared';
import { useConsulta } from '../../api/hooks';
import { Carregando, Cartao, EstadoVazio, Etiqueta, Pagina } from '../../componentes';
import './pessoal.css';

function ListaLotes({ lotes, tom, vazio }: { lotes: ResumoLoteGanhos[]; tom: 'aviso' | 'sucesso'; vazio: string }) {
  if (!lotes.length) return <p className="texto-3 pequeno">{vazio}</p>;
  return (
    <div className="pilha">
      {lotes.map((l) => (
        <div key={l.loteId} className="pilha-2">
          <div className="linha-entre">
            <strong>{l.titulo}</strong>
            <span className="linha">
              <Etiqueta tom={tom}>{formatarData(l.data)}</Etiqueta>
              <strong className="numero">{formatarReais(l.valor)}</strong>
            </span>
          </div>
          <ul className="lista-simples pequeno texto-2">
            {l.eventos.map((e, i) => (
              <li key={i}>
                <span>{e.nome}</span>
                <span>{formatarData(e.data)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function MeusGanhos() {
  const q = useConsulta('ganhos.meus', null);
  if (q.isLoading || !q.data) return <Carregando />;
  const g = q.data;
  const nada = g.previsto.qtd === 0 && !g.enviados.length && !g.pagos.length && !g.externos.length;

  return (
    <Pagina titulo="Meus ganhos" subtitulo="Valores aproximados das suas diárias no Centro de Convenções.">
      <div className="grade-2">
        <Cartao titulo="Previsto" destaque>
          <div className="pilha-2">
            <span className="ganho-valor numero">≈ {formatarReais(g.previsto.valor)}</span>
            <span className="texto-2 pequeno">
              {g.previsto.qtd} sessão(ões) publicadas ou realizadas que ainda não foram enviadas para pagamento.
            </span>
          </div>
        </Cartao>
        <Cartao titulo="Enviado para pagamento">
          <ListaLotes lotes={g.enviados} tom="aviso" vazio="Nada aguardando pagamento." />
        </Cartao>
      </div>
      <Cartao titulo="Pago">
        <ListaLotes lotes={g.pagos} tom="sucesso" vazio="Nenhum pagamento registrado ainda." />
      </Cartao>
      <Cartao titulo="Pagamentos externos">
        <div className="pilha-2">
          <p className="pequeno texto-2">Pago diretamente pela organização do evento. Não entra no total previsto.</p>
          {g.externos.length === 0 ? (
            <p className="texto-3 pequeno">Nenhum evento com pagamento externo.</p>
          ) : (
            <ul className="lista-simples">
              {g.externos.map((x, i) => (
                <li key={i}>
                  <span>{x.eventoNome}</span>
                  <span className="texto-2">
                    {formatarData(x.data)} · {x.pagador}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Cartao>
      {nada && <EstadoVazio titulo="Ainda não há ganhos" texto="Quando você for escalado, a previsão aparece aqui." />}
    </Pagina>
  );
}
