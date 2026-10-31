import {
  DIAS_ACHADOS,
  erroDaSaida,
  erroDoAchado,
  formatarData,
  LOCAIS_INFRA,
  pode,
  prazoDoAchado,
  ROTULO_STATUS_ACHADO,
  textoPrazoAchado,
  type Acao,
  type Achado,
  type AchadoDados,
  type StatusAchado,
} from '@shared';
import { Camera, PackageSearch, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { normalizar } from '../../busca/buscaComum';
import { Abas, Alerta, Botao, Campo, Carregando, EstadoVazio, Etiqueta, Modal, Pagina } from '../../componentes';
import { hoje } from '../../util/hoje';
import { reduzirFoto } from '../infra/comum';
import './achados.css';

const INVALIDAR: Acao[] = ['achados.listar', 'historico.listar'];
const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** O que aparece na lista sob a descrição: o prazo de quem está guardado, ou como o item saiu. */
function situacao(a: Achado, prazo: number): string {
  if (a.status === 'devolvido') return `Devolvido em ${formatarData(a.saidaEm!)}${a.retiradoPor ? ` para ${a.retiradoPor}` : ''}`;
  if (a.status === 'descartado') return `Descartado em ${formatarData(a.saidaEm!)}${a.destino ? ` · ${a.destino}` : ''}`;
  return textoPrazoAchado(a.achadoEm, hoje(), prazo);
}

function ItemAchado({ achado: a, prazo, aoAbrir }: { achado: Achado; prazo: number; aoAbrir: () => void }) {
  const vencido = a.status === 'guardado' && prazoDoAchado(a.achadoEm, hoje(), prazo).vencido;
  return (
    <li>
      <button type="button" className="achados-item" data-vencido={vencido} onClick={aoAbrir}>
        <span className="achados-icone" aria-hidden>
          {a.temFoto ? <Camera size={18} /> : <PackageSearch size={18} />}
        </span>
        <span className="achados-texto">
          <strong>
            #{a.numero} {a.descricao}
          </strong>{' '}
          <span className="pequeno texto-2">
            Achado em {formatarData(a.achadoEm)}
            {a.local ? ` · ${a.local}` : ''}
          </span>{' '}
          <span className="pequeno achados-prazo">{situacao(a, prazo)}</span>
        </span>
      </button>
    </li>
  );
}

/** Registrar (sem `achado`) ou editar. A foto é reduzida no aparelho e vai para o Drive do setor. */
function ModalAchado({ achado, aoFechar }: { achado?: Achado; aoFechar: () => void }) {
  const salvar = useMutacao('achados.salvar', [...INVALIDAR, 'achados.foto']);
  const [d, setD] = useState<AchadoDados>(() =>
    achado
      ? { descricao: achado.descricao, achadoEm: achado.achadoEm, local: achado.local, eventoId: achado.eventoId, guardadoEm: achado.guardadoEm, observacoes: achado.observacoes }
      : { descricao: '', achadoEm: hoje(), local: '', eventoId: null, guardadoEm: '', observacoes: '' },
  );
  // undefined = fica a foto que está; null = tirar a foto
  const [foto, setFoto] = useState<string | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const dia = d.achadoEm || hoje();
  const periodo = usePeriodo(dia, dia);
  const eventosDoDia = periodo.eventos.filter(
    (e) => e.status !== 'cancelado' && periodo.sessoes.some((s) => s.eventoId === e.id && s.data === dia && s.status === 'ativa'),
  );
  const campo = (k: 'descricao' | 'achadoEm' | 'local' | 'guardadoEm' | 'observacoes') => ({
    value: d[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value }),
  });
  const temFoto = foto !== undefined ? !!foto : !!achado?.temFoto;

  async function enviar() {
    const problema = erroDoAchado({ ...d, descricao: d.descricao.trim() }, hoje());
    if (problema) return setErro(problema);
    try {
      await salvar.mutateAsync({ ...(achado ? { id: achado.id } : {}), dados: d, ...(foto !== undefined ? { foto } : {}) });
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Modal
      aberto
      titulo={achado ? `Editar achado #${achado.numero}` : 'Registrar achado'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={salvar.isPending} onClick={enviar}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <Campo rotulo="Descrição">{(id) => <input id={id} className="cc-entrada" maxLength={200} placeholder="ex.: guarda-chuva preto" {...campo('descricao')} />}</Campo>
        <div className="grade-2">
          <Campo rotulo="Data em que foi achado">{(id) => <input id={id} className="cc-entrada" type="date" max={hoje()} {...campo('achadoEm')} />}</Campo>
          <Campo rotulo="Local">
            {(id) => (
              <select id={id} className="cc-entrada" {...campo('local')}>
                <option value="">Não informado</option>
                {LOCAIS_INFRA.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            )}
          </Campo>
        </div>
        {eventosDoDia.length > 0 && (
          <Campo rotulo="Evento do dia">
            {(id) => (
              <select id={id} className="cc-entrada" value={d.eventoId ?? ''} onChange={(e) => setD({ ...d, eventoId: e.target.value || null })}>
                <option value="">Nenhum</option>
                {eventosDoDia.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        )}
        <Campo rotulo="Onde está guardado">{(id) => <input id={id} className="cc-entrada" maxLength={120} placeholder="ex.: armário da secretaria" {...campo('guardadoEm')} />}</Campo>
        <Campo rotulo="Observações">{(id) => <textarea id={id} className="cc-entrada" maxLength={500} rows={2} {...campo('observacoes')} />}</Campo>
        <div className="linha">
          <label className="cc-botao" data-variante="secundario">
            <Camera size={16} aria-hidden /> {temFoto ? 'Trocar foto' : 'Tirar ou escolher foto'}
            <input
              type="file"
              accept="image/*"
              className="visualmente-oculto"
              onChange={async (e) => {
                const arq = e.target.files?.[0];
                if (!arq) return;
                try {
                  setFoto(await reduzirFoto(arq));
                } catch (err) {
                  setErro((err as Error).message);
                }
              }}
            />
          </label>
          {foto && <img src={foto} alt="Foto do item" className="achados-miniatura" />}
          {temFoto && (
            <Botao variante="fantasma" tamanho="pequeno" onClick={() => setFoto(null)}>
              Tirar a foto
            </Botao>
          )}
        </div>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

/** Ficha do item: foto, onde e quando foi achado, prazo e as saídas (devolver, descartar, voltar para os guardados). */
function DetalheAchado({ achado: a, prazo, edita, aoFechar }: { achado: Achado; prazo: number; edita: boolean; aoFechar: () => void }) {
  const pessoas = usePessoas();
  const periodo = usePeriodo(a.achadoEm, a.achadoEm);
  const foto = useConsulta('achados.foto', { id: a.id }, { habilitada: a.temFoto });
  const mudar = useMutacao('achados.situacao', INVALIDAR);
  const [acao, setAcao] = useState<'devolver' | 'descartar' | null>(null);
  const [editando, setEditando] = useState(false);
  const [data, setData] = useState(hoje());
  const [retiradoPor, setRetiradoPor] = useState('');
  const [contato, setContato] = useState('');
  const [destino, setDestino] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  if (editando) return <ModalAchado achado={a} aoFechar={() => setEditando(false)} />;

  const p = prazoDoAchado(a.achadoEm, hoje(), prazo);
  const evento = a.eventoId ? periodo.eventos.find((e) => e.id === a.eventoId) : undefined;
  const escolher = (x: typeof acao) => {
    setAcao(x);
    setErro(null);
  };

  async function confirmar(status: StatusAchado) {
    const saida = { status, data, retiradoPor, contatoRetirada: contato, destino };
    const problema = erroDaSaida(saida, a, hoje());
    if (problema) return setErro(problema);
    try {
      await mudar.mutateAsync({ id: a.id, ...saida });
      escolher(null);
      if (status !== 'guardado') aoFechar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const rodape = !edita ? undefined : acao ? (
    <>
      <Botao onClick={() => escolher(null)}>Cancelar</Botao>
      <Botao variante="primario" carregando={mudar.isPending} onClick={() => confirmar(acao === 'devolver' ? 'devolvido' : 'descartado')}>
        {acao === 'devolver' ? 'Confirmar devolução' : 'Confirmar descarte'}
      </Botao>
    </>
  ) : a.status === 'guardado' ? (
    <>
      <Botao onClick={() => setEditando(true)}>Editar</Botao>
      <Botao onClick={() => escolher('descartar')}>Descartar</Botao>
      <Botao variante="primario" onClick={() => escolher('devolver')}>
        Devolver ao dono
      </Botao>
    </>
  ) : (
    <Botao carregando={mudar.isPending} onClick={() => confirmar('guardado')}>
      Voltar para os guardados
    </Botao>
  );

  return (
    <Modal aberto titulo={`#${a.numero} ${a.descricao}`} aoFechar={aoFechar} rodape={rodape}>
      <div className="pilha">
        {a.temFoto ? (
          foto.data ? (
            <img className="achados-foto" src={foto.data} alt={`Foto: ${a.descricao}`} />
          ) : (
            <p className="pequeno texto-2">{foto.isLoading ? 'Carregando a foto…' : 'Não foi possível abrir a foto.'}</p>
          )
        ) : (
          <p className="pequeno texto-2">Sem foto.</p>
        )}
        <dl className="achados-dados">
          <dt>Situação</dt>
          <dd>
            {a.status === 'guardado' ? (p.dias ? `Guardado há ${dias(p.dias)}` : 'Guardado desde hoje') : ROTULO_STATUS_ACHADO[a.status]}{' '}
            {a.status === 'guardado' && p.vencido && <Etiqueta tom="erro">prazo vencido</Etiqueta>}
          </dd>
          <dt>Achado em</dt>
          <dd>
            {formatarData(a.achadoEm)}
            {a.local ? ` · ${a.local}` : ''}
          </dd>
          {evento && (
            <>
              <dt>Evento</dt>
              <dd>{evento.nome}</dd>
            </>
          )}
          {a.guardadoEm && (
            <>
              <dt>Onde está</dt>
              <dd>{a.guardadoEm}</dd>
            </>
          )}
          {a.status === 'guardado' && (
            <>
              <dt>Prazo</dt>
              <dd>{p.vencido ? `Venceu em ${formatarData(p.descartarEm)}` : `Pode descartar a partir de ${formatarData(p.descartarEm)} (faltam ${dias(p.faltam)})`}</dd>
            </>
          )}
          {a.status !== 'guardado' && (
            <>
              <dt>{ROTULO_STATUS_ACHADO[a.status]}</dt>
              <dd>
                {situacao(a, prazo)}
                {a.contatoRetirada ? ` · ${a.contatoRetirada}` : ''}
              </dd>
            </>
          )}
          {a.observacoes && (
            <>
              <dt>Observações</dt>
              <dd>{a.observacoes}</dd>
            </>
          )}
          <dt>Registrado por</dt>
          <dd>{pessoas.pessoa.get(a.registradoPorId)?.nome ?? '—'}</dd>
          {a.dadosApagadosEm && (
            <>
              <dt>LGPD</dt>
              <dd>Foto e quem retirou apagados em {formatarData(a.dadosApagadosEm)}.</dd>
            </>
          )}
        </dl>
        {acao && (
          <div className="pilha achados-saida">
            <Campo rotulo={acao === 'devolver' ? 'Data da devolução' : 'Data do descarte'}>
              {(id) => <input id={id} className="cc-entrada" type="date" min={a.achadoEm} max={hoje()} value={data} onChange={(e) => setData(e.target.value)} />}
            </Campo>
            {acao === 'devolver' ? (
              <>
                <Campo rotulo="Quem retirou">{(id) => <input id={id} className="cc-entrada" maxLength={120} value={retiradoPor} onChange={(e) => setRetiradoPor(e.target.value)} />}</Campo>
                <Campo rotulo="Documento ou telefone" ajuda="Fica na planilha Sigiloso e é apagado depois do prazo da LGPD.">
                  {(id) => <input id={id} className="cc-entrada" maxLength={120} value={contato} onChange={(e) => setContato(e.target.value)} />}
                </Campo>
              </>
            ) : (
              <>
                <Campo rotulo="Destino">
                  {(id) => <input id={id} className="cc-entrada" maxLength={120} placeholder="ex.: lixo, doação" value={destino} onChange={(e) => setDestino(e.target.value)} />}
                </Campo>
                {!p.vencido && (
                  <Alerta tom="aviso">
                    O prazo de {prazo} dias ainda não venceu: faltam {dias(p.faltam)}.
                  </Alerta>
                )}
              </>
            )}
          </div>
        )}
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

/** Itens achados no prédio: guardados por um prazo (Configurações, padrão 90 dias) e depois devolvidos ou descartados. */
export function Achados() {
  const eu = useEu();
  const edita = pode(eu.permissoes, 'achados', 'editar');
  const q = useConsulta('achados.listar', null);
  const config = useConsulta('config.obter', null);
  const [params, setParams] = useSearchParams();
  const [aba, setAba] = useState<StatusAchado>('guardado');
  const [busca, setBusca] = useState('');
  const [registrando, setRegistrando] = useState(false);

  if (q.isLoading) return <Carregando />;
  const prazo = config.data?.diasAchados ?? DIAS_ACHADOS;
  const lista = q.data ?? [];
  const selecionado = lista.find((a) => a.id === params.get('item'));
  const abrir = (id: string | null) => setParams(id ? { item: id } : {}, { replace: true });
  const quantos = (s: StatusAchado) => lista.filter((a) => a.status === s).length;
  const termo = normalizar(busca);
  // guardados: o mais antigo primeiro (é o que vence antes); os que saíram: o mais recente primeiro
  const daAba = lista
    .filter((a) => a.status === aba && (!termo || normalizar(`#${a.numero} ${a.descricao} ${a.local} ${a.guardadoEm}`).includes(termo)))
    .sort((a, b) =>
      aba === 'guardado' ? a.achadoEm.localeCompare(b.achadoEm) || a.numero - b.numero : (b.saidaEm ?? '').localeCompare(a.saidaEm ?? '') || b.numero - a.numero,
    );
  const vencidos = lista.filter((a) => a.status === 'guardado' && prazoDoAchado(a.achadoEm, hoje(), prazo).vencido).length;

  return (
    <Pagina
      titulo="Achados e perdidos"
      subtitulo={`Itens guardados no setor. Depois de ${prazo} dias, podem ser descartados.`}
      acoes={
        edita && (
          <Botao variante="primario" onClick={() => setRegistrando(true)}>
            <Plus size={16} aria-hidden /> Registrar achado
          </Botao>
        )
      }
    >
      {vencidos > 0 && (
        <Alerta tom="aviso">{vencidos === 1 ? '1 item com o prazo vencido: já pode ser descartado.' : `${vencidos} itens com o prazo vencido: já podem ser descartados.`}</Alerta>
      )}
      <Abas
        abas={[
          { id: 'guardado', rotulo: `Guardados (${quantos('guardado')})` },
          { id: 'devolvido', rotulo: `Devolvidos (${quantos('devolvido')})` },
          { id: 'descartado', rotulo: `Descartados (${quantos('descartado')})` },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      <input
        className="cc-entrada achados-busca"
        type="search"
        placeholder="Buscar por descrição, local ou número"
        aria-label="Buscar nos achados"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {daAba.length ? (
        <ul className="achados-lista">
          {daAba.map((a) => (
            <ItemAchado key={a.id} achado={a} prazo={prazo} aoAbrir={() => abrir(a.id)} />
          ))}
        </ul>
      ) : (
        <EstadoVazio
          titulo={termo ? 'Nada encontrado' : aba === 'guardado' ? 'Nenhum item guardado' : 'Nada por aqui'}
          texto={!termo && aba === 'guardado' && edita ? 'Use Registrar achado quando alguém entregar um item esquecido no prédio.' : undefined}
        />
      )}
      {registrando && (
        <ModalAchado
          aoFechar={() => {
            setRegistrando(false);
            setAba('guardado');
          }}
        />
      )}
      {selecionado && <DetalheAchado key={selecionado.id} achado={selecionado} prazo={prazo} edita={edita} aoFechar={() => abrir(null)} />}
    </Pagina>
  );
}
