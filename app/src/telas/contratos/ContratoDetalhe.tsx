import {
  AREAS_CEDIDAS,
  formatarData,
  formatarReais,
  OPCOES_STATUS,
  pode,
  valorTotalContrato,
  type Aditivo,
  type Contratante,
  type Contrato,
} from '@shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Modal, Pagina, Tabela } from '../../componentes';
import { consultarCep, consultarCnpj } from '../../util/brasilapi';
import { hoje } from '../../util/hoje';
import { AVISO_VERSAO_INICIAL } from './Contratos';
import { INVALIDAR_CONTRATOS, useDadosContratos } from './dadosContratos';
import { DocumentosContrato } from './DocumentosContrato';

function contratoVazio(numero: string): Contrato {
  return {
    id: '', numero, eventoId: '', contratanteId: '', processoPen: '', valorBase: 0, itemTabela: 'B.7', vencimento: hoje(),
    areas: [...AREAS_CEDIDAS], cortesiasQtd: 20, ingressoSolidario: 'Não possui', statusContrato: 'Não enviado',
    statusFatura: 'Não enviada p/ emissão', numeroFatura: '', statusEcad: 'Não enviado', statusIss: 'Não enviado',
    statusFundep: 'Não enviado', statusCortesias: 'Não recebidas', fichaTecnicaRecebida: false, canceladoMotivo: '', observacoes: '',
  };
}

function ModalContratante({ aoFechar, aoSalvo }: { aoFechar: () => void; aoSalvo: (k: Contratante) => void }) {
  const salvar = useMutacao('contratantes.salvar', [...INVALIDAR_CONTRATOS]);
  const [k, setK] = useState<Contratante>({
    id: '', razaoSocial: '', documento: '', inscricaoMunicipal: 'Isento', inscricaoEstadual: 'Isento', endereco: '', cep: '',
    representanteNome: '', email: '', contatoFaturaNome: '', contatoFaturaEmail: '', contatoFaturaTelefone: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [receita, setReceita] = useState<{ tom: 'info' | 'aviso'; texto: string } | null>(null);
  // CNPJ e CEP preenchem só os campos ainda vazios (BrasilAPI); CPF não é consultado
  async function aoSairDoDocumento() {
    const d = await consultarCnpj(k.documento);
    if (!d) return;
    setK((atual) => ({ ...atual, razaoSocial: atual.razaoSocial || d.razaoSocial, endereco: atual.endereco || d.endereco, cep: atual.cep || d.cep, email: atual.email || d.email }));
    setReceita(
      d.situacao && d.situacao !== 'ATIVA'
        ? { tom: 'aviso', texto: `Atenção: na Receita, este CNPJ está com situação ${d.situacao}.` }
        : { tom: 'info', texto: 'Dados da Receita preenchidos nos campos vazios. Confira antes de salvar.' },
    );
  }
  async function aoSairDoCep() {
    if (k.endereco) return;
    const d = await consultarCep(k.cep);
    if (d) setK((atual) => ({ ...atual, endereco: atual.endereco || d.endereco, cep: d.cep }));
  }
  const campos: [keyof Contratante, string][] = [
    ['razaoSocial', 'Razão social / nome'], ['documento', 'CNPJ ou CPF'], ['inscricaoMunicipal', 'Inscrição municipal'],
    ['inscricaoEstadual', 'Inscrição estadual'], ['endereco', 'Endereço completo'], ['cep', 'CEP'], ['representanteNome', 'Representante'],
    ['email', 'E-mail'], ['contatoFaturaNome', 'Contato para a fatura'], ['contatoFaturaEmail', 'E-mail da fatura'], ['contatoFaturaTelefone', 'Telefone da fatura'],
  ];
  return (
    <Modal
      aberto
      titulo="Novo contratante"
      largura="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            carregando={salvar.isPending}
            onClick={async () => {
              setErro(null);
              try {
                aoSalvo(await salvar.mutateAsync(k));
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Salvar contratante
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <p className="pequeno texto-2">Fica na planilha sigilosa. Reaproveitado nos próximos contratos da mesma produtora.</p>
        <div className="grade-2">
          {campos.map(([chave, rotulo]) => (
            <Campo key={chave} rotulo={rotulo}>
              {(id) => (
                <input
                  id={id}
                  className="cc-entrada"
                  value={k[chave]}
                  onChange={(e) => setK({ ...k, [chave]: e.target.value })}
                  onBlur={chave === 'documento' ? aoSairDoDocumento : chave === 'cep' ? aoSairDoCep : undefined}
                />
              )}
            </Campo>
          ))}
        </div>
        {receita && <Alerta tom={receita.tom}>{receita.texto}</Alerta>}
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

export function ContratoDetalhe() {
  const { id = '' } = useParams();
  const eu = useEu();
  const navegar = useNavigate();
  const dados = useDadosContratos();
  const salvar = useMutacao('contratos.salvar', [...INVALIDAR_CONTRATOS]);
  const salvarAditivo = useMutacao('contratos.salvarAditivo', [...INVALIDAR_CONTRATOS]);
  const [c, setC] = useState<Contrato | null>(null);
  const [msg, setMsg] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [novoContratante, setNovoContratante] = useState(false);
  const [aditivo, setAditivo] = useState<Aditivo | null>(null);
  const novo = id === 'novo';

  useEffect(() => {
    if (dados.carregando || c) return;
    const ano = hoje().slice(0, 4);
    const proximo = Math.max(0, ...dados.contratos.filter((x) => x.numero.endsWith(ano)).map((x) => parseInt(x.numero, 10) || 0)) + 1;
    setC(novo ? contratoVazio(`${proximo}/${ano}`) : dados.contratos.find((x) => x.id === id) ?? null);
  }, [dados.carregando, dados.contratos, id, novo, c]);

  if (dados.carregando) return <Carregando />;
  if (!c) return <EstadoVazio titulo="Contrato não encontrado" acao={<Link to="/contratos">Voltar</Link>} />;
  const editar = pode(eu.permissoes, 'contratos', 'editar');
  const aditivos = dados.aditivos.filter((a) => a.contratoId === c.id);
  const set = (parcial: Partial<Contrato>) => setC({ ...c, ...parcial });
  const select = (rotulo: string, chave: keyof Contrato, opcoes: string[]) => (
    <Campo rotulo={rotulo}>
      {(idc) => (
        <select id={idc} className="cc-entrada" disabled={!editar} value={c[chave] as string} onChange={(e) => set({ [chave]: e.target.value } as Partial<Contrato>)}>
          {opcoes.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
    </Campo>
  );

  async function gravar() {
    setMsg(null);
    if (!c!.eventoId || !c!.contratanteId) return setMsg({ tom: 'erro', texto: 'Escolha o evento e o contratante.' });
    try {
      const salvo = await salvar.mutateAsync(c!);
      setC(salvo);
      setMsg({ tom: 'sucesso', texto: 'Contrato salvo.' });
      if (novo) navegar(`/contratos/${salvo.id}`, { replace: true });
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message });
    }
  }

  return (
    <Pagina
      titulo={novo ? 'Novo contrato' : `Contrato ${c.numero}`}
      subtitulo={dados.periodo.evento.get(c.eventoId)?.nome}
      acoes={
        editar && (
          <Botao variante="primario" carregando={salvar.isPending} onClick={gravar}>
            Salvar
          </Botao>
        )
      }
    >
      <Alerta tom="info">{AVISO_VERSAO_INICIAL}</Alerta>
      {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}

      <Cartao titulo="Dados do contrato">
        <div className="grade-2">
          <Campo rotulo="Número">{(i) => <input id={i} className="cc-entrada" disabled={!editar} value={c.numero} onChange={(e) => set({ numero: e.target.value })} />}</Campo>
          <Campo rotulo="Processo PEN-SIE">{(i) => <input id={i} className="cc-entrada" disabled={!editar} value={c.processoPen} onChange={(e) => set({ processoPen: e.target.value })} />}</Campo>
          <Campo rotulo="Evento">
            {(i) => (
              <select id={i} className="cc-entrada" disabled={!editar} value={c.eventoId} onChange={(e) => set({ eventoId: e.target.value })}>
                <option value="">Escolha…</option>
                {dados.periodo.eventos
                  .filter((e) => e.instrumento === 'contrato' || e.id === c.eventoId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Contratante" ajuda={editar && <button type="button" className="login-esqueci pequeno" onClick={() => setNovoContratante(true)}>Cadastrar novo contratante</button>}>
            {(i) => (
              <select id={i} className="cc-entrada" disabled={!editar} value={c.contratanteId} onChange={(e) => set({ contratanteId: e.target.value })}>
                <option value="">Escolha…</option>
                {dados.contratantes.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.razaoSocial}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Valor base (R$)">
            {(i) => <input id={i} className="cc-entrada" type="number" step="0.01" disabled={!editar} value={c.valorBase / 100} onChange={(e) => set({ valorBase: Math.round(Number(e.target.value) * 100) })} />}
          </Campo>
          <Campo rotulo="Item da tabela de preços">{(i) => <input id={i} className="cc-entrada" disabled={!editar} value={c.itemTabela} onChange={(e) => set({ itemTabela: e.target.value })} />}</Campo>
          <Campo rotulo="Vencimento da fatura">{(i) => <input id={i} className="cc-entrada" type="date" disabled={!editar} value={c.vencimento} onChange={(e) => set({ vencimento: e.target.value })} />}</Campo>
          <Campo rotulo="Nº da fatura (FUNDEP)">{(i) => <input id={i} className="cc-entrada" disabled={!editar} value={c.numeroFatura} onChange={(e) => set({ numeroFatura: e.target.value })} />}</Campo>
          <Campo rotulo="Cortesias (quantidade)">{(i) => <input id={i} className="cc-entrada" type="number" disabled={!editar} value={c.cortesiasQtd} onChange={(e) => set({ cortesiasQtd: Number(e.target.value) })} />}</Campo>
          {select('Ingresso solidário', 'ingressoSolidario', ['Possui', 'Não possui', 'CACC', 'Mesa Brasil'])}
        </div>
        <div className="pilha-2" style={{ marginTop: 16 }}>
          <strong className="pequeno">Áreas cedidas</strong>
          <div className="linha">
            {AREAS_CEDIDAS.map((a) => (
              <label key={a} className="cc-caixa">
                <input
                  type="checkbox"
                  disabled={!editar}
                  checked={c.areas.includes(a)}
                  onChange={(e) => set({ areas: e.target.checked ? [...c.areas, a] : c.areas.filter((x) => x !== a) })}
                />
                {a}
              </label>
            ))}
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Situações">
        <div className="grade-2">
          {select('Contrato', 'statusContrato', OPCOES_STATUS.contrato)}
          {select('Fatura', 'statusFatura', OPCOES_STATUS.fatura)}
          {select('ECAD', 'statusEcad', OPCOES_STATUS.ecad)}
          {select('ISS', 'statusIss', OPCOES_STATUS.iss)}
          {select('FUNDEP', 'statusFundep', OPCOES_STATUS.fundep)}
          {select('Cortesias', 'statusCortesias', OPCOES_STATUS.cortesias)}
          <label className="cc-caixa">
            <input type="checkbox" disabled={!editar} checked={c.fichaTecnicaRecebida} onChange={(e) => set({ fichaTecnicaRecebida: e.target.checked })} />
            Ficha técnica recebida
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <Campo rotulo="Observações">{(i) => <textarea id={i} className="cc-entrada" disabled={!editar} value={c.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />}</Campo>
        </div>
        {c.statusContrato === 'Cancelado' && (
          <div style={{ marginTop: 16 }}>
            <Campo rotulo="Motivo do cancelamento">{(i) => <input id={i} className="cc-entrada" disabled={!editar} value={c.canceladoMotivo} onChange={(e) => set({ canceladoMotivo: e.target.value })} />}</Campo>
          </div>
        )}
      </Cartao>

      {!novo && (
        <Cartao
          titulo={`Aditivos · total ${formatarReais(valorTotalContrato(c, dados.aditivos))}`}
          acoes={
            editar && (
              <Botao
                tamanho="pequeno"
                onClick={() => setAditivo({ id: '', contratoId: c.id, numero: aditivos.length + 1, data: hoje(), descricao: '', valorDelta: 0, novaData: null, statusFatura: 'Não enviada p/ emissão' })}
              >
                Registrar aditivo
              </Botao>
            )
          }
        >
          <Tabela
            colunas={[
              { chave: 'numero', titulo: 'Nº' },
              { chave: 'data', titulo: 'Data', render: (a) => formatarData(a.data) },
              { chave: 'descricao', titulo: 'Descrição' },
              { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (a) => formatarReais(a.valorDelta) },
              { chave: 'fatura', titulo: 'Fatura', render: (a) => a.statusFatura },
            ]}
            linhas={aditivos}
            chaveLinha={(a) => a.id}
            vazio="Sem aditivos."
          />
        </Cartao>
      )}

      {!novo && <DocumentosContrato contrato={c} editar={editar} />}

      {novoContratante && (
        <ModalContratante
          aoFechar={() => setNovoContratante(false)}
          aoSalvo={(k) => {
            set({ contratanteId: k.id });
            setNovoContratante(false);
          }}
        />
      )}
      {aditivo && (
        <Modal
          aberto
          titulo={`Aditivo nº ${aditivo.numero}`}
          aoFechar={() => setAditivo(null)}
          rodape={
            <>
              <Botao onClick={() => setAditivo(null)}>Cancelar</Botao>
              <Botao
                variante="primario"
                carregando={salvarAditivo.isPending}
                onClick={async () => {
                  await salvarAditivo.mutateAsync(aditivo);
                  setAditivo(null);
                }}
              >
                Salvar aditivo
              </Botao>
            </>
          }
        >
          <div className="pilha">
            <Campo rotulo="Descrição">{(i) => <input id={i} className="cc-entrada" value={aditivo.descricao} onChange={(e) => setAditivo({ ...aditivo, descricao: e.target.value })} />}</Campo>
            <div className="grade-2">
              <Campo rotulo="Data">{(i) => <input id={i} className="cc-entrada" type="date" value={aditivo.data} onChange={(e) => setAditivo({ ...aditivo, data: e.target.value })} />}</Campo>
              <Campo rotulo="Mudança de valor (R$)">
                {(i) => <input id={i} className="cc-entrada" type="number" step="0.01" value={aditivo.valorDelta / 100} onChange={(e) => setAditivo({ ...aditivo, valorDelta: Math.round(Number(e.target.value) * 100) })} />}
              </Campo>
              <Campo rotulo="Novo vencimento (opcional)">
                {(i) => <input id={i} className="cc-entrada" type="date" value={aditivo.novaData ?? ''} onChange={(e) => setAditivo({ ...aditivo, novaData: e.target.value || null })} />}
              </Campo>
            </div>
          </div>
        </Modal>
      )}
    </Pagina>
  );
}
