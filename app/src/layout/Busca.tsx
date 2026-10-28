import { pode, type Consulta } from '@shared';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../api/cliente';
import { usePeriodo, usePessoas } from '../api/consultas';
import { useConsulta } from '../api/hooks';
import { useSessao } from '../auth/SessaoContexto';
import { buscaComum } from '../busca/buscaComum';
import { executarConsulta, type RespostaBusca } from '../busca/executar';
import { interpretarSimulado } from '../busca/interpretarSimulado';
import { devolverNaConsulta, protegerNomes } from '../busca/nomes';
import { recursoAtivo } from '../recursos';
import { hoje, janela } from '../util/hoje';
import './busca.css';

function ehPergunta(t: string) {
  return t.includes('?') || t.trim().split(/\s+/).length >= 4;
}

function Painel({ termo, aoFechar }: { termo: string; aoFechar: () => void }) {
  const { sessao } = useSessao();
  const p = sessao!.pessoa.permissoes;
  const pessoas = usePessoas();
  const { de, ate } = janela(400, 400);
  const periodo = usePeriodo(de, ate);
  const almox = useConsulta('almox.listar', null, { habilitada: pode(p, 'almoxEstoque', 'ver') || pode(p, 'almoxSaidas', 'ver') });
  const contratos = useConsulta('contratos.listar', null, { habilitada: pode(p, 'contratos', 'ver') });
  const achados = useConsulta('achados.listar', null, { habilitada: recursoAtivo('achados') && pode(p, 'achados', 'ver') });
  const resultados = buscaComum(
    termo,
    { pessoas: pessoas.lista, eventos: periodo.eventos, itens: almox.data?.itens ?? [], contratos: contratos.data?.contratos ?? [], achados: achados.data ?? [] },
    p,
  );
  const ROTULO = { pessoa: 'Pessoa', evento: 'Evento', item: 'Item', contrato: 'Contrato', achado: 'Achado' } as const;
  if (!resultados.length) return termo.trim().length >= 2 && !ehPergunta(termo) ? <p className="busca-vazio">Nada encontrado.</p> : null;
  return (
    <ul className="busca-lista">
      {resultados.map((r, i) => (
        <li key={i}>
          <Link to={r.link} onClick={aoFechar}>
            <span className="busca-tipo">{ROTULO[r.tipo]}</span>
            <span>
              <strong>{r.titulo}</strong>
              <span className="pequeno texto-2"> · {r.subtitulo}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

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

export function Busca() {
  const { sessao } = useSessao();
  const api = useApi();
  const qc = useQueryClient();
  const local = useLocation();
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [respostas, setRespostas] = useState<RespostaBusca[] | null | 'nao-entendi'>(null);
  const [pensando, setPensando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAberto(false);
    setRespostas(null);
  }, [local.pathname]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  if (!sessao || !recursoAtivo('busca') || !pode(sessao.pessoa.permissoes, 'busca', 'ver')) return null;

  /**
   * A pergunta vai à API, que a interpreta (Gemini) sem enviar dados do sistema; antes, os nomes das pessoas viram
   * códigos (sem a lista de pessoas, a pergunta não vai). As consultas (até 3) rodam aqui, com as permissões de quem
   * perguntou. Sem resposta da API, vale a interpretação por palavras-chave.
   */
  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    if (!ehPergunta(termo)) return;
    setPensando(true);
    try {
      const pessoas = await qc
        .fetchQuery({ queryKey: ['pessoas.listar', null], queryFn: () => api.chamar('pessoas.listar', null), staleTime: 5 * 60_000 })
        .catch(() => null);
      const protegida = pessoas ? protegerNomes(termo, pessoas) : null;
      const r = protegida ? await api.chamar('busca.interpretar', { pergunta: protegida.texto }).catch(() => null) : null;
      const devolver = protegida?.devolver ?? ((s: string) => s);
      if (r?.ajuda) return setRespostas([{ titulo: devolver(r.ajuda), itens: [] }]);
      const doGemini = r?.consultas?.length ? r.consultas : r?.consulta ? [r.consulta] : [];
      const consultas = doGemini.length
        ? doGemini.map((c) => devolverNaConsulta(c, devolver))
        : [interpretarSimulado(termo, hoje())].filter((c): c is Consulta => c !== null);
      if (!consultas.length) return setRespostas('nao-entendi');
      setRespostas(await Promise.all(consultas.map((c) => executarConsulta(c, api, hoje()))));
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="busca" ref={ref}>
      <form onSubmit={perguntar} role="search">
        <Search size={18} aria-hidden className="busca-icone" />
        <input
          className="cc-entrada busca-entrada"
          type="search"
          placeholder="Buscar ou perguntar… ex.: quem está escalado sábado?"
          aria-label="Buscar ou perguntar"
          value={termo}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setTermo(e.target.value);
            setRespostas(null);
            setAberto(true);
          }}
        />
      </form>
      {aberto && termo.trim().length >= 2 && (
        <div className="busca-painel">
          {pensando && <p className="busca-vazio">Consultando…</p>}
          {respostas === 'nao-entendi' && <p className="busca-vazio">Não consegui interpretar agora; veja os resultados da busca.</p>}
          {Array.isArray(respostas) &&
            respostas.map((resposta, n) => (
              <div className="busca-resposta" key={n}>
                <strong>{resposta.titulo}</strong>
                {resposta.tabela ? (
                  <TabelaResposta titulo={resposta.titulo} tabela={resposta.tabela} />
                ) : resposta.itens.length > 0 ? (
                  <ul className="busca-lista">
                    {resposta.itens.map((i, k) => (
                      <li key={k}>
                        <Link to={i.link} onClick={() => setAberto(false)}>
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
                {n === respostas.length - 1 && <span className="busca-marca">resposta automática · confira os dados</span>}
              </div>
            ))}
          {!respostas && ehPergunta(termo) && !pensando && <p className="busca-vazio">Pressione Enter para perguntar.</p>}
          <Painel termo={termo} aoFechar={() => setAberto(false)} />
        </div>
      )}
    </div>
  );
}
