import { formatarData, formatarReais, pode, valorTotalContrato, type Contrato } from '@shared';
import { Mail, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Carregando, Etiqueta, Pagina, Tabela } from '../../componentes';
import { tomStatus, useDadosContratos } from './dadosContratos';

export const AVISO_VERSAO_INICIAL = 'Versão inicial — campos e modelos serão revistos com a coordenação.';

function Situacoes({ c, vencida }: { c: Contrato; vencida: boolean }) {
  const itens: [string, string][] = [
    ['Contrato', c.statusContrato],
    ['Fatura', vencida ? 'Vencida' : c.statusFatura],
    ['ECAD', c.statusEcad],
    ['ISS', c.statusIss],
    ['FUNDEP', c.statusFundep],
    ['Cortesias', c.statusCortesias],
  ];
  return (
    <span className="linha" style={{ gap: 4 }}>
      {itens.map(([rotulo, valor]) => (
        <Etiqueta key={rotulo} tom={valor === 'Vencida' ? 'erro' : tomStatus(valor)} title={`${rotulo}: ${valor}`}>
          {rotulo}: {valor}
        </Etiqueta>
      ))}
    </span>
  );
}

export function Contratos() {
  const eu = useEu();
  const navegar = useNavigate();
  const dados = useDadosContratos();
  const [pendentes, setPendentes] = useState(false);
  if (dados.carregando) return <Carregando />;

  const lista = dados.contratos
    .filter((c) => !pendentes || dados.alertas(c).length > 0)
    .sort((a, b) => dados.primeiraData(b).localeCompare(dados.primeiraData(a)));
  const editar = pode(eu.permissoes, 'contratos', 'editar');

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
      <label className="cc-caixa">
        <input type="checkbox" checked={pendentes} onChange={(e) => setPendentes(e.target.checked)} />
        Só com pendências
      </label>
      <Tabela
        colunas={[
          {
            chave: 'evento',
            titulo: 'Evento',
            render: (c) => (
              <span className="pilha-2" style={{ gap: 2 }}>
                <strong>{dados.periodo.evento.get(c.eventoId)?.nome ?? '—'}</strong>
                <span className="pequeno texto-2">{dados.contratantes.find((k) => k.id === c.contratanteId)?.razaoSocial}</span>
              </span>
            ),
          },
          { chave: 'numero', titulo: 'Nº' },
          { chave: 'data', titulo: 'Data', render: (c) => (dados.primeiraData(c) < '9999' ? formatarData(dados.primeiraData(c)) : '—') },
          { chave: 'valor', titulo: 'Valor total', alinhar: 'direita', render: (c) => formatarReais(valorTotalContrato(c, dados.aditivos)) },
          { chave: 'situacao', titulo: 'Situação', render: (c) => <Situacoes c={c} vencida={dados.alertas(c).includes('faturaVencida')} /> },
        ]}
        linhas={lista}
        chaveLinha={(c) => c.id}
        aoClicar={(c) => navegar(`/contratos/${c.id}`)}
        vazio={pendentes ? 'Nenhum contrato com pendência. 🎉' : 'Nenhum contrato cadastrado.'}
      />
    </Pagina>
  );
}
