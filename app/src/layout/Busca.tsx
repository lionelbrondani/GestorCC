import { pode } from '@shared';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../api/cliente';
import { usePeriodo, usePessoas } from '../api/consultas';
import { useConsulta } from '../api/hooks';
import { useSessao } from '../auth/SessaoContexto';
import { buscaComum } from '../busca/buscaComum';
import { CartaoResposta } from '../busca/CartaoResposta';
import type { RespostaBusca } from '../busca/executar';
import { responderPergunta } from '../busca/perguntar';
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

  /** A pergunta vai à API (Gemini) sem os nomes e sem dados do sistema; as consultas rodam aqui (busca/perguntar). */
  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    if (!ehPergunta(termo)) return;
    setPensando(true);
    try {
      const r = await responderPergunta(api, qc, termo, hoje());
      setRespostas(r.respostas.length ? r.respostas : 'nao-entendi');
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
            respostas.map((resposta, n) => <CartaoResposta key={n} resposta={resposta} marca={n === respostas.length - 1} aoNavegar={() => setAberto(false)} />)}
          {!respostas && ehPergunta(termo) && !pensando && <p className="busca-vazio">Pressione Enter para perguntar.</p>}
          <Painel termo={termo} aoFechar={() => setAberto(false)} />
        </div>
      )}
    </div>
  );
}
