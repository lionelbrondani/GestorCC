import { diasDoMes, formatarData, formatarReais, mesExtenso, pode } from '@shared';
import { AlertTriangle, CalendarDays, ClipboardCheck, Package, Printer, Users, Wallet } from 'lucide-react';
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

/** Relatório do mês para imprimir: tudo o que aconteceu e o que cada pessoa tem direito a receber. */
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
  });
  const nomeMes = `${mesExtenso(m)}/${ano}`;
  const maiorDiaria = Math.max(1, ...r.direitos.map((d) => d.valorInterno));

  return (
    <Pagina
      titulo="Relatório mensal"
      subtitulo={`${nomeMes.charAt(0)}${nomeMes.slice(1).toLowerCase()} · tudo o que aconteceu no mês e o que cada pessoa tem direito a receber`}
      acoes={
        <>
          <input type="month" className="cc-entrada" style={{ width: 'auto' }} value={mes} aria-label="Mês" onChange={(e) => e.target.value && setParams({ mes: e.target.value }, { replace: true })} />
          <Botao variante="primario" onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Imprimir
          </Botao>
        </>
      }
    >
      <div className="folha-impressao relatorio-mensal">
        <CabecalhoImpresso titulo={`RELATÓRIO MENSAL · ${nomeMes}`} subtitulo={`Gerado em ${formatarData(hoje())} pelo GestorCC`} />

        <div className="rel-numeros">
          <Numero tom="info" icone={<CalendarDays size={20} />} valor={r.resumo.eventos} rotulo={`eventos · ${r.resumo.sessoes} sessões`} />
          <Numero tom="destaque" icone={<Users size={20} />} valor={r.resumo.publicoEstimado.toLocaleString('pt-BR')} rotulo={`público estimado${r.resumo.publicoReal ? ` · ${r.resumo.publicoReal.toLocaleString('pt-BR')} real` : ''}`} />
          <Numero tom="sucesso" icone={<ClipboardCheck size={20} />} valor={r.resumo.realizadas} rotulo={`escalas cumpridas · ${r.resumo.faltas} falta(s)`} />
          <Numero tom="sucesso" icone={<Wallet size={20} />} valor={formatarReais(r.resumo.valorDiarias)} rotulo="em diárias (UFSM)" />
          <Numero tom="aviso" icone={<Package size={20} />} valor={formatarReais(r.resumo.saidasAlmox)} rotulo="saídas do almoxarifado" />
          <Numero tom="erro" icone={<AlertTriangle size={20} />} valor={r.resumo.ocorrenciasCriadas} rotulo={`ocorrências · ${r.resumo.ocorrenciasResolvidas} resolvida(s)`} />
        </div>

        <Cartao titulo="O que cada pessoa tem direito">
          <Tabela
            colunas={[
              { chave: 'nome', titulo: 'Pessoa', render: (d) => <span className="negrito">{d.pessoa.nome}</span> },
              { chave: 'escalas', titulo: 'Escalas', alinhar: 'centro', render: (d) => `${d.realizadas}/${d.escalas}` },
              { chave: 'faltas', titulo: 'Faltas', alinhar: 'centro', render: (d) => (d.faltas ? <Etiqueta tom="erro">{d.faltas}</Etiqueta> : '—') },
              { chave: 'externas', titulo: 'Pag. externo', alinhar: 'centro', render: (d) => d.diariasExternas || '—' },
              {
                chave: 'diarias',
                titulo: 'Diárias (UFSM)',
                render: (d) =>
                  d.pessoa.tipo === 'bolsista' ? (
                    <span className="rel-barra">
                      <span style={{ width: `${(d.valorInterno / maiorDiaria) * 100}%` }} />
                      <em>
                        {d.diariasInternas} · {formatarReais(d.valorInterno)}
                      </em>
                    </span>
                  ) : (
                    <span className="texto-3 pequeno">servidor</span>
                  ),
              },
              { chave: 'lote', titulo: 'Já em lote', alinhar: 'direita', render: (d) => (d.valorEmLote ? formatarReais(d.valorEmLote) : '—') },
            ]}
            linhas={r.direitos}
            chaveLinha={(d) => d.pessoa.id}
            vazio="Ninguém escalado neste mês."
          />
        </Cartao>

        <Cartao titulo={`Agenda do mês (${r.eventos.length})`}>
          <Tabela
            colunas={[
              { chave: 'datas', titulo: 'Data', render: (e) => e.datas.map((d) => d.slice(8, 10)).join(', ') },
              { chave: 'nome', titulo: 'Evento', render: (e) => <span className="negrito">{e.evento.nome}</span> },
              { chave: 'tipo', titulo: 'Tipo', render: (e) => e.evento.tipo },
              { chave: 'sessoes', titulo: 'Sessões', alinhar: 'centro', render: (e) => e.sessoes },
              { chave: 'publico', titulo: 'Público', alinhar: 'direita', render: (e) => e.evento.publicoReal ?? e.evento.publicoEstimado ?? '—' },
              { chave: 'pagamento', titulo: 'Pagamento', render: (e) => (e.evento.pagamento === 'externo' ? `Externo (${e.evento.pagadorExterno ?? ''})` : 'Interno') },
            ]}
            linhas={r.eventos}
            chaveLinha={(e) => e.evento.id}
            vazio="Nenhum evento neste mês."
          />
        </Cartao>

        {pode(p, 'pagamentos', 'ver') && (
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
              vazio="Nenhum lote neste mês."
            />
          </Cartao>
        )}

        {pode(p, 'contratos', 'ver') && (
          <Cartao titulo="Contratos dos eventos do mês">
            <Tabela
              colunas={[
                { chave: 'numero', titulo: 'Nº', render: (c) => c.contrato.numero },
                { chave: 'evento', titulo: 'Evento', render: (c) => c.evento },
                { chave: 'contrato', titulo: 'Contrato', render: (c) => c.contrato.statusContrato },
                { chave: 'fatura', titulo: 'Fatura', render: (c) => c.contrato.statusFatura },
                { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (c) => formatarReais(c.valor) },
              ]}
              linhas={r.contratos}
              chaveLinha={(c) => c.contrato.id}
              vazio="Nenhum contrato para os eventos do mês."
            />
          </Cartao>
        )}

        {pode(p, 'eventos', 'editar') && r.fichas.length > 0 && (
          <Cartao titulo="Fichas técnicas">
            <ul className="lista-simples">
              {r.fichas.map((f) => (
                <li key={f.eventoId}>
                  <span>{f.evento}</span>
                  {f.status === 'enviada' ? <Etiqueta tom="sucesso">Enviada</Etiqueta> : <Etiqueta tom="aviso">Não enviada</Etiqueta>}
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        {pode(p, 'almoxEstoque', 'ver') && (
          <Cartao titulo="Saídas do almoxarifado">
            <Tabela
              colunas={[
                { chave: 'cod', titulo: 'Cód.', render: (a) => a.cod },
                { chave: 'nome', titulo: 'Item', render: (a) => a.nome },
                { chave: 'qtd', titulo: 'Qtd.', alinhar: 'centro', render: (a) => a.qtd },
                { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (a) => formatarReais(a.valor) },
              ]}
              linhas={r.almox}
              chaveLinha={(a) => a.cod}
              vazio="Nenhuma saída neste mês."
            />
          </Cartao>
        )}

        {pode(p, 'infraestrutura', 'ver') && (
          <Cartao titulo="Prédio (ocorrências)">
            <p className="pequeno" style={{ margin: 0 }}>
              {r.ocorrencias.criadas.length} aberta(s) no mês · {r.ocorrencias.resolvidas.length} resolvida(s) no mês · {r.ocorrencias.abertas.length} ainda em aberto no total
            </p>
            {r.ocorrencias.criadas.length > 0 && (
              <ul className="lista-simples">
                {r.ocorrencias.criadas.map((o) => (
                  <li key={o.id}>
                    <span>
                      #{o.numero} {o.titulo} <span className="texto-3 pequeno">· {o.local}</span>
                    </span>
                    <Etiqueta tom={o.status === 'resolvida' ? 'sucesso' : 'aviso'}>{o.status}</Etiqueta>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        )}
      </div>
    </Pagina>
  );
}
