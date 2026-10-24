import { elegiveisParaLote, formatarReais, periodoReferencia, previaLote, valorDaSessao, type Escala } from '@shared';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Pagina, Tabela } from '../../componentes';
import { dataLonga, tituloSessao } from '../../util/sessoes';
import { INVALIDAR_PAGAMENTOS, useDadosPagamentos } from './dadosPagamentos';

export function NovoLote() {
  const dados = useDadosPagamentos();
  const navegar = useNavigate();
  const criar = useMutacao('lotes.criar', [...INVALIDAR_PAGAMENTOS]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [titulo, setTitulo] = useState('');
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [edital, setEdital] = useState<string | null>(null);
  const [iniciativa, setIniciativa] = useState<string | null>(null);
  const [zerados, setZerados] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const elegiveis = useMemo(() => elegiveisParaLote(dados.base), [dados.base]);
  if (dados.carregando) return <Carregando />;

  const sessaoDe = (e: Escala) => dados.periodo.sessao.get(e.sessaoId)!;
  const filtradas = elegiveis.filter((e) => {
    const d = sessaoDe(e).data;
    return (!de || d >= de) && (!ate || d <= ate);
  });
  const porSessao = new Map<string, Escala[]>();
  for (const e of filtradas) porSessao.set(e.sessaoId, [...(porSessao.get(e.sessaoId) ?? []), e]);
  const porEvento = new Map<string, string[]>();
  for (const sessaoId of porSessao.keys()) {
    const ev = dados.periodo.sessao.get(sessaoId)!.eventoId;
    porEvento.set(ev, [...(porEvento.get(ev) ?? []), sessaoId]);
  }
  const eventosOrdenados = [...porEvento.entries()].sort(
    (a, b) => dados.periodo.sessao.get(a[1][0])!.data.localeCompare(dados.periodo.sessao.get(b[1][0])!.data),
  );

  const escalasMarcadas = filtradas.filter((e) => marcadas.has(e.sessaoId));
  const previa = previaLote(escalasMarcadas.map((e) => e.id), dados.base, dados.diaria);
  const datas = [...new Set(escalasMarcadas.map((e) => sessaoDe(e).data))];
  const periodoAuto = periodoReferencia(datas);
  const alternar = (ids: string[], ligar: boolean) => {
    const n = new Set(marcadas);
    ids.forEach((id) => (ligar ? n.add(id) : n.delete(id)));
    setMarcadas(n);
  };

  async function criarLote() {
    setErro(null);
    if (!escalasMarcadas.length) return setErro('Selecione ao menos uma sessão.');
    try {
      const lote = await criar.mutateAsync({
        escalaIds: escalasMarcadas.map((e) => e.id),
        titulo: titulo || `Lote ${periodoAuto.split(' ')[0] || ''}`.trim(),
        periodoReferencia: periodo ?? periodoAuto,
        edital: edital ?? dados.config?.edital ?? '',
        iniciativa: iniciativa ?? dados.config?.iniciativa ?? '',
        incluirZerados: zerados,
      });
      navegar(`/pagamentos/${lote.id}`);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Pagina titulo="Novo lote de pagamento" subtitulo="Escolha livremente as sessões realizadas que entram neste pagamento.">
      <div className="linha">
        <Campo rotulo="De">{(id) => <input id={id} className="cc-entrada" type="date" value={de} onChange={(e) => setDe(e.target.value)} />}</Campo>
        <Campo rotulo="Até">{(id) => <input id={id} className="cc-entrada" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />}</Campo>
      </div>

      {!eventosOrdenados.length ? (
        <EstadoVazio titulo="Nada para pagar" texto="Sessões aparecem aqui depois que a presença é confirmada." />
      ) : (
        <div className="grade-2">
          <Cartao titulo="Sessões realizadas e não pagas">
            <div className="pilha">
              {eventosOrdenados.map(([eventoId, sessaoIds]) => {
                const ev = dados.periodo.evento.get(eventoId);
                const todas = sessaoIds.every((id) => marcadas.has(id));
                return (
                  <div key={eventoId} className="pilha-2">
                    <label className="cc-caixa negrito">
                      <input
                        type="checkbox"
                        checked={todas}
                        aria-label={`Selecionar todas as sessões de ${ev?.nome}`}
                        onChange={(e) => alternar(sessaoIds, e.target.checked)}
                      />
                      {ev?.nome}
                    </label>
                    {sessaoIds.map((id) => {
                      const s = dados.periodo.sessao.get(id)!;
                      const qtd = porSessao.get(id)!.length;
                      return (
                        <label key={id} className="cc-caixa pequeno" style={{ paddingLeft: 26 }}>
                          <input type="checkbox" checked={marcadas.has(id)} onChange={(e) => alternar([id], e.target.checked)} />
                          {dataLonga(s.data)} · {tituloSessao(ev, s)} · {qtd} bolsista(s) × {formatarReais(valorDaSessao(s, dados.diaria))}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Cartao>

          <div className="pilha">
            <Cartao titulo="Prévia">
              <div className="pilha">
                <Tabela
                  colunas={[
                    { chave: 'nome', titulo: 'Bolsista', render: (l) => dados.pessoas.pessoa.get(l.pessoaId)?.nome ?? l.pessoaId },
                    { chave: 'qtd', titulo: 'Sessões', alinhar: 'direita' },
                    { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (l) => formatarReais(l.valor) },
                  ]}
                  linhas={[...previa.porPessoa].sort((a, b) =>
                    (dados.pessoas.pessoa.get(a.pessoaId)?.nome ?? '').localeCompare(dados.pessoas.pessoa.get(b.pessoaId)?.nome ?? '', 'pt-BR'),
                  )}
                  chaveLinha={(l) => l.pessoaId}
                  vazio="Selecione sessões ao lado."
                />
                <div className="linha-entre">
                  <strong>Total do lote</strong>
                  <strong className="cc-numero" data-testid="total-lote">
                    {formatarReais(previa.total)}
                  </strong>
                </div>
              </div>
            </Cartao>
            <Cartao titulo="Cabeçalho da ficha">
              <div className="pilha">
                <Campo rotulo="Título do lote">{(id) => <input id={id} className="cc-entrada" value={titulo} placeholder="Ex.: Lote outubro" onChange={(e) => setTitulo(e.target.value)} />}</Campo>
                <Campo rotulo="Período de referência" ajuda="Calculado pelas datas escolhidas; pode editar.">
                  {(id) => <input id={id} className="cc-entrada" value={periodo ?? periodoAuto} onChange={(e) => setPeriodo(e.target.value)} />}
                </Campo>
                <Campo rotulo="Edital">{(id) => <input id={id} className="cc-entrada" value={edital ?? dados.config?.edital ?? ''} onChange={(e) => setEdital(e.target.value)} />}</Campo>
                <Campo rotulo="Iniciativa">
                  {(id) => <input id={id} className="cc-entrada" value={iniciativa ?? dados.config?.iniciativa ?? ''} onChange={(e) => setIniciativa(e.target.value)} />}
                </Campo>
                <label className="cc-caixa">
                  <input type="checkbox" checked={zerados} onChange={(e) => setZerados(e.target.checked)} />
                  Incluir bolsistas sem valor na ficha
                </label>
                {erro && <Alerta tom="erro">{erro}</Alerta>}
                <div>
                  <Botao variante="primario" carregando={criar.isPending} onClick={criarLote}>
                    Criar lote
                  </Botao>
                </div>
              </div>
            </Cartao>
          </div>
        </div>
      )}
    </Pagina>
  );
}
