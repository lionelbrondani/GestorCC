import { elegiveisParaLote, formatarData, formatarReais, pode, type Escala, type Lote } from '@shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Abas, Alerta, Botao, Campo, Carregando, EstadoVazio, Etiqueta, Modal, Pagina, Tabela } from '../../componentes';
import { hoje } from '../../util/hoje';
import { dataLonga, tituloSessao } from '../../util/sessoes';
import { INVALIDAR_PAGAMENTOS, useDadosPagamentos } from './dadosPagamentos';
import { FichaIndicacao } from './FichaIndicacao';
import { ETIQUETA_LOTE } from './Pagamentos';

type Dados = ReturnType<typeof useDadosPagamentos>;

/** Sessões realizadas que ainda não estão em nenhum lote, para juntar a um lote já criado. */
function ModalIncluir({ lote, dados, aoFechar }: { lote: Lote; dados: Dados; aoFechar: () => void }) {
  const incluir = useMutacao('lotes.adicionarItens', [...INVALIDAR_PAGAMENTOS]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const porSessao = new Map<string, Escala[]>();
  for (const e of elegiveisParaLote(dados.base)) porSessao.set(e.sessaoId, [...(porSessao.get(e.sessaoId) ?? []), e]);
  const sessoes = [...porSessao.keys()]
    .map((id) => dados.periodo.sessao.get(id))
    .filter((x) => x !== undefined)
    .sort((a, b) => a.data.localeCompare(b.data));
  const escalaIds = [...marcadas].flatMap((id) => (porSessao.get(id) ?? []).map((e) => e.id));
  const alternar = (id: string) => {
    const n = new Set(marcadas);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setMarcadas(n);
  };

  async function confirmar() {
    setErro(null);
    try {
      await incluir.mutateAsync({ loteId: lote.id, escalaIds });
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Modal
      aberto
      titulo="Incluir sessões no lote"
      aoFechar={aoFechar}
      largura="grande"
      rodape={
        <>
          <Botao onClick={aoFechar}>Voltar</Botao>
          <Botao variante="primario" disabled={!marcadas.size} carregando={incluir.isPending} onClick={confirmar}>
            {marcadas.size ? `Incluir ${marcadas.size} ${marcadas.size === 1 ? 'sessão' : 'sessões'}` : 'Incluir'}
          </Botao>
        </>
      }
    >
      {sessoes.length ? (
        <div className="pilha-2">
          <p className="pequeno texto-2">Sessões realizadas, com presença confirmada, que ainda não estão em nenhum lote.</p>
          {sessoes.map((s) => {
            const n = porSessao.get(s.id)?.length ?? 0;
            return (
              <label key={s.id} className="cc-caixa">
                <input type="checkbox" checked={marcadas.has(s.id)} onChange={() => alternar(s.id)} />
                <span>
                  <strong>{tituloSessao(dados.periodo.evento.get(s.eventoId), s)}</strong> · {dataLonga(s.data)} · {n} {n === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <EstadoVazio titulo="Nenhuma sessão para incluir" texto="Aparecem aqui as sessões realizadas, com presença confirmada, que ainda não estão em nenhum lote." />
      )}
      {erro && <Alerta tom="erro">{erro}</Alerta>}
    </Modal>
  );
}

export function LoteDetalhe() {
  const { loteId = '' } = useParams();
  const eu = useEu();
  const dados = useDadosPagamentos();
  const [aba, setAba] = useState<'itens' | 'ficha'>('itens');
  const [modal, setModal] = useState<'pago' | 'cancelar' | 'incluir' | null>(null);
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const pagar = useMutacao('lotes.marcarPago', [...INVALIDAR_PAGAMENTOS]);
  const cancelar = useMutacao('lotes.cancelar', [...INVALIDAR_PAGAMENTOS]);
  const retirar = useMutacao('lotes.retirarItem', [...INVALIDAR_PAGAMENTOS]);

  if (dados.carregando) return <Carregando />;
  const lote = dados.base.lotes.find((l) => l.id === loteId);
  if (!lote) return <EstadoVazio titulo="Lote não encontrado" acao={<Link to="/pagamentos">Voltar</Link>} />;

  const editavel = lote.status === 'enviado' && pode(eu.permissoes, 'pagamentos', 'editar');
  const itens = dados.itens
    .filter((i) => i.loteId === lote.id)
    .map((i) => {
      const e = dados.base.escalas.find((x) => x.id === i.escalaId);
      const s = e ? dados.periodo.sessao.get(e.sessaoId) : undefined;
      return { ...i, sessao: s, pessoa: dados.pessoas.pessoa.get(i.pessoaId) };
    })
    .sort((a, b) => (a.pessoa?.nome ?? '').localeCompare(b.pessoa?.nome ?? '', 'pt-BR') || (a.sessao?.data ?? '').localeCompare(b.sessao?.data ?? ''));
  const total = itens.reduce((acc, i) => acc + i.valor, 0);

  async function executar(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
      setModal(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Pagina
      titulo={lote.titulo}
      subtitulo={
        <span className="linha">
          <Etiqueta tom={ETIQUETA_LOTE[lote.status].tom}>{ETIQUETA_LOTE[lote.status].texto}</Etiqueta>
          <span>{lote.periodoReferencia}</span>
          {lote.pagoEm && <span>· pago em {formatarData(lote.pagoEm)}</span>}
        </span>
      }
      acoes={
        editavel && (
          <>
            <Botao onClick={() => setModal('incluir')}>Incluir sessões</Botao>
            <Botao variante="primario" onClick={() => setModal('pago')}>
              Marcar como pago
            </Botao>
            <Botao variante="perigo" onClick={() => setModal('cancelar')}>
              Cancelar lote
            </Botao>
          </>
        )
      }
    >
      <div className="linha-entre">
        <Abas
          abas={[
            { id: 'itens', rotulo: `Sessões (${itens.length})` },
            { id: 'ficha', rotulo: 'Ficha de indicação' },
          ]}
          ativa={aba}
          aoMudar={setAba}
        />
        <strong className="cc-numero">{formatarReais(total)}</strong>
      </div>
      {erro && <Alerta tom="erro">{erro}</Alerta>}
      {aba === 'itens' ? (
        <Tabela
          colunas={[
            { chave: 'pessoa', titulo: 'Bolsista', render: (i) => i.pessoa?.nome ?? i.pessoaId },
            { chave: 'sessao', titulo: 'Sessão', render: (i) => (i.sessao ? `${tituloSessao(dados.periodo.evento.get(i.sessao.eventoId), i.sessao)} · ${dataLonga(i.sessao.data)}` : '—') },
            { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (i) => formatarReais(i.valor) },
            {
              chave: 'acao',
              titulo: '',
              render: (i) =>
                editavel && (
                  <Botao tamanho="pequeno" variante="fantasma" carregando={retirar.isPending} onClick={() => executar(() => retirar.mutateAsync({ loteId: lote.id, escalaId: i.escalaId }))}>
                    Retirar
                  </Botao>
                ),
            },
          ]}
          linhas={itens}
          chaveLinha={(i) => i.escalaId}
        />
      ) : (
        <FichaIndicacao lote={lote} dados={dados} />
      )}

      {modal === 'incluir' && <ModalIncluir lote={lote} dados={dados} aoFechar={() => setModal(null)} />}
      <Modal
        aberto={modal === 'pago'}
        titulo="Marcar lote como pago"
        aoFechar={() => setModal(null)}
        rodape={
          <>
            <Botao onClick={() => setModal(null)}>Voltar</Botao>
            <Botao variante="primario" carregando={pagar.isPending} onClick={() => executar(() => pagar.mutateAsync({ loteId: lote.id, data }))}>
              Confirmar pagamento
            </Botao>
          </>
        }
      >
        <div className="pilha">
          <p>Os bolsistas verão este lote como pago em "Meus ganhos".</p>
          <Campo rotulo="Data do pagamento">{(id) => <input id={id} className="cc-entrada" type="date" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
        </div>
      </Modal>
      <Modal
        aberto={modal === 'cancelar'}
        titulo="Cancelar lote"
        aoFechar={() => setModal(null)}
        rodape={
          <>
            <Botao onClick={() => setModal(null)}>Voltar</Botao>
            <Botao variante="perigo" carregando={cancelar.isPending} onClick={() => executar(() => cancelar.mutateAsync({ loteId: lote.id, justificativa: motivo }))}>
              Cancelar lote
            </Botao>
          </>
        }
      >
        <div className="pilha">
          <p>As sessões voltam a ficar disponíveis para outro lote.</p>
          <Campo rotulo="Motivo (obrigatório)">{(id) => <textarea id={id} className="cc-entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</Campo>
        </div>
      </Modal>
    </Pagina>
  );
}
