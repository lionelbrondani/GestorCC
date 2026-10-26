import { formatarData, type DestinoCortesias } from '@shared';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Abas, Botao, Carregando, EstadoVazio, Pagina } from '../../componentes';
import { janela } from '../../util/hoje';
import { CabecalhoImpresso } from '../impressao/ModeloImpressao';
import { preenchidas } from './ListaPessoas';
import './cortesias.css';

type Linha = { nome: string; matricula: string; destino: string };

const porNome = (a: Linha, b: Linha) => a.nome.localeCompare(b.nome, 'pt-BR');

function TabelaRetirada({ linhas, comDestino }: { linhas: Linha[]; comDestino: boolean }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Nº</th>
          <th>Nome</th>
          <th>Matrícula</th>
          {comDestino && <th>Destino</th>}
          <th>Retirou</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{l.nome}</td>
            <td>{l.matricula || '—'}</td>
            {comDestino && <td>{l.destino}</td>}
            <td className="retirada">
              <span className="caixa-retirada" aria-label="a marcar" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Lista de cortesias para o dia do evento: todos em ordem alfabética, ou separada por destino. */
export function ImprimirCortesias() {
  const { eventoId = '' } = useParams();
  const { de, ate } = janela(400, 400);
  const periodo = usePeriodo(de, ate);
  const dados = useConsulta('cortesias.listar', { eventoId });
  const [modo, setModo] = useState<'alfabetica' | 'destino'>('alfabetica');

  if (periodo.isLoading || dados.isLoading) return <Carregando />;
  const evento = periodo.evento.get(eventoId);
  if (!evento || !dados.data) return <EstadoVazio titulo="Evento não encontrado" acao={<Link to="/agenda">Voltar para a agenda</Link>} />;
  const datas = periodo.sessoes.filter((s) => s.eventoId === eventoId && s.status === 'ativa').map((s) => formatarData(s.data)).sort().join(', ');
  const destinos: DestinoCortesias[] = dados.data.destinos;
  const linhasDe = (d: DestinoCortesias): Linha[] => preenchidas(d.pessoas).map((p) => ({ ...p, destino: d.nome }));
  const todas = destinos.flatMap(linhasDe).sort(porNome);

  return (
    <Pagina
      titulo={`Cortesias: ${evento.nome}`}
      subtitulo={`${todas.length} nomes de ${destinos.length} ${destinos.length === 1 ? 'destino' : 'destinos'}`}
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
      <div className="nao-imprimir">
        <Abas
          abas={[
            { id: 'alfabetica', rotulo: 'Todos em ordem alfabética' },
            { id: 'destino', rotulo: 'Separada por destino' },
          ]}
          ativa={modo}
          aoMudar={setModo}
        />
      </div>
      <div className="folha-impressao cortesias-impressa">
        <section className="pagina-impressao">
          <CabecalhoImpresso titulo="LISTA DE CORTESIAS" subtitulo={`${evento.nome}${datas ? ` · ${datas}` : ''}`} />
          {modo === 'alfabetica' ? (
            todas.length ? <TabelaRetirada linhas={todas} comDestino /> : <p>Nenhum nome lançado ainda.</p>
          ) : (
            destinos.map((d) => (
              <div key={d.id}>
                <h2>
                  {d.nome} · {preenchidas(d.pessoas).length} de {d.quantidade}
                </h2>
                {preenchidas(d.pessoas).length ? <TabelaRetirada linhas={linhasDe(d).sort(porNome)} comDestino={false} /> : <p>Nenhum nome lançado.</p>}
              </div>
            ))
          )}
        </section>
      </div>
    </Pagina>
  );
}
