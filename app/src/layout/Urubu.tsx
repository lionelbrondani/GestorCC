import { pode, SETOR } from '@shared';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApi } from '../api/cliente';
import { useSessao } from '../auth/SessaoContexto';
import { CartaoResposta } from '../busca/CartaoResposta';
import type { RespostaBusca } from '../busca/executar';
import { responderPergunta } from '../busca/perguntar';
import { Botao } from '../componentes';
import { recursoAtivo } from '../recursos';
import { hoje } from '../util/hoje';
import { UrubuDoCC } from './UrubuDoCC';
import './urubu.css';

type Mensagem =
  | { de: 'eu'; texto: string }
  /** pergunta + resumo: o que vai como conversa nas próximas perguntas (nunca os dados mostrados). */
  | { de: 'urubu'; texto?: string; respostas?: RespostaBusca[]; pergunta: string; resumo: string };

const NOME = SETOR.assistente.nome;
const SUGESTOES = ['Quem trabalha sábado?', 'Quantas sessões tivemos por mês?', 'O que precisamos comprar?'];
const FRASES = {
  ola: SETOR.assistente.ola,
  naoSei: 'Hmm, essa eu não sei responder. Tenta perguntar de outro jeito?',
  limite: SETOR.assistente.limite,
  fora: 'Estou sem sinal com o Gemini agora. Tenta de novo daqui a pouco?',
};

/** O assistente: a busca inteligente em forma de conversa, num painel ao lado (mesmas proteções da barra de busca). */
export function Urubu() {
  const { sessao } = useSessao();
  const api = useApi();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  // em chaves: nos navegadores novos o scrollIntoView devolve uma Promise, que o React tomaria por limpeza do efeito
  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: 'end' });
  }, [mensagens, pensando]);
  if (!sessao || !recursoAtivo('busca') || !pode(sessao.pessoa.permissoes, 'busca', 'ver')) return null;

  async function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || pensando) return;
    setTexto('');
    const historico = mensagens.flatMap((m) => (m.de === 'urubu' ? [{ pergunta: m.pergunta, resposta: m.resumo }] : [])).slice(-4);
    setMensagens((ms) => [...ms, { de: 'eu', texto: p }]);
    setPensando(true);
    try {
      const r = await responderPergunta(api, qc, p, hoje(), { historico, persona: 'urubu' });
      const semResposta = r.motivo === 'limite' ? FRASES.limite : r.motivo === 'indisponivel' ? FRASES.fora : FRASES.naoSei;
      setMensagens((ms) => [
        ...ms,
        r.respostas.length ? { de: 'urubu', respostas: r.respostas, pergunta: p, resumo: r.resumo } : { de: 'urubu', texto: semResposta, pergunta: p, resumo: 'Não sei.' },
      ]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <>
      {!aberto && (
        <button type="button" className="urubu-botao" aria-label={`Falar com o ${NOME}`} title={`Falar com o ${NOME}`} onClick={() => setAberto(true)}>
          <UrubuDoCC tamanho={46} />
        </button>
      )}
      {aberto && (
        <aside className="urubu-painel" role="dialog" aria-label={NOME}>
          <header className="urubu-topo">
            <UrubuDoCC tamanho={40} />
            <div>
              <strong>{NOME}</strong>
              <span className="pequeno">{SETOR.assistente.subtitulo}</span>
            </div>
            {mensagens.length > 0 && (
              <Botao tamanho="pequeno" variante="fantasma" aria-label="Nova conversa" title="Nova conversa" onClick={() => setMensagens([])}>
                <RotateCcw size={16} />
              </Botao>
            )}
            <Botao tamanho="pequeno" variante="fantasma" aria-label={`Fechar o ${NOME}`} onClick={() => setAberto(false)}>
              <X size={18} />
            </Botao>
          </header>
          <div className="urubu-conversa">
            <div className="urubu-msg" data-de="urubu">
              <p>{FRASES.ola}</p>
            </div>
            {!mensagens.length && (
              <div className="urubu-sugestoes">
                {SUGESTOES.map((s) => (
                  <Botao key={s} tamanho="pequeno" onClick={() => enviar(s)}>
                    {s}
                  </Botao>
                ))}
              </div>
            )}
            {mensagens.map((m, i) =>
              m.de === 'eu' ? (
                <div key={i} className="urubu-msg" data-de="eu">
                  <p>{m.texto}</p>
                </div>
              ) : (
                <div key={i} className="urubu-msg" data-de="urubu">
                  {m.texto && <p>{m.texto}</p>}
                  {m.respostas?.map((r, k) => (
                    <CartaoResposta key={k} resposta={r} marca={k === m.respostas!.length - 1} aoNavegar={() => setAberto(false)} />
                  ))}
                </div>
              ),
            )}
            {pensando && (
              <div className="urubu-msg" data-de="urubu">
                <p className="texto-2">{SETOR.assistente.pensando}</p>
              </div>
            )}
            <div ref={fim} />
          </div>
          <form
            className="urubu-envio"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
            <input className="cc-entrada" aria-label={`Mensagem para o ${NOME}`} placeholder={`Pergunte ao ${NOME}…`} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Botao variante="primario" type="submit" aria-label="Enviar" carregando={pensando}>
              <Send size={16} />
            </Botao>
          </form>
        </aside>
      )}
    </>
  );
}
