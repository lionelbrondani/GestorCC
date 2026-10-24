import { CATEGORIAS_INFRA, formatarDataHora, LOCAIS_INFRA, type PrioridadeOcorrencia } from '@shared';
import { Camera } from 'lucide-react';
import { useState } from 'react';
import { usePeriodo } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Carregando, Cartao, Pagina } from '../../componentes';
import { hoje } from '../../util/hoje';
import { EtiquetaStatus, INVALIDAR_INFRA, reduzirFoto } from './comum';

export function Relatar() {
  const eu = useEu();
  const relatos = useConsulta('infra.listar', null);
  const periodo = usePeriodo(hoje(), hoje());
  const relatar = useMutacao('infra.relatar', [...INVALIDAR_INFRA]);
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [categoria, setCategoria] = useState('Outros');
  const [descricao, setDescricao] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [eventoId, setEventoId] = useState('');
  const [msg, setMsg] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const o = await relatar.mutateAsync({
        titulo, local, categoria, descricao, foto, eventoId: eventoId || undefined,
        prioridade: (urgente ? 'urgente' : 'media') as PrioridadeOcorrencia,
      });
      setMsg({ tom: 'sucesso', texto: `Relato enviado (#${o.numero}). A equipe responsável foi avisada.` });
      setTitulo('');
      setDescricao('');
      setFoto(null);
      setUrgente(false);
    } catch (err) {
      setMsg({ tom: 'erro', texto: (err as Error).message });
    }
  }

  const meus = (relatos.data ?? []).filter((o) => o.relatorPessoaId === eu.id);

  return (
    <Pagina titulo="Relatar problema" subtitulo="Lâmpada queimada, vazamento, algo quebrado? Conte aqui e a equipe de infraestrutura é avisada na hora.">
      <div className="grade-2">
        <Cartao titulo="Novo relato">
          <form className="pilha" onSubmit={enviar}>
            <Campo rotulo="O que aconteceu?">
              {(id) => <input id={id} className="cc-entrada" value={titulo} placeholder="Ex.: torneira pingando no camarim 1" onChange={(e) => setTitulo(e.target.value)} />}
            </Campo>
            <div className="grade-2">
              <Campo rotulo="Onde?">
                {(id) => (
                  <select id={id} className="cc-entrada" value={local} onChange={(e) => setLocal(e.target.value)}>
                    <option value="">Escolha…</option>
                    {LOCAIS_INFRA.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Tipo de problema">
                {(id) => (
                  <select id={id} className="cc-entrada" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    {CATEGORIAS_INFRA.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
            <Campo rotulo="Detalhes (opcional)">
              {(id) => <textarea id={id} className="cc-entrada" value={descricao} placeholder="Ponto exato, desde quando, se atrapalha o evento…" onChange={(e) => setDescricao(e.target.value)} />}
            </Campo>
            {periodo.eventos.length > 0 && (
              <Campo rotulo="Aconteceu durante um evento de hoje?">
                {(id) => (
                  <select id={id} className="cc-entrada" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
                    <option value="">Não</option>
                    {periodo.eventos.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            )}
            <div className="linha">
              <label className="cc-botao" data-variante="secundario">
                <Camera size={16} aria-hidden /> {foto ? 'Trocar foto' : 'Tirar ou escolher foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="visualmente-oculto"
                  onChange={async (e) => {
                    const arq = e.target.files?.[0];
                    if (!arq) return;
                    try {
                      setFoto(await reduzirFoto(arq));
                    } catch (err) {
                      setMsg({ tom: 'erro', texto: (err as Error).message });
                    }
                  }}
                />
              </label>
              {foto && <img src={foto} alt="Foto do problema" style={{ height: 56, borderRadius: 6 }} />}
            </div>
            <label className="cc-caixa">
              <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
              É urgente (risco para pessoas ou atrapalha o evento agora)
            </label>
            {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
            <div>
              <Botao type="submit" variante="primario" carregando={relatar.isPending}>
                Enviar relato
              </Botao>
            </div>
          </form>
        </Cartao>
        <section aria-label="Meus relatos" className="cc-cartao">
          <div className="cc-cartao-cabecalho">
            <h2>Meus relatos</h2>
          </div>
          {relatos.isLoading ? (
            <Carregando />
          ) : meus.length === 0 ? (
            <p className="texto-3 pequeno">Você ainda não relatou nenhum problema.</p>
          ) : (
            <ul className="lista-simples">
              {meus.map((o) => (
                <li key={o.id}>
                  <span className="pilha-2" style={{ gap: 2 }}>
                    <strong>{o.titulo}</strong>
                    <span className="pequeno texto-2">
                      #{o.numero} · {o.local} · {formatarDataHora(o.criadaEm)}
                      {o.chamadoNumero ? ` · chamado ${o.chamadoNumero}` : ''}
                    </span>
                  </span>
                  <EtiquetaStatus status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Pagina>
  );
}
