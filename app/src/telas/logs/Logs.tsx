import { formatarDataHora, somarDias, type RegistroHistorico } from '@shared';
import { useDeferredValue, useState } from 'react';
import { usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Botao, Campo, Carregando, Pagina, Tabela } from '../../componentes';
import { hoje } from '../../util/hoje';

const POR_PAGINA = 100;

/** Nome da área de cada registro do histórico; o que não está aqui aparece como veio. */
const AREA: Record<string, string> = {
  evento: 'Agenda', sessao: 'Agenda', escala: 'Escalas', troca: 'Escalas', presenca: 'Escalas', rodada: 'Disponibilidade', disponibilidade: 'Disponibilidade',
  avaliacao: 'Escalas', lote: 'Pagamentos', contrato: 'Contratos', contratante: 'Contratos', almox: 'Almoxarifado', ocorrencia: 'Infraestrutura',
  pessoa: 'Pessoas', config: 'Configurações', aviso: 'Mural', pedido: 'Pedidos de data', achado: 'Achados e perdidos', cortesias: 'Cortesias',
  ficha: 'Ficha técnica', email: 'E-mails',
};
const area = (entidade: string) => AREA[entidade] ?? entidade.charAt(0).toUpperCase() + entidade.slice(1);

/** O que foi feito no sistema, por quem e quando. Só para quem administra (Configurações). */
export function Logs() {
  const pessoas = usePessoas();
  const [de, setDe] = useState(() => somarDias(hoje(), -30));
  const [ate, setAte] = useState(() => hoje());
  const [quemId, setQuemId] = useState('');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const textoAdiado = useDeferredValue(texto.trim());
  const q = useConsulta('logs.listar', { de, ate, ...(quemId ? { quemId } : {}), ...(textoAdiado ? { texto: textoAdiado } : {}), pagina });
  const mudar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPagina(1);
  };
  const total = q.data?.total ?? 0;
  const quem = (h: RegistroHistorico) => (h.quemId ? (pessoas.pessoa.get(h.quemId)?.nome ?? 'Pessoa removida') : 'Sistema ou página pública');

  return (
    <Pagina titulo="Logs do sistema" subtitulo="O que foi feito no GestorCC, por quem e quando.">
      <div className="linha" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Campo rotulo="De">{(id) => <input id={id} className="cc-entrada" type="date" value={de} max={ate} onChange={(e) => mudar(setDe)(e.target.value)} />}</Campo>
        <Campo rotulo="Até">{(id) => <input id={id} className="cc-entrada" type="date" value={ate} min={de} onChange={(e) => mudar(setAte)(e.target.value)} />}</Campo>
        <Campo rotulo="Pessoa">
          {(id) => (
            <select id={id} className="cc-entrada" value={quemId} onChange={(e) => mudar(setQuemId)(e.target.value)}>
              <option value="">Todas</option>
              {[...pessoas.lista]
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Procurar">
          {(id) => <input id={id} className="cc-entrada" type="search" placeholder="ex.: escala, lote, contrato" value={texto} onChange={(e) => mudar(setTexto)(e.target.value)} />}
        </Campo>
      </div>
      {q.isLoading ? (
        <Carregando />
      ) : (
        <>
          <Tabela
            colunas={[
              { chave: 'quando', titulo: 'Quando', render: (h) => <span className="pequeno">{formatarDataHora(h.quando)}</span> },
              { chave: 'quem', titulo: 'Quem', render: quem },
              { chave: 'area', titulo: 'Área', render: (h) => area(h.entidade) },
              {
                chave: 'acao',
                titulo: 'O que foi feito',
                render: (h) => (
                  <span>
                    {h.acao}
                    {h.justificativa && (
                      <>
                        <br />
                        <span className="pequeno texto-2">Motivo: {h.justificativa}</span>
                      </>
                    )}
                  </span>
                ),
              },
            ]}
            linhas={q.data?.itens ?? []}
            chaveLinha={(h) => h.id}
            vazio="Nada registrado com esses filtros."
          />
          {total > POR_PAGINA && (
            <div className="linha-entre">
              <span className="pequeno texto-2">
                {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
              </span>
              <div className="linha">
                <Botao tamanho="pequeno" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
                  Anteriores
                </Botao>
                <Botao tamanho="pequeno" disabled={pagina * POR_PAGINA >= total} onClick={() => setPagina(pagina + 1)}>
                  Mais antigos
                </Botao>
              </div>
            </div>
          )}
        </>
      )}
    </Pagina>
  );
}
