import {
  CATEGORIAS_INFRA,
  diasEmAberto,
  formatarDataHora,
  formatarReais,
  LOCAIS_INFRA,
  pode,
  proximosStatus,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_OCORRENCIA,
  validarRetirada,
  validarTransicao,
  type PrioridadeOcorrencia,
  type StatusOcorrencia,
} from '@shared';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePessoas } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Modal, Pagina } from '../../componentes';
import { hoje } from '../../util/hoje';
import { EtiquetaPrioridade, EtiquetaStatus, INVALIDAR_INFRA } from './comum';

function MaterialUsado({ ocorrenciaId, numero }: { ocorrenciaId: string; numero: number }) {
  const almox = useConsulta('almox.listar', null);
  const usados = useConsulta('almox.movimentos', { ocorrenciaId });
  const retirar = useMutacao('almox.retirar', ['almox.listar', 'almox.movimentos', 'historico.listar']);
  const eu = useEu();
  const [cod, setCod] = useState('');
  const [qtd, setQtd] = useState('1');
  const [erro, setErro] = useState<string | null>(null);
  if (almox.isLoading || usados.isLoading) return <Carregando />;
  const itens = (almox.data?.itens ?? []).filter((i) => i.status === 'Ativo').sort((a, b) => (a.nomeComum || a.nomeAlmox).localeCompare(b.nomeComum || b.nomeAlmox, 'pt-BR'));
  const nome = (c: string) => almox.data?.itens.find((i) => i.cod === c)?.nomeComum ?? c;

  return (
    <div className="pilha">
      {(usados.data ?? []).length === 0 ? (
        <p className="pequeno texto-3">Nenhum material do almoxarifado registrado.</p>
      ) : (
        <ul className="lista-simples">
          {usados.data!.map((m) => (
            <li key={m.id}>
              <span>
                {-m.qtd}× {nome(m.cod)}
              </span>
              <span className="pequeno texto-2">
                {formatarDataHora(m.quando)} · {formatarReais(-m.qtd * m.valorUnitario)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {pode(eu.permissoes, 'almoxSaidas', 'editar') && (
        <div className="linha" style={{ alignItems: 'flex-end' }}>
          <Campo rotulo="Item do almoxarifado">
            {(id) => (
              <select id={id} className="cc-entrada" value={cod} onChange={(e) => setCod(e.target.value)}>
                <option value="">Escolha…</option>
                {itens.map((i) => (
                  <option key={i.cod} value={i.cod}>
                    [{i.cod}] {i.nomeComum || i.nomeAlmox} (saldo {i.saldo})
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Qtd.">{(id) => <input id={id} className="cc-entrada" type="number" min={1} style={{ width: 80 }} value={qtd} onChange={(e) => setQtd(e.target.value)} />}</Campo>
          <Botao
            carregando={retirar.isPending}
            onClick={async () => {
              setErro(null);
              const linha = [{ cod, qtd: Number(qtd) }];
              const problemas = cod ? validarRetirada(linha, almox.data!.itens) : [{ cod, erro: 'Escolha um item.' }];
              if (problemas.length) return setErro(problemas[0].erro);
              try {
                await retirar.mutateAsync({ itens: linha, retiradoPorPessoaId: eu.id, finalidade: `Ocorrência #${numero}`, ocorrenciaId });
                setCod('');
                setQtd('1');
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Registrar uso
          </Botao>
        </div>
      )}
      {erro && <Alerta tom="erro">{erro}</Alerta>}
    </div>
  );
}

export function OcorrenciaDetalhe() {
  const { id = '' } = useParams();
  const eu = useEu();
  const q = useConsulta('infra.listar', null);
  const pessoas = usePessoas();
  const atualizar = useMutacao('infra.atualizar', [...INVALIDAR_INFRA]);
  const [mudando, setMudando] = useState<StatusOcorrencia | null>(null);
  const [observacao, setObservacao] = useState('');
  const [chamadoNumero, setChamadoNumero] = useState('');
  const [chamadoLink, setChamadoLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  // com a API real a foto não vem na lista: é buscada à parte, só quando existe
  const atual = (q.data ?? []).find((x) => x.id === id);
  const foto = useConsulta('infra.foto', { id }, { habilitada: !!atual?.temFoto && !atual?.foto });
  if (q.isLoading) return <Carregando />;
  const o = (q.data ?? []).find((x) => x.id === id);
  if (!o) return <EstadoVazio titulo="Ocorrência não encontrada" acao={<Link to="/infra">Voltar</Link>} />;
  const editar = pode(eu.permissoes, 'infraestrutura', 'editar');

  function abrir(para: StatusOcorrencia) {
    setErro(null);
    setObservacao('');
    setChamadoNumero(o!.chamadoNumero);
    setChamadoLink(o!.chamadoLink);
    setMudando(para);
  }

  async function confirmar() {
    if (!mudando) return;
    const problema = validarTransicao({ ...o!, chamadoNumero }, mudando, { chamadoNumero, observacao });
    if (problema) return setErro(problema);
    try {
      await atualizar.mutateAsync({ id: o!.id, para: mudando, observacao, chamadoNumero, chamadoLink });
      setMudando(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Pagina
      titulo={`#${o.numero} · ${o.titulo}`}
      subtitulo={
        <span className="linha">
          <span data-testid="status-ocorrencia">
            <EtiquetaStatus status={o.status} />
          </span>
          <EtiquetaPrioridade prioridade={o.prioridade} />
          <span>
            {o.local} · {o.categoria} · {diasEmAberto(o, hoje())} dia(s)
          </span>
        </span>
      }
      acoes={
        editar &&
        proximosStatus(o.status).map((s) => (
          <Botao key={s} variante={s === 'naoProcede' ? 'fantasma' : 'secundario'} onClick={() => abrir(s)}>
            {ROTULO_STATUS_OCORRENCIA[s]}
          </Botao>
        ))
      }
    >
      <div className="grade-2">
        <Cartao titulo="Relato">
          <div className="pilha-2">
            <p style={{ whiteSpace: 'pre-line' }}>{o.descricao || <span className="texto-3">Sem detalhes.</span>}</p>
            <p className="pequeno texto-2">
              Por {o.relatorNome}
              {o.relatorContato ? ` (${o.relatorContato})` : ''} · via {o.origem === 'formulario' ? 'formulário' : 'GestorCC'} · {formatarDataHora(o.criadaEm)}
            </p>
            {(o.foto ?? foto.data) && <img src={(o.foto ?? foto.data)!} alt="Foto enviada no relato" style={{ maxWidth: '100%', borderRadius: 8 }} />}
            {editar && (
              <div className="grade-2">
                <Campo rotulo="Prioridade">
                  {(idc) => (
                    <select id={idc} className="cc-entrada" value={o.prioridade} onChange={(e) => atualizar.mutate({ id: o.id, prioridade: e.target.value as PrioridadeOcorrencia, observacao: '' })}>
                      {Object.entries(ROTULO_PRIORIDADE).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo rotulo="Tipo">
                  {(idc) => (
                    <select id={idc} className="cc-entrada" value={o.categoria} onChange={(e) => atualizar.mutate({ id: o.id, categoria: e.target.value, observacao: '' })}>
                      {CATEGORIAS_INFRA.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo rotulo="Local">
                  {(idc) => (
                    <select id={idc} className="cc-entrada" value={o.local} onChange={(e) => atualizar.mutate({ id: o.id, local: e.target.value, observacao: '' })}>
                      {LOCAIS_INFRA.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </Campo>
              </div>
            )}
          </div>
        </Cartao>
        <Cartao titulo="Chamado na UFSM">
          {o.chamadoNumero ? (
            <div className="pilha-2">
              <p className="cc-numero" style={{ fontSize: '1.3rem' }}>
                {o.chamadoNumero}
              </p>
              <p className="pequeno texto-2">Aberto em {o.chamadoAbertoEm ? formatarDataHora(o.chamadoAbertoEm) : '—'}</p>
              {o.chamadoLink && (
                <a className="cc-botao" data-variante="secundario" data-tamanho="pequeno" href={o.chamadoLink} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
                  <ExternalLink size={14} aria-hidden /> Abrir no sistema da UFSM
                </a>
              )}
            </div>
          ) : (
            <p className="pequeno texto-3">
              Ainda sem chamado. Quando precisar da manutenção da UFSM, abra o chamado no sistema da universidade e use "Chamado aberto" para registrar o número aqui.
            </p>
          )}
        </Cartao>
      </div>

      <div className="grade-2">
        <Cartao titulo="Histórico">
          <ul className="lista-simples">
            <li>
              <span>Relatada</span>
              <span className="pequeno texto-2">{formatarDataHora(o.criadaEm)}</span>
            </li>
            {o.historico.map((h, i) => (
              <li key={i}>
                <span className="pilha-2" style={{ gap: 2 }}>
                  <span>
                    {h.de ? `${ROTULO_STATUS_OCORRENCIA[h.de]} → ` : ''}
                    <strong>{ROTULO_STATUS_OCORRENCIA[h.para]}</strong>
                  </span>
                  {h.observacao && <span className="pequeno texto-2">{h.observacao}</span>}
                </span>
                <span className="pequeno texto-2">
                  {formatarDataHora(h.quando)} · {pessoas.pessoa.get(h.quemId)?.nome.split(' ')[0] ?? ''}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
        {pode(eu.permissoes, 'almoxEstoque', 'ver') || pode(eu.permissoes, 'almoxSaidas', 'ver') ? (
          <Cartao titulo="Material do almoxarifado usado">
            <MaterialUsado ocorrenciaId={o.id} numero={o.numero} />
          </Cartao>
        ) : null}
      </div>

      <Modal
        aberto={!!mudando}
        titulo={mudando ? `Mudar para: ${ROTULO_STATUS_OCORRENCIA[mudando]}` : ''}
        aoFechar={() => setMudando(null)}
        rodape={
          <>
            <Botao onClick={() => setMudando(null)}>Cancelar</Botao>
            <Botao variante="primario" carregando={atualizar.isPending} onClick={confirmar}>
              Confirmar
            </Botao>
          </>
        }
      >
        <div className="pilha">
          {mudando === 'chamado' && (
            <>
              <Campo rotulo="Nº do chamado na UFSM">{(idc) => <input id={idc} className="cc-entrada" value={chamadoNumero} onChange={(e) => setChamadoNumero(e.target.value)} />}</Campo>
              <Campo rotulo="Link do chamado (opcional)">{(idc) => <input id={idc} className="cc-entrada" value={chamadoLink} onChange={(e) => setChamadoLink(e.target.value)} />}</Campo>
            </>
          )}
          <Campo rotulo={mudando === 'naoProcede' ? 'Por que não procede? (obrigatório)' : 'Observação (opcional)'}>
            {(idc) => <textarea id={idc} className="cc-entrada" value={observacao} onChange={(e) => setObservacao(e.target.value)} />}
          </Campo>
          {o.relatorPessoaId && <p className="pequeno texto-2">Quem relatou será avisado da nova situação.</p>}
          {erro && <Alerta tom="erro">{erro}</Alerta>}
        </div>
      </Modal>
    </Pagina>
  );
}
