import { diasDoMes, formatarData, formatarReais, mesExtenso, pode } from '@shared';
import { AlertTriangle, Building2, CalendarDays, FileSignature, Package, Printer, Users, Wallet, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Botao, Carregando, Cartao, Etiqueta, Pagina, Tabela } from '../../componentes';
import { hoje } from '../../util/hoje';
import { CabecalhoImpresso } from '../impressao/ModeloImpressao';
import { levantamentoMensal } from './levantamento';
import './relatorio.css';

function Numero({ icone, valor, rotulo, tom }: { icone: ReactNode; valor: ReactNode; rotulo: string; tom: string }) {
  return (
    <div className="rel-numero" data-tom={tom}>
      <span className="rel-numero-icone" aria-hidden>
        {icone}
      </span>
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  );
}

/** Linha "rótulo ........ valor" dos quadros de totais. */
function Total({ rotulo, valor, destaque }: { rotulo: string; valor: ReactNode; destaque?: boolean }) {
  return (
    <div className="rel-total" data-destaque={destaque || undefined}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

/** Barra horizontal com o percentual (ocupação, pago × contratado). */
function Barra({ parte, total, rotulo }: { parte: number; total: number; rotulo: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((parte / total) * 100)) : 0;
  return (
    <span className="rel-barra" title={rotulo}>
      <span style={{ width: `${pct}%` }} />
      <em>{rotulo}</em>
    </span>
  );
}

/** Relatório mensal do setor (gestão administrativa): agenda e ocupação, equipe, pagamentos, contratos, fichas, almoxarifado e prédio. */
export function RelatorioMensal() {
  const eu = useEu();
  const [params, setParams] = useSearchParams();
  const mes = params.get('mes') || hoje().slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const dias = diasDoMes(ano, m);
  const de = dias[0];
  const ate = dias[dias.length - 1];
  const p = eu.permissoes;
  const periodo = usePeriodo(de, ate);
  const pessoas = usePessoas();
  const escalas = useConsulta('escalas.listar', { de, ate });
  const config = useConsulta('config.obter', null);
  const lotes = useConsulta('lotes.listar', null, { habilitada: pode(p, 'pagamentos', 'ver') });
  const contratos = useConsulta('contratos.listar', null, { habilitada: pode(p, 'contratos', 'ver') });
  const fichas = useConsulta('fichas.listar', null, { habilitada: pode(p, 'eventos', 'editar') });
  const almox = useConsulta('almox.listar', null, { habilitada: pode(p, 'almoxEstoque', 'ver') });
  const movimentos = useConsulta('almox.movimentos', {}, { habilitada: pode(p, 'almoxEstoque', 'ver') });
  const infra = useConsulta('infra.listar', null, { habilitada: pode(p, 'infraestrutura', 'ver') });
  const eventoIds = periodo.eventos.map((ev) => ev.id);
  const cortesias = useConsulta('cortesias.resumo', { eventoIds }, { habilitada: !periodo.isLoading && pode(p, 'eventos', 'editar') });

  if (periodo.isLoading || pessoas.isLoading || escalas.isLoading || config.isLoading) return <Carregando />;

  const r = levantamentoMensal({
    mes,
    eventos: periodo.eventos,
    sessoes: periodo.sessoes,
    escalas: escalas.data ?? [],
    pessoas: pessoas.lista,
    diariaPadrao: config.data?.diariaPadrao ?? 0,
    lotes: lotes.data?.lotes ?? [],
    loteItens: lotes.data?.itens ?? [],
    contratos: contratos.data?.contratos ?? [],
    aditivos: contratos.data?.aditivos ?? [],
    fichas: fichas.data ?? [],
    movimentos: movimentos.data ?? [],
    itensAlmox: almox.data?.itens ?? [],
    ocorrencias: infra.data ?? [],
    cortesias: cortesias.data ?? [],
  });
  const tomSituacao = (v: string) => (v === '—' ? 'neutro' : ['Pago', 'Paga', 'Isento', 'Distribuídas'].includes(v) ? 'sucesso' : v.startsWith('Enviad') || v === 'Recebidas' ? 'info' : 'aviso');
  const ct = r.cortesiasTotais;
  const nomeMes = `${mesExtenso(m)}/${ano}`;
  const e = r.equipe;
  const c = r.contratosResumo;
  const fichasEnviadas = r.fichas.filter((f) => f.status === 'enviada').length;

  return (
    <Pagina
      titulo="Relatório mensal"
      subtitulo={`${nomeMes.charAt(0)}${nomeMes.slice(1).toLowerCase()} · panorama administrativo do setor`}
      acoes={
        <>
          <input type="month" className="cc-entrada" style={{ width: 'auto' }} value={mes} aria-label="Mês" onChange={(ev) => ev.target.value && setParams({ mes: ev.target.value }, { replace: true })} />
          <Botao variante="primario" onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Imprimir
          </Botao>
        </>
      }
    >
      <div className="folha-impressao relatorio-mensal">
        <CabecalhoImpresso titulo={`RELATÓRIO MENSAL · ${nomeMes}`} subtitulo={`Centro de Convenções · gerado em ${formatarData(hoje())} pelo GestorCC`} />

        <div className="rel-numeros">
          <Numero tom="info" icone={<CalendarDays size={20} />} valor={r.resumo.eventos} rotulo={`eventos · ${r.resumo.sessoes} sessões`} />
          <Numero tom="destaque" icone={<Users size={20} />} valor={(r.resumo.publicoReal || r.resumo.publicoEstimado).toLocaleString('pt-BR')} rotulo={r.resumo.publicoReal ? 'público (real)' : 'público estimado'} />
          <Numero tom="info" icone={<Building2 size={20} />} valor={`${r.ocupacao.percentual}%`} rotulo={`ocupação · ${r.ocupacao.diasComUso} de ${r.ocupacao.diasNoMes} dias`} />
          <Numero tom="aviso" icone={<Wrench size={20} />} valor={r.resumo.apoio} rotulo="atividades de apoio" />
          <Numero tom="sucesso" icone={<Wallet size={20} />} valor={formatarReais(e.valorDiarias)} rotulo={`em diárias · ${e.diarias} diária(s)`} />
          {pode(p, 'contratos', 'ver') && <Numero tom="sucesso" icone={<FileSignature size={20} />} valor={formatarReais(c.valorTotal)} rotulo={`contratado · ${c.quantidade} contrato(s)`} />}
          {pode(p, 'almoxEstoque', 'ver') && <Numero tom="aviso" icone={<Package size={20} />} valor={formatarReais(r.resumo.saidasAlmox)} rotulo="consumo do almoxarifado" />}
          {pode(p, 'infraestrutura', 'ver') && <Numero tom="erro" icone={<AlertTriangle size={20} />} valor={r.ocorrencias.abertas.length} rotulo={`ocorrências em aberto · ${r.resumo.ocorrenciasResolvidas} resolvida(s)`} />}
        </div>

        <Cartao titulo="Agenda e ocupação do espaço">
          <Barra parte={r.ocupacao.diasComUso} total={r.ocupacao.diasNoMes} rotulo={`${r.ocupacao.diasComUso} de ${r.ocupacao.diasNoMes} dias com uso (eventos e apoio)`} />
          <Tabela
            colunas={[
              { chave: 'tipo', titulo: 'Tipo de evento', render: (t) => <span className="negrito">{t.tipo}</span> },
              { chave: 'eventos', titulo: 'Eventos', alinhar: 'centro', render: (t) => t.eventos },
              { chave: 'sessoes', titulo: 'Sessões', alinhar: 'centro', render: (t) => t.sessoes },
              { chave: 'publico', titulo: 'Público', alinhar: 'direita', render: (t) => t.publico.toLocaleString('pt-BR') },
            ]}
            linhas={r.porTipo}
            chaveLinha={(t) => t.tipo}
            vazio="Nenhum evento neste mês."
          />
          <Tabela
            colunas={[
              { chave: 'datas', titulo: 'Dia(s)', render: (x) => x.datas.map((d) => d.slice(8, 10)).join(', ') },
              { chave: 'nome', titulo: 'Evento', render: (x) => x.evento.nome },
              { chave: 'tipo', titulo: 'Tipo', render: (x) => x.evento.tipo },
              { chave: 'instrumento', titulo: 'Instrumento', render: (x) => ({ contrato: 'Contrato', termo: 'Termo', nenhum: '—' })[x.evento.instrumento] },
              { chave: 'pagamento', titulo: 'Bolsistas pagos por', render: (x) => (x.evento.pagamento === 'externo' ? x.evento.pagadorExterno || 'Externo' : 'UFSM') },
            ]}
            linhas={r.eventos}
            chaveLinha={(x) => x.evento.id}
          />
        </Cartao>

        <div className="grade-2">
          <Cartao titulo="Equipe e escalas">
            <Total rotulo="Pessoas envolvidas" valor={e.pessoas} />
            <Total rotulo="Escalas cumpridas" valor={e.realizadas} />
            <Total rotulo="Faltas" valor={e.faltas} />
            <Total rotulo="Atividades de apoio" valor={r.resumo.apoio} />
            <Total rotulo="Diárias do mês (UFSM)" valor={`${e.diarias} · ${formatarReais(e.valorDiarias)}`} destaque />
            <Total rotulo="Já enviadas em lote" valor={formatarReais(e.valorEmLote)} />
            <Total rotulo="Já pagas" valor={formatarReais(e.valorPago)} />
            <Total rotulo="Ainda a enviar" valor={formatarReais(Math.max(0, e.valorDiarias - e.valorEmLote))} destaque />
          </Cartao>

          {pode(p, 'contratos', 'ver') && (
            <Cartao titulo="Contratos dos eventos do mês">
              <Total rotulo="Contratos" valor={c.quantidade} />
              <Total rotulo="Valor contratado" valor={formatarReais(c.valorTotal)} destaque />
              <Total rotulo="Faturas pagas" valor={formatarReais(c.valorPago)} />
              <Barra parte={c.valorPago} total={c.valorTotal} rotulo={`${c.valorTotal ? Math.round((c.valorPago / c.valorTotal) * 100) : 0}% recebido`} />
              <Total rotulo="Sem assinatura" valor={c.semAssinatura ? <Etiqueta tom="aviso">{c.semAssinatura}</Etiqueta> : '—'} />
              <Total rotulo="Fatura pendente" valor={c.faturaPendente ? <Etiqueta tom="aviso">{c.faturaPendente}</Etiqueta> : '—'} />
              <Total rotulo="ECAD ou ISS pendente" valor={c.ecadIssPendente ? <Etiqueta tom="aviso">{c.ecadIssPendente}</Etiqueta> : '—'} />
            </Cartao>
          )}
        </div>

        {pode(p, 'contratos', 'ver') && (
          <Cartao titulo="ECAD, ISS e cortesias por evento">
            <div className="rel-faixa">
              <span>
                Cortesias recebidas <strong>{ct.recebidas}</strong>
              </span>
              <span>
                Distribuídas a {ct.destinos} destino(s) <strong>{ct.distribuidas}</strong>
              </span>
              <span>
                Nomes lançados <strong>{ct.lancados}</strong>
              </span>
            </div>
            <Tabela
              colunas={[
                {
                  chave: 'evento',
                  titulo: 'Evento',
                  render: (x) => (
                    <span>
                      <span className="negrito">{x.evento.nome}</span> <span className="pequeno texto-2">· {x.datas.map((d) => d.slice(8, 10)).join(', ')}</span>
                    </span>
                  ),
                },
                { chave: 'ecad', titulo: 'ECAD', render: (x) => <Etiqueta tom={tomSituacao(x.ecad)}>{x.ecad}</Etiqueta> },
                { chave: 'iss', titulo: 'ISS', render: (x) => <Etiqueta tom={tomSituacao(x.iss)}>{x.iss}</Etiqueta> },
                {
                  chave: 'cortesias',
                  titulo: 'Cortesias (contrato)',
                  render: (x) => (x.cortesiasContrato ? <span>{x.cortesiasContrato} · <Etiqueta tom={tomSituacao(x.statusCortesias)}>{x.statusCortesias}</Etiqueta></span> : '—'),
                },
                { chave: 'distribuicao', titulo: 'Distribuição (nomes/qtd.)', render: (x) => (x.destinos ? <span className="pequeno">{x.destinos}</span> : '—') },
              ]}
              linhas={r.eventosAdmin}
              chaveLinha={(x) => x.evento.id}
              vazio="Nenhum evento neste mês."
            />
          </Cartao>
        )}

        {pode(p, 'pagamentos', 'ver') && r.lotes.length > 0 && (
          <Cartao titulo="Lotes de pagamento">
            <Tabela
              colunas={[
                { chave: 'titulo', titulo: 'Lote', render: (l) => l.lote.titulo },
                { chave: 'status', titulo: 'Situação', render: (l) => <Etiqueta tom={l.lote.status === 'pago' ? 'sucesso' : l.lote.status === 'cancelado' ? 'erro' : 'info'}>{l.lote.status}</Etiqueta> },
                { chave: 'itens', titulo: 'Diárias', alinhar: 'centro', render: (l) => l.itens },
                { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (l) => formatarReais(l.valor) },
              ]}
              linhas={r.lotes}
              chaveLinha={(l) => l.lote.id}
            />
          </Cartao>
        )}

        <div className="grade-2">
          {pode(p, 'eventos', 'editar') && (
            <Cartao titulo="Fichas técnicas">
              <Total rotulo="Enviadas pelo produtor" valor={fichasEnviadas} />
              <Total rotulo="Aguardando o produtor" valor={r.fichas.length - fichasEnviadas ? <Etiqueta tom="aviso">{r.fichas.length - fichasEnviadas}</Etiqueta> : '—'} />
              <Total rotulo="Eventos sem ficha gerada" valor={Math.max(0, r.eventos.length - r.fichas.length)} />
            </Cartao>
          )}
          {pode(p, 'almoxEstoque', 'ver') && (
            <Cartao titulo="Almoxarifado">
              <Total rotulo="Consumo no mês" valor={formatarReais(r.resumo.saidasAlmox)} destaque />
              <Total rotulo="Itens retirados" valor={r.almox.length} />
              <Total rotulo="Itens no mínimo (repor)" valor={r.itensCriticos.length ? <Etiqueta tom="erro">{r.itensCriticos.length}</Etiqueta> : '—'} />
              {r.itensCriticos.length > 0 && <p className="pequeno texto-2" style={{ margin: 0 }}>{r.itensCriticos.map((i) => i.nomeComum || i.nomeAlmox).join(', ')}</p>}
            </Cartao>
          )}
        </div>

        {pode(p, 'infraestrutura', 'ver') && (
          <Cartao titulo="Prédio (ocorrências)">
            <Tabela
              colunas={[
                { chave: 'categoria', titulo: 'Categoria', render: (o) => o.categoria },
                { chave: 'abertas', titulo: 'Em aberto', alinhar: 'centro', render: (o) => (o.abertas ? <Etiqueta tom="aviso">{o.abertas}</Etiqueta> : '—') },
                { chave: 'resolvidas', titulo: 'Resolvidas no mês', alinhar: 'centro', render: (o) => o.resolvidas || '—' },
              ]}
              linhas={r.ocorrenciasPorCategoria}
              chaveLinha={(o) => o.categoria}
              vazio="Nenhuma ocorrência em aberto ou resolvida no mês."
            />
          </Cartao>
        )}
      </div>
    </Pagina>
  );
}
