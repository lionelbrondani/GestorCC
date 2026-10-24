import { pode } from '@shared';
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
  const resultados = buscaComum(
    termo,
    { pessoas: pessoas.lista, eventos: periodo.eventos, itens: almox.data?.itens ?? [], contratos: contratos.data?.contratos ?? [] },
    p,
  );
  const ROTULO = { pessoa: 'Pessoa', evento: 'Evento', item: 'Item', contrato: 'Contrato' } as const;
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

export function Busca() {
  const { sessao } = useSessao();
  const api = useApi();
  const local = useLocation();
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState<RespostaBusca | null | 'nao-entendi'>(null);
  const [pensando, setPensando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAberto(false);
    setResposta(null);
  }, [local.pathname]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  if (!sessao || !recursoAtivo('busca') || !pode(sessao.pessoa.permissoes, 'busca', 'ver')) return null;

  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    if (!ehPergunta(termo)) return;
    const consulta = interpretarSimulado(termo, hoje());
    if (!consulta) return setResposta('nao-entendi');
    setPensando(true);
    setResposta(await executarConsulta(consulta, api, hoje()));
    setPensando(false);
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
            setResposta(null);
            setAberto(true);
          }}
        />
      </form>
      {aberto && termo.trim().length >= 2 && (
        <div className="busca-painel">
          {pensando && <p className="busca-vazio">Consultando…</p>}
          {resposta === 'nao-entendi' && <p className="busca-vazio">Não consegui interpretar agora; veja os resultados da busca.</p>}
          {resposta && resposta !== 'nao-entendi' && (
            <div className="busca-resposta">
              <strong>{resposta.titulo}</strong>
              {resposta.itens.length === 0 ? (
                <p className="pequeno texto-2">{resposta.vazio}</p>
              ) : (
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
              )}
              <span className="busca-marca">resposta automática · confira os dados</span>
            </div>
          )}
          {!resposta && ehPergunta(termo) && !pensando && <p className="busca-vazio">Pressione Enter para perguntar.</p>}
          <Painel termo={termo} aoFechar={() => setAberto(false)} />
        </div>
      )}
    </div>
  );
}
