import { formatarCod, formatarReais, validarRetirada } from '@shared';
import { Camera, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Alerta, Botao, Campo, Carregando, Cartao } from '../../componentes';
import { janela } from '../../util/hoje';
import { LeitorCodigo } from './LeitorCodigo';

export function Saida() {
  const q = useConsulta('almox.listar', null);
  const pessoas = usePessoas();
  const { de, ate } = janela(7, 60);
  const periodo = usePeriodo(de, ate);
  const retirar = useMutacao('almox.retirar', ['almox.listar', 'almox.movimentos', 'historico.listar']);
  const [cod, setCod] = useState('');
  const [qtd, setQtd] = useState('1');
  const [carrinho, setCarrinho] = useState<{ cod: string; qtd: number }[]>([]);
  const [quem, setQuem] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [eventoId, setEventoId] = useState('');
  const [camera, setCamera] = useState(false);
  const [nomeNovo, setNomeNovo] = useState(false);
  const [msg, setMsg] = useState<{ tom: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);
  const aoLer = useCallback((texto: string) => {
    const lido = (texto.match(/\d{1,4}/)?.[0] ?? '').trim();
    if (lido) setCod(formatarCod(lido));
    setCamera(false);
  }, []);

  if (q.isLoading || !q.data) return <Carregando />;
  const itens = q.data.itens.filter((i) => i.status === 'Ativo').sort((a, b) => (a.nomeComum || a.nomeAlmox).localeCompare(b.nomeComum || b.nomeAlmox, 'pt-BR'));
  const item = (c: string) => q.data!.itens.find((i) => i.cod === c);
  const erros = validarRetirada(carrinho, q.data.itens);
  const erroDe = (c: string) => erros.find((e) => e.cod === c)?.erro;
  const total = carrinho.reduce((acc, l) => acc + (item(l.cod)?.valor ?? 0) * l.qtd, 0);
  const pessoasAtivas = pessoas.lista.filter((p) => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  function adicionar() {
    setMsg(null);
    const n = Number(qtd);
    if (!cod) return setMsg({ tom: 'aviso', texto: 'Escolha um item.' });
    if (!item(cod)) return setMsg({ tom: 'erro', texto: `Código ${cod} não encontrado.` });
    setCarrinho((atual) => {
      const ja = atual.find((l) => l.cod === cod);
      return ja ? atual.map((l) => (l.cod === cod ? { ...l, qtd: l.qtd + n } : l)) : [...atual, { cod, qtd: n }];
    });
    setCod('');
    setQtd('1');
  }

  /** Quem retira pelo nome digitado: alguém da equipe, um autorizado externo, ou um nome novo. */
  const nome = quem.trim().replace(/\s+/g, ' ');
  const igual = (a: string) => a.toLowerCase() === nome.toLowerCase();
  const daEquipe = pessoasAtivas.find((p) => igual(p.nome));
  const externo = q.data.autorizadosExternos.find(igual);

  async function registrar(cadastrarExterno = false) {
    setMsg(null);
    setNomeNovo(false);
    if (!nome) return setMsg({ tom: 'aviso', texto: 'Informe quem está retirando.' });
    if (!finalidade.trim()) return setMsg({ tom: 'aviso', texto: 'Informe a finalidade.' });
    if (!daEquipe && !externo && !cadastrarExterno) return setNomeNovo(true);
    try {
      await retirar.mutateAsync({
        itens: carrinho,
        retiradoPorPessoaId: daEquipe?.id,
        retiradoPorExterno: daEquipe ? undefined : (externo ?? nome),
        cadastrarExterno: !daEquipe && !externo,
        finalidade,
        eventoId: eventoId || undefined,
      });
      setCarrinho([]);
      setFinalidade('');
      setQuem('');
      setMsg({ tom: 'sucesso', texto: 'Retirada registrada e estoque atualizado.' });
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message });
    }
  }

  return (
    <div className="grade-2">
      <Cartao titulo="Adicionar item">
        <div className="pilha">
          <Campo rotulo="Item">
            {(id) => (
              <select id={id} className="cc-entrada" value={cod} onChange={(e) => setCod(e.target.value)}>
                <option value="">Escolha pelo nome ou código…</option>
                {itens.map((i) => (
                  <option key={i.cod} value={i.cod}>
                    [{i.cod}] {i.nomeComum || i.nomeAlmox} (saldo: {i.saldo})
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <div className="linha" style={{ alignItems: 'flex-end' }}>
            <Campo rotulo="Quantidade">{(id) => <input id={id} className="cc-entrada" type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} style={{ width: 120 }} />}</Campo>
            <Botao variante="primario" onClick={adicionar}>
              Adicionar ao carrinho
            </Botao>
            <Botao onClick={() => setCamera(true)}>
              <Camera size={16} aria-hidden /> Ler código
            </Botao>
          </div>
          {camera && <LeitorCodigo aoLer={aoLer} aoFechar={() => setCamera(false)} />}
        </div>
      </Cartao>

      <Cartao titulo={`Carrinho (${carrinho.length})`}>
        <div className="pilha">
          {carrinho.length === 0 ? (
            <p className="texto-3">Nenhum item ainda.</p>
          ) : (
            <ul className="lista-simples">
              {carrinho.map((l) => {
                const i = item(l.cod);
                const e = erroDe(l.cod);
                return (
                  <li key={l.cod}>
                    <span className="pilha-2" style={{ gap: 2 }}>
                      <strong>
                        [{l.cod}] {i?.nomeComum || i?.nomeAlmox}
                      </strong>
                      {e && <span className="cc-campo-erro">{e}</span>}
                    </span>
                    <span className="linha">
                      <input
                        className="cc-entrada"
                        type="number"
                        min={1}
                        aria-label={`Quantidade de ${i?.nomeComum}`}
                        value={l.qtd}
                        style={{ width: 80 }}
                        onChange={(ev) => setCarrinho(carrinho.map((x) => (x.cod === l.cod ? { ...x, qtd: Number(ev.target.value) } : x)))}
                      />
                      <span className="pequeno texto-2">{i?.unidade}</span>
                      <Botao variante="fantasma" tamanho="pequeno" aria-label="Remover" onClick={() => setCarrinho(carrinho.filter((x) => x.cod !== l.cod))}>
                        <Trash2 size={14} />
                      </Botao>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Campo
            rotulo="Quem está retirando"
            ajuda={nome && (daEquipe ? 'Da equipe.' : externo ? 'Autorizado externo.' : 'Nome novo: será cadastrado como autorizado ao registrar.')}
          >
            {(id) => (
              <>
                <input
                  id={id}
                  className="cc-entrada"
                  list="quem-retira"
                  autoComplete="off"
                  placeholder="Digite o nome…"
                  value={quem}
                  onChange={(e) => {
                    setQuem(e.target.value);
                    setNomeNovo(false);
                  }}
                />
                <datalist id="quem-retira">
                  {pessoasAtivas.map((p) => (
                    <option key={p.id} value={p.nome} />
                  ))}
                  {q.data!.autorizadosExternos.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </>
            )}
          </Campo>
          <Campo rotulo="Finalidade">{(id) => <input id={id} className="cc-entrada" value={finalidade} placeholder="Ex.: montagem do palco" onChange={(e) => setFinalidade(e.target.value)} />}</Campo>
          <Campo rotulo="Evento (opcional)">
            {(id) => (
              <select id={id} className="cc-entrada" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
                <option value="">—</option>
                {periodo.eventos.filter((e) => e.status === 'ativo').map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <div className="linha-entre">
            <span className="texto-2">Valor estimado: {formatarReais(total)}</span>
            <Botao variante="primario" disabled={!carrinho.length || erros.length > 0} carregando={retirar.isPending} onClick={() => registrar()}>
              Registrar retirada
            </Botao>
          </div>
          {nomeNovo && (
            <Alerta tom="aviso">
              <p style={{ margin: '0 0 8px' }}>
                <strong>{nome}</strong> não está na lista de quem pode retirar. Cadastrar como autorizado e registrar a retirada?
              </p>
              <span className="linha">
                <Botao variante="primario" tamanho="pequeno" carregando={retirar.isPending} onClick={() => registrar(true)}>
                  Cadastrar e registrar
                </Botao>
                <Botao tamanho="pequeno" onClick={() => setNomeNovo(false)}>
                  Corrigir o nome
                </Botao>
              </span>
            </Alerta>
          )}
          {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
        </div>
      </Cartao>
    </div>
  );
}
