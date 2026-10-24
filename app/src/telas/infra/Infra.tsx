import {
  CATEGORIAS_INFRA,
  chamadosAtrasados,
  diasEmAberto,
  formatarData,
  pode,
  ROTULO_STATUS_OCORRENCIA,
  STATUS_ABERTOS,
  type StatusOcorrencia,
} from '@shared';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Carregando, Etiqueta, Pagina, Tabela } from '../../componentes';
import { hoje } from '../../util/hoje';
import { EtiquetaPrioridade, EtiquetaStatus, INVALIDAR_INFRA } from './comum';

const PESO_PRIORIDADE = { urgente: 0, alta: 1, media: 2, baixa: 3 } as const;

export function Infra() {
  const eu = useEu();
  const navegar = useNavigate();
  const q = useConsulta('infra.listar', null);
  const importar = useMutacao('infra.importarFormulario', [...INVALIDAR_INFRA]);
  const [filtro, setFiltro] = useState<'abertas' | 'todas' | StatusOcorrencia>('abertas');
  const [categoria, setCategoria] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  if (q.isLoading) return <Carregando />;

  const todas = q.data ?? [];
  const editar = pode(eu.permissoes, 'infraestrutura', 'editar');
  const atrasados = new Set(chamadosAtrasados(todas, hoje()).map((o) => o.id));
  const contagem = (s: StatusOcorrencia) => todas.filter((o) => o.status === s).length;
  const lista = todas
    .filter((o) => (filtro === 'todas' ? true : filtro === 'abertas' ? STATUS_ABERTOS.includes(o.status) : o.status === filtro))
    .filter((o) => !categoria || o.categoria === categoria)
    .sort(
      (a, b) =>
        Number(STATUS_ABERTOS.includes(b.status)) - Number(STATUS_ABERTOS.includes(a.status)) ||
        PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
        a.criadaEm.localeCompare(b.criadaEm),
    );

  return (
    <Pagina
      titulo="Infraestrutura"
      subtitulo="Problemas do prédio relatados pelo formulário e pela equipe, e os chamados abertos na UFSM."
      acoes={
        <>
          {editar && (
            <Botao
              carregando={importar.isPending}
              onClick={async () => {
                const r = await importar.mutateAsync(null);
                setMsg(r.importadas ? `${r.importadas} nova(s) ocorrência(s) importada(s) do formulário.` : 'Nenhuma resposta nova no formulário.');
              }}
            >
              <Download size={16} aria-hidden /> Importar respostas do formulário
            </Botao>
          )}
          <Botao variante="primario" onClick={() => navegar('/relatar')}>
            <Plus size={16} aria-hidden /> Relatar problema
          </Botao>
        </>
      }
    >
      {msg && <Alerta tom="sucesso">{msg}</Alerta>}
      {atrasados.size > 0 && (
        <Alerta tom="aviso">
          {atrasados.size} chamado(s) aberto(s) na UFSM há mais de 7 dias sem atendimento. Vale cobrar o andamento.
        </Alerta>
      )}
      <div className="linha">
        {(['abertas', 'nova', 'analise', 'chamado', 'atendimento', 'resolvida', 'naoProcede', 'todas'] as const).map((f) => (
          <button
            key={f}
            className="cc-botao"
            data-variante={filtro === f ? 'primario' : 'secundario'}
            data-tamanho="pequeno"
            onClick={() => setFiltro(f)}
          >
            {f === 'abertas'
              ? `Abertas (${todas.filter((o) => STATUS_ABERTOS.includes(o.status)).length})`
              : f === 'todas'
                ? `Todas (${todas.length})`
                : `${ROTULO_STATUS_OCORRENCIA[f]} (${contagem(f)})`}
          </button>
        ))}
        <select className="cc-entrada" style={{ width: 'auto' }} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todos os tipos</option>
          {CATEGORIAS_INFRA.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <Tabela
        colunas={[
          { chave: 'numero', titulo: 'Nº', render: (o) => `#${o.numero}` },
          {
            chave: 'titulo',
            titulo: 'Ocorrência',
            render: (o) => (
              <span className="pilha-2" style={{ gap: 2 }}>
                <strong>{o.titulo}</strong>
                <span className="pequeno texto-2">
                  {o.local} · {o.categoria} · {o.origem === 'formulario' ? 'formulário' : 'app'} · {formatarData(o.criadaEm.slice(0, 10))}
                </span>
              </span>
            ),
          },
          { chave: 'prioridade', titulo: 'Prioridade', render: (o) => <EtiquetaPrioridade prioridade={o.prioridade} /> },
          {
            chave: 'status',
            titulo: 'Situação',
            render: (o) => (
              <span className="linha">
                <EtiquetaStatus status={o.status} />
                {atrasados.has(o.id) && <Etiqueta tom="erro">atrasado</Etiqueta>}
              </span>
            ),
          },
          { chave: 'chamado', titulo: 'Chamado UFSM', render: (o) => o.chamadoNumero || '—' },
          { chave: 'dias', titulo: 'Dias', alinhar: 'direita', render: (o) => diasEmAberto(o, hoje()) },
        ]}
        linhas={lista}
        chaveLinha={(o) => o.id}
        aoClicar={(o) => navegar(`/infra/${o.id}`)}
        vazio="Nenhuma ocorrência com este filtro. 🎉"
      />
    </Pagina>
  );
}
