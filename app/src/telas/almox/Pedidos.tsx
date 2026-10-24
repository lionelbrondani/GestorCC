import { estoqueCritico, formatarData, formatarReais, pode, quantidadeSugerida, type AlmoxPedido } from '@shared';
import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Carregando, Cartao, Etiqueta, Modal, Tabela } from '../../componentes';
import { hoje } from '../../util/hoje';

const INVALIDAR = ['almox.listar', 'almox.pedidos', 'almox.movimentos', 'historico.listar'] as const;
const ETIQUETA: Record<AlmoxPedido['status'], 'aviso' | 'info' | 'sucesso' | 'neutro'> = { aberto: 'aviso', parcial: 'info', recebido: 'sucesso', cancelado: 'neutro' };

function ModalReceber({ pedido, nome, aoFechar }: { pedido: AlmoxPedido; nome: (cod: string) => string; aoFechar: () => void }) {
  const receber = useMutacao('almox.receber', [...INVALIDAR]);
  const [qtds, setQtds] = useState<Record<string, number>>(() => Object.fromEntries(pedido.itens.map((i) => [i.cod, Math.max(0, i.qtdPedida - i.qtdRecebida)])));
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Modal
      aberto
      titulo={`Receber pedido ${pedido.id}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            carregando={receber.isPending}
            onClick={async () => {
              setErro(null);
              try {
                await receber.mutateAsync({ pedidoId: pedido.id, itens: Object.entries(qtds).map(([cod, qtd]) => ({ cod, qtd })) });
                aoFechar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Registrar recebimento
          </Botao>
        </>
      }
    >
      <div className="pilha-2">
        <p className="pequeno texto-2">Informe o que chegou. O que faltar continua pendente no pedido.</p>
        {pedido.itens.map((i) => (
          <div key={i.cod} className="linha-entre">
            <span>
              [{i.cod}] {nome(i.cod)} <span className="pequeno texto-3">({i.qtdRecebida}/{i.qtdPedida} recebidos)</span>
            </span>
            <input
              className="cc-entrada"
              type="number"
              min={0}
              style={{ width: 90 }}
              aria-label={`Recebido de ${nome(i.cod)}`}
              value={qtds[i.cod]}
              onChange={(e) => setQtds({ ...qtds, [i.cod]: Number(e.target.value) })}
            />
          </div>
        ))}
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

export function Pedidos() {
  const eu = useEu();
  const almox = useConsulta('almox.listar', null);
  const pedidos = useConsulta('almox.pedidos', null);
  const criar = useMutacao('almox.criarPedido', [...INVALIDAR]);
  const [sugestao, setSugestao] = useState<Record<string, number>>({});
  const [recebendo, setRecebendo] = useState<AlmoxPedido | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const criticos = (almox.data?.itens ?? []).filter(estoqueCritico);

  useEffect(() => {
    setSugestao(Object.fromEntries(criticos.map((i) => [i.cod, quantidadeSugerida(i)])));
    // recalcula quando a lista de itens muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almox.data]);

  if (almox.isLoading || pedidos.isLoading) return <Carregando />;
  const editar = pode(eu.permissoes, 'almoxEstoque', 'editar');
  const item = (cod: string) => almox.data!.itens.find((i) => i.cod === cod);
  const nome = (cod: string) => item(cod)?.nomeComum || item(cod)?.nomeAlmox || cod;
  const selecionados = criticos.filter((i) => (sugestao[i.cod] ?? 0) > 0);
  const total = selecionados.reduce((acc, i) => acc + i.valor * (sugestao[i.cod] ?? 0), 0);

  return (
    <div className="pilha">
      <Cartao
        titulo={`Sugestão de compra (${criticos.length} itens no mínimo)`}
        acoes={
          <>
            <Botao tamanho="pequeno" onClick={() => window.print()}>
              <Printer size={14} aria-hidden /> Imprimir lista de compras
            </Botao>
            {editar && (
              <Botao
                tamanho="pequeno"
                variante="primario"
                disabled={!selecionados.length}
                carregando={criar.isPending}
                onClick={async () => {
                  await criar.mutateAsync({ itens: selecionados.map((i) => ({ cod: i.cod, qtdPedida: sugestao[i.cod], valorEstimado: i.valor })) });
                  setMsg('Pedido registrado.');
                }}
              >
                Registrar pedido
              </Botao>
            )}
          </>
        }
      >
        <div className="folha-impressao pilha-2">
          <p className="so-impressao">
            <strong>Lista de compras — Almoxarifado CC ({formatarData(hoje())})</strong>
          </p>
          <Tabela
            colunas={[
              { chave: 'cod', titulo: 'Cód.' },
              { chave: 'nome', titulo: 'Item', render: (i) => i.nomeComum || i.nomeAlmox },
              { chave: 'saldo', titulo: 'Saldo', alinhar: 'direita' },
              { chave: 'min', titulo: 'Mínimo', alinhar: 'direita', render: (i) => i.qtdMinima },
              {
                chave: 'qtd',
                titulo: 'Pedir',
                alinhar: 'direita',
                render: (i) => (
                  <input
                    className="cc-entrada"
                    type="number"
                    min={0}
                    style={{ width: 80 }}
                    aria-label={`Pedir de ${i.nomeComum}`}
                    value={sugestao[i.cod] ?? 0}
                    onChange={(e) => setSugestao({ ...sugestao, [i.cod]: Number(e.target.value) })}
                  />
                ),
              },
              { chave: 'valor', titulo: 'Estimado', alinhar: 'direita', render: (i) => formatarReais(i.valor * (sugestao[i.cod] ?? 0)) },
            ]}
            linhas={criticos}
            chaveLinha={(i) => i.cod}
            vazio="Nenhum item no estoque mínimo. 🎉"
          />
          <p className="pequeno texto-2">
            Sugestão = 2 × mínimo − saldo. Total estimado: <strong>{formatarReais(total)}</strong>
          </p>
        </div>
        {msg && <Alerta tom="sucesso">{msg}</Alerta>}
      </Cartao>

      <Cartao titulo="Pedidos">
        <Tabela
          colunas={[
            { chave: 'id', titulo: 'Pedido' },
            { chave: 'data', titulo: 'Data', render: (p) => formatarData(p.criadoEm.slice(0, 10)) },
            { chave: 'itens', titulo: 'Itens', render: (p) => p.itens.map((i) => `${nome(i.cod)} (${i.qtdRecebida}/${i.qtdPedida})`).join(', ') },
            { chave: 'status', titulo: 'Situação', render: (p) => <Etiqueta tom={ETIQUETA[p.status]}>{p.status}</Etiqueta> },
            {
              chave: 'acao',
              titulo: '',
              render: (p) =>
                editar &&
                (p.status === 'aberto' || p.status === 'parcial') && (
                  <Botao tamanho="pequeno" onClick={() => setRecebendo(p)}>
                    Receber
                  </Botao>
                ),
            },
          ]}
          linhas={pedidos.data ?? []}
          chaveLinha={(p) => p.id}
          vazio="Nenhum pedido registrado no protótipo."
        />
      </Cartao>
      {recebendo && <ModalReceber pedido={recebendo} nome={nome} aoFechar={() => setRecebendo(null)} />}
    </div>
  );
}
