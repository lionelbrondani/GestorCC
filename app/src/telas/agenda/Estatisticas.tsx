import { TIPOS_EVENTO } from '@shared';
import { useState } from 'react';
import { usePeriodo } from '../../api/consultas';
import { Campo, Carregando, Cartao, Tabela } from '../../componentes';
import { hoje } from '../../util/hoje';

export function Estatisticas() {
  const [de, setDe] = useState(`${hoje().slice(0, 4)}-01-01`);
  const [ate, setAte] = useState(hoje());
  const [tipo, setTipo] = useState('');
  const periodo = usePeriodo(de, ate);
  if (periodo.isLoading) return <Carregando />;

  const eventos = periodo.eventos.filter((e) => e.status === 'ativo' && (!tipo || e.tipo === tipo));
  const publico = (e: (typeof eventos)[number]) => e.publicoReal ?? 0;
  const total = eventos.length;
  const publicoTotal = eventos.reduce((acc, e) => acc + publico(e), 0);
  const comPublico = eventos.filter((e) => e.publicoReal !== undefined).length;
  const media = comPublico ? Math.round(publicoTotal / comPublico) : 0;
  const porTipo = TIPOS_EVENTO.map((t) => {
    const lista = eventos.filter((e) => e.tipo === t);
    return { tipo: t, qtd: lista.length, publico: lista.reduce((acc, e) => acc + publico(e), 0) };
  }).filter((x) => x.qtd > 0);
  const n = (v: number) => v.toLocaleString('pt-BR');

  return (
    <div className="pilha">
      <div className="linha">
        <Campo rotulo="De">{(id) => <input id={id} className="cc-entrada" type="date" value={de} onChange={(e) => setDe(e.target.value)} />}</Campo>
        <Campo rotulo="Até">{(id) => <input id={id} className="cc-entrada" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />}</Campo>
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} className="cc-entrada" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </Campo>
      </div>
      <div className="grade-cartoes">
        <Cartao>
          <div className="cc-rotulo-numero">Total de eventos</div>
          <div className="cc-numero">{n(total)}</div>
        </Cartao>
        <Cartao>
          <div className="cc-rotulo-numero">Público total aproximado</div>
          <div className="cc-numero">{n(publicoTotal)}</div>
        </Cartao>
        <Cartao>
          <div className="cc-rotulo-numero">Média de público</div>
          <div className="cc-numero">{n(media)}</div>
        </Cartao>
      </div>
      <Tabela
        colunas={[
          { chave: 'tipo', titulo: 'Tipo de evento' },
          { chave: 'qtd', titulo: 'Eventos', alinhar: 'direita', render: (l) => n(l.qtd) },
          { chave: 'publico', titulo: 'Público', alinhar: 'direita', render: (l) => n(l.publico) },
        ]}
        linhas={porTipo}
        chaveLinha={(l) => l.tipo}
        vazio="Nenhum evento no período."
      />
      <p className="pequeno texto-3">O público conta só eventos com "público real" preenchido.</p>
    </div>
  );
}
