import { Link } from 'react-router-dom';
import type { RespostaBusca } from './executar';
import '../layout/busca.css';

function TabelaResposta({ titulo, tabela }: { titulo: string; tabela: NonNullable<RespostaBusca['tabela']> }) {
  return (
    <>
      <table className="busca-tabela" aria-label={titulo}>
        <thead>
          <tr>
            <th scope="col">{tabela.colunas[0]}</th>
            <th scope="col">{tabela.colunas[1]}</th>
          </tr>
        </thead>
        <tbody>
          {tabela.linhas.map(([grupo, valor], k) => (
            <tr key={k}>
              <td>{grupo}</td>
              <td>{valor}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{tabela.total}</td>
          </tr>
        </tfoot>
      </table>
      {tabela.observacao && <p className="pequeno texto-2">{tabela.observacao}</p>}
    </>
  );
}

/** Um cartão de resposta da busca e do Urubu: o título e a tabela, a lista com links ou o aviso de vazio. */
export function CartaoResposta({ resposta, marca, aoNavegar }: { resposta: RespostaBusca; marca?: boolean; aoNavegar?: () => void }) {
  return (
    <div className="busca-resposta">
      <strong>{resposta.titulo}</strong>
      {resposta.tabela ? (
        <TabelaResposta titulo={resposta.titulo} tabela={resposta.tabela} />
      ) : resposta.itens.length > 0 ? (
        <ul className="busca-lista">
          {resposta.itens.map((i, k) => (
            <li key={k}>
              <Link to={i.link} onClick={aoNavegar}>
                <span>
                  <strong>{i.texto}</strong>
                  {i.detalhe && <span className="pequeno texto-2"> · {i.detalhe}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        resposta.vazio && <p className="pequeno texto-2">{resposta.vazio}</p>
      )}
      {marca && <span className="busca-marca">resposta automática · confira os dados</span>}
    </div>
  );
}
