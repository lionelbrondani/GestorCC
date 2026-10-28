import { ehApoio, formatarDataHora, linkWhatsapp, mesExtenso, textoLembreteRodada, type Rodada } from '@shared';
import { Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Etiqueta, Modal } from '../../componentes';
import { agora } from '../../util/hoje';
import { dataLonga, tituloSessao } from '../../util/sessoes';
import { copiarTexto, INVALIDAR_ESCALAS, useDadosEscalas } from './dadosEscalas';
import { TEXTO_ESTADO, useMarcacoes } from './useMarcacoes';

type Dados = ReturnType<typeof useDadosEscalas>;

function NovaRodada({ mes, dados, aoFechar }: { mes: string; dados: Dados; aoFechar: () => void }) {
  const [ano, m] = mes.split('-').map(Number);
  const nomeMes = mesExtenso(m);
  const [nome, setNome] = useState(`${nomeMes.charAt(0)}${nomeMes.slice(1).toLowerCase()}/${ano}`);
  const [prazo, setPrazo] = useState(`${mes}-01T23:59`);
  // atividades de apoio não entram na rodada de disponibilidade
  const ativas = dados.sessoes.filter((s) => s.status === 'ativa' && !ehApoio(s));
  const [marcadas, setMarcadas] = useState(new Set(ativas.map((s) => s.id)));
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useMutacao('rodadas.salvar', [...INVALIDAR_ESCALAS]);

  return (
    <Modal
      aberto
      titulo="Abrir rodada de disponibilidade"
      aoFechar={aoFechar}
      largura="grande"
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            carregando={salvar.isPending}
            onClick={async () => {
              setErro(null);
              if (!marcadas.size) return setErro('Escolha ao menos uma sessão.');
              try {
                await salvar.mutateAsync({ id: '', nome, prazo, status: 'aberta', sessaoIds: [...marcadas] });
                aoFechar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Abrir rodada
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <div className="grade-2">
          <Campo rotulo="Nome">{(id) => <input id={id} className="cc-entrada" value={nome} onChange={(e) => setNome(e.target.value)} />}</Campo>
          <Campo rotulo="Prazo para responder">{(id) => <input id={id} className="cc-entrada" type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />}</Campo>
        </div>
        <strong>Sessões incluídas ({marcadas.size})</strong>
        <div className="pilha-2">
          {ativas.map((s) => (
            <label key={s.id} className="cc-caixa">
              <input
                type="checkbox"
                checked={marcadas.has(s.id)}
                onChange={(e) => {
                  const n = new Set(marcadas);
                  if (e.target.checked) n.add(s.id);
                  else n.delete(s.id);
                  setMarcadas(n);
                }}
              />
              {dataLonga(s.data)} · {tituloSessao(dados.periodo.evento.get(s.eventoId), s)}
            </label>
          ))}
          {!ativas.length && <p className="texto-3">Nenhuma sessão cadastrada neste mês.</p>}
        </div>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

function MarcarPorAlguem({ rodada, dados, aoFechar }: { rodada: Rodada; dados: Dados; aoFechar: () => void }) {
  const [pessoaId, setPessoaId] = useState('');
  const marcacoes = useMarcacoes(pessoaId || undefined);
  const sessoes = dados.sessoes.filter((s) => rodada.sessaoIds.includes(s.id));
  const valor = (sessaoId: string) =>
    marcacoes.valor(sessaoId, dados.disponibilidades.find((d) => d.pessoaId === pessoaId && d.sessaoId === sessaoId)?.disponivel);
  const marcar = (sessaoId: string, disponivel: boolean) => marcacoes.marcar([{ sessaoId, disponivel }]);
  const concluir = async () => {
    await marcacoes.enviar();
    aoFechar();
  };
  return (
    <Modal
      aberto
      titulo="Marcar disponibilidade por alguém"
      aoFechar={concluir}
      rodape={
        <>
          <span className="pequeno texto-2" role="status">
            {TEXTO_ESTADO[marcacoes.estado]}
          </span>
          <Botao variante="primario" carregando={marcacoes.estado === 'salvando'} onClick={concluir}>
            Concluir
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <p className="pequeno texto-2">Use quando a pessoa avisou por outro meio (ex.: WhatsApp). Fica registrado no histórico.</p>
        <Campo rotulo="Pessoa">
          {(id) => (
            <select id={id} className="cc-entrada" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
              <option value="">Escolha…</option>
              {dados.ctxBase.pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        {pessoaId && (
          <div className="linha">
            <Botao tamanho="pequeno" onClick={() => marcacoes.marcar(sessoes.map((s) => ({ sessaoId: s.id, disponivel: true })))}>
              Sim em todas
            </Botao>
            <Botao tamanho="pequeno" onClick={() => marcacoes.marcar(sessoes.map((s) => ({ sessaoId: s.id, disponivel: false })))}>
              Não em todas
            </Botao>
          </div>
        )}
        {marcacoes.erro && <Alerta tom="erro">{marcacoes.erro}</Alerta>}
        {pessoaId &&
          sessoes.map((s) => (
            <div key={s.id} className="linha-entre">
              <span className="pequeno">
                {dataLonga(s.data)} · {tituloSessao(dados.periodo.evento.get(s.eventoId), s)}
              </span>
              <span className="sim-nao">
                <button data-valor="sim" aria-pressed={valor(s.id) === true} aria-label={`Sim: ${dataLonga(s.data)}`} onClick={() => marcar(s.id, true)}>
                  Sim
                </button>
                <button data-valor="nao" aria-pressed={valor(s.id) === false} aria-label={`Não: ${dataLonga(s.data)}`} onClick={() => marcar(s.id, false)}>
                  Não
                </button>
              </span>
            </div>
          ))}
      </div>
    </Modal>
  );
}

export function Rodadas({ mes }: { mes: string }) {
  const dados = useDadosEscalas(mes);
  const salvar = useMutacao('rodadas.salvar', [...INVALIDAR_ESCALAS]);
  const [nova, setNova] = useState(false);
  const [marcandoEm, setMarcandoEm] = useState<Rodada | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);

  if (dados.carregando) return <Carregando />;
  const doMes = dados.rodadas.filter((r) => r.sessaoIds.some((id) => dados.periodo.sessao.has(id)));
  const momento = agora();

  return (
    <div className="pilha">
      <div>
        <Botao variante="primario" onClick={() => setNova(true)}>
          Abrir rodada de disponibilidade
        </Botao>
      </div>
      {!doMes.length && <EstadoVazio titulo="Nenhuma rodada neste mês" texto="Abra uma rodada para os bolsistas e servidores marcarem disponibilidade." />}
      {doMes.map((r) => {
        const respondeu = new Set(dados.disponibilidades.filter((d) => r.sessaoIds.includes(d.sessaoId)).map((d) => d.pessoaId));
        const faltam = dados.ctxBase.pessoas.filter((p) => !respondeu.has(p.id));
        const encerrada = r.status === 'fechada' || r.prazo < momento;
        const lembrete = textoLembreteRodada(r, faltam.map((p) => p.nomeCurto));
        return (
          <Cartao
            key={r.id}
            titulo={`Rodada ${r.nome}`}
            acoes={
              <>
                <Etiqueta tom={encerrada ? 'neutro' : 'destaque'}>{encerrada ? 'Encerrada' : `Aberta até ${formatarDataHora(r.prazo)}`}</Etiqueta>
                <Botao tamanho="pequeno" onClick={() => setMarcandoEm(r)}>
                  Marcar por alguém
                </Botao>
                <Botao
                  tamanho="pequeno"
                  carregando={salvar.isPending}
                  onClick={() => salvar.mutate({ ...r, status: r.status === 'aberta' ? 'fechada' : 'aberta', prazo: r.status === 'fechada' && r.prazo < momento ? `${momento.slice(0, 10)}T23:59` : r.prazo })}
                >
                  {r.status === 'aberta' ? 'Fechar' : 'Reabrir'}
                </Botao>
              </>
            }
          >
            <div className="pilha-2">
              <p>
                <strong>
                  {dados.ctxBase.pessoas.length - faltam.length} de {dados.ctxBase.pessoas.length}
                </strong>{' '}
                pessoas responderam · {r.sessaoIds.length} sessões
              </p>
              {faltam.length > 0 && (
                <>
                  <p className="pequeno texto-2">Faltam: {faltam.map((p) => p.nomeCurto).join(', ')}</p>
                  {!encerrada && (
                    <span className="linha">
                      <Botao
                        tamanho="pequeno"
                        onClick={async () => {
                          if (await copiarTexto(lembrete)) setCopiada(r.id);
                        }}
                      >
                        <Copy size={14} aria-hidden /> {copiada === r.id ? 'Copiado!' : 'Copiar lembrete'}
                      </Botao>
                      <a className="cc-botao" data-variante="secundario" data-tamanho="pequeno" href={linkWhatsapp(lembrete)} target="_blank" rel="noreferrer">
                        <MessageCircle size={14} aria-hidden /> Abrir no WhatsApp
                      </a>
                    </span>
                  )}
                </>
              )}
            </div>
          </Cartao>
        );
      })}
      {nova && <NovaRodada mes={mes} dados={dados} aoFechar={() => setNova(false)} />}
      {marcandoEm && <MarcarPorAlguem rodada={marcandoEm} dados={dados} aoFechar={() => setMarcandoEm(null)} />}
    </div>
  );
}
