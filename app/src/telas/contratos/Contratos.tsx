import { formatarData, formatarReais, pode, valorTotalContrato, type Contrato } from '@shared';
import { AlertTriangle, Check, Clock, Mail, Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Carregando, EstadoVazio, Etiqueta, Pagina } from '../../componentes';
import { useDadosContratos } from './dadosContratos';
import { etapasDoContrato, pedeAcao, ROTULO_ESTADO, type EstadoEtapa, type Etapa, type IdEtapa } from './trilha';
import './contratos.css';

export const AVISO_VERSAO_INICIAL = 'Versão inicial — campos e modelos serão revistos com a coordenação.';

const ICONE: Record<EstadoEtapa, typeof Check> = {
  feito: Check,
  andamento: Clock,
  pendente: Minus,
  atencao: AlertTriangle,
  atrasado: AlertTriangle,
  isento: Minus,
  cancelado: X,
};

/** As seis etapas como bolinhas coloridas ligadas por uma linha. */
export function Trilha({ etapas }: { etapas: Etapa[] }) {
  return (
    <ol className="trilha" aria-label="Situação do contrato">
      {etapas.map((e) => {
        const Icone = ICONE[e.estado];
        return (
          <li key={e.id} data-estado={e.estado} title={`${e.rotulo}: ${e.valor} (${ROTULO_ESTADO[e.estado]})`} aria-label={`${e.rotulo}: ${e.valor}`}>
            <span className="trilha-bolinha">
              <Icone size={14} aria-hidden />
            </span>
            <span className="trilha-rotulo">{e.rotulo}</span>
            <span className="trilha-valor">{e.valor}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Contratos() {
  const eu = useEu();
  const navegar = useNavigate();
  const dados = useDadosContratos();
  const [pendentes, setPendentes] = useState(false);
  const [etapaFiltro, setEtapaFiltro] = useState<IdEtapa | null>(null);
  if (dados.carregando) return <Carregando />;

  const comEtapas = dados.contratos.map((c) => ({ c, etapas: etapasDoContrato(c, dados.alertas(c)) }));
  const ativos = comEtapas.filter(({ c }) => c.statusContrato !== 'Cancelado');
  const resumo = (['contrato', 'fatura', 'ecad', 'iss', 'fundep', 'cortesias'] as IdEtapa[]).map((id) => {
    const daEtapa = ativos.map(({ etapas }) => etapas.find((e) => e.id === id)!);
    return {
      id,
      rotulo: daEtapa[0]?.rotulo ?? id,
      afazer: daEtapa.filter(pedeAcao).length,
      atrasados: daEtapa.filter((e) => e.estado === 'atrasado').length,
      atencao: daEtapa.filter((e) => e.estado === 'atencao').length,
    };
  });
  const lista = comEtapas
    .filter(({ c }) => !pendentes || dados.alertas(c).length > 0)
    .filter(({ etapas }) => !etapaFiltro || pedeAcao(etapas.find((e) => e.id === etapaFiltro)!))
    .sort((a, b) => dados.primeiraData(b.c).localeCompare(dados.primeiraData(a.c)));
  const editar = pode(eu.permissoes, 'contratos', 'editar');
  const data = (c: Contrato) => (dados.primeiraData(c) < '9999' ? formatarData(dados.primeiraData(c)) : 'sem data');

  return (
    <Pagina
      titulo="Contratos"
      subtitulo="Contratos de uso do espaço, faturas e obrigações."
      acoes={
        editar && (
          <>
            <Link to="/contratos/fundep" className="cc-botao" data-variante="secundario">
              <Mail size={16} aria-hidden /> Solicitar faturas à FUNDEP
            </Link>
            <Botao variante="primario" onClick={() => navegar('/contratos/novo')}>
              <Plus size={16} aria-hidden /> Novo contrato
            </Botao>
          </>
        )
      }
    >
      <Alerta tom="info">{AVISO_VERSAO_INICIAL}</Alerta>

      <div className="contratos-resumo" role="group" aria-label="O que falta fazer, por etapa">
        {resumo.map((r) => (
          <button
            key={r.id}
            type="button"
            className="contratos-resumo-item"
            aria-pressed={etapaFiltro === r.id}
            data-estado={r.atrasados ? 'atrasado' : r.atencao ? 'atencao' : r.afazer ? 'pendente' : 'feito'}
            onClick={() => setEtapaFiltro(etapaFiltro === r.id ? null : r.id)}
          >
            <strong>{r.afazer}</strong>
            <span>{r.rotulo}</span>
            <small>{r.atrasados ? `${r.atrasados} atrasado(s)` : r.atencao ? `${r.atencao} com prazo perto` : r.afazer ? 'a fazer' : 'tudo em dia'}</small>
          </button>
        ))}
      </div>

      <div className="linha-entre">
        <label className="cc-caixa">
          <input type="checkbox" checked={pendentes} onChange={(e) => setPendentes(e.target.checked)} />
          Só com pendências
        </label>
        {etapaFiltro && (
          <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEtapaFiltro(null)}>
            <X size={14} aria-hidden /> Mostrar todas as etapas
          </Botao>
        )}
      </div>

      {lista.length === 0 ? (
        <EstadoVazio titulo={pendentes || etapaFiltro ? 'Nenhum contrato com pendência aqui. 🎉' : 'Nenhum contrato cadastrado.'} />
      ) : (
        <ul className="contratos-lista">
          {lista.map(({ c, etapas }) => (
            <li key={c.id}>
              <Link to={`/contratos/${c.id}`} className="contrato-cartao" data-cancelado={c.statusContrato === 'Cancelado' || undefined}>
                <div className="contrato-cabecalho">
                  <span className="pilha-2" style={{ gap: 2 }}>
                    <strong>{dados.periodo.evento.get(c.eventoId)?.nome ?? '—'}</strong>
                    <span className="pequeno texto-2">{dados.contratantes.find((k) => k.id === c.contratanteId)?.razaoSocial}</span>
                  </span>
                  <span className="contrato-meta">
                    <span className="negrito">{data(c)}</span>
                    <span className="pequeno texto-2">
                      Nº <span>{c.numero}</span> · {formatarReais(valorTotalContrato(c, dados.aditivos))}
                    </span>
                    {c.statusContrato === 'Cancelado' && <Etiqueta tom="erro">Cancelado</Etiqueta>}
                  </span>
                </div>
                <Trilha etapas={etapas} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
