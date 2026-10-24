import { formatarReais, mesExtenso } from '@shared';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Carregando, Cartao } from '../../componentes';
import { janela } from '../../util/hoje';

function Barras({ dados, formato }: { dados: { rotulo: string; valor: number }[]; formato: (v: number) => string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  if (!dados.length) return <p className="texto-3 pequeno">Sem dados.</p>;
  return (
    <div>
      {dados.map((d) => (
        <div key={d.rotulo} className="barra-h">
          <span title={d.rotulo} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.rotulo}
          </span>
          <div>
            <span style={{ width: `${(d.valor / max) * 100}%` }} />
          </div>
          <span className="numero">{formato(d.valor)}</span>
        </div>
      ))}
    </div>
  );
}

export function PainelAlmox() {
  const almox = useConsulta('almox.listar', null);
  const movs = useConsulta('almox.movimentos', {});
  const { de, ate } = janela(400, 60);
  const periodo = usePeriodo(de, ate);
  if (almox.isLoading || movs.isLoading) return <Carregando />;

  const itens = almox.data?.itens ?? [];
  const item = new Map(itens.map((i) => [i.cod, i]));
  const saidas = (movs.data ?? []).filter((m) => m.tipo === 'saida');
  const somar = <K extends string>(chave: (m: (typeof saidas)[number]) => K | undefined, valor: (m: (typeof saidas)[number]) => number) => {
    const mapa = new Map<K, number>();
    for (const m of saidas) {
      const k = chave(m);
      if (k) mapa.set(k, (mapa.get(k) ?? 0) + valor(m));
    }
    return mapa;
  };

  const porCategoria = new Map<string, number>();
  for (const i of itens.filter((x) => x.status === 'Ativo')) porCategoria.set(i.categoria, (porCategoria.get(i.categoria) ?? 0) + i.valor * Math.max(0, i.saldo));
  const porMes = somar((m) => m.quando.slice(0, 7), (m) => -m.qtd * m.valorUnitario);
  const porItem = somar((m) => m.cod, (m) => -m.qtd);
  const porEvento = somar((m) => m.eventoId, (m) => -m.qtd * m.valorUnitario);
  const ordenar = (mapa: Map<string, number>) => [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  const totalEstoque = [...porCategoria.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="pilha">
      <div className="grade-cartoes">
        <Cartao>
          <div className="cc-rotulo-numero">Valor em estoque</div>
          <div className="cc-numero">{formatarReais(totalEstoque)}</div>
        </Cartao>
        <Cartao>
          <div className="cc-rotulo-numero">Itens ativos</div>
          <div className="cc-numero">{itens.filter((i) => i.status === 'Ativo').length}</div>
        </Cartao>
        <Cartao>
          <div className="cc-rotulo-numero">Retiradas registradas</div>
          <div className="cc-numero">{saidas.length}</div>
        </Cartao>
      </div>
      <div className="grade-2">
        <Cartao titulo="Valor em estoque por categoria">
          <Barras dados={ordenar(porCategoria).map(([rotulo, valor]) => ({ rotulo, valor }))} formato={formatarReais} />
        </Cartao>
        <Cartao titulo="Consumo por mês (R$)">
          <Barras
            dados={[...porMes.entries()].sort().map(([mes, valor]) => ({ rotulo: `${mesExtenso(Number(mes.slice(5, 7))).slice(0, 3)}/${mes.slice(2, 4)}`, valor }))}
            formato={formatarReais}
          />
        </Cartao>
        <Cartao titulo="Itens mais retirados">
          <Barras
            dados={ordenar(porItem)
              .slice(0, 10)
              .map(([cod, valor]) => ({ rotulo: item.get(cod)?.nomeComum || cod, valor }))}
            formato={(v) => `${v} un.`}
          />
        </Cartao>
        <Cartao titulo="Consumo por evento (R$)">
          <Barras dados={ordenar(porEvento).map(([id, valor]) => ({ rotulo: periodo.evento.get(id)?.nome ?? 'Evento', valor }))} formato={formatarReais} />
        </Cartao>
      </div>
    </div>
  );
}
