import { formatarData, formatarDataHora, linkWhatsapp, type DestinoCortesias, type Evento, type PessoaCortesia, type Sessao } from '@shared';
import { Copy, ListChecks, Mail, MessageCircle, Pencil, Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Alerta, Botao, Campo, Carregando, Cartao, Etiqueta, Modal, Tabela, type ColunaTabela } from '../../componentes';
import { ModalEmail, type RascunhoEmail } from '../../componentes/ModalEmail';
import { errosDasLinhas, ListaPessoas, preenchidas } from './ListaPessoas';

const INVALIDAR = ['cortesias.listar'] as const;

export const linkDasCortesias = (token: string) => `${window.location.origin}/cortesias/${token}`;

export function mensagemDasCortesias(evento: string, datas: string[], d: DestinoCortesias): string {
  return (
    `Olá! O Centro de Convenções da UFSM reservou ${d.quantidade} ${d.quantidade === 1 ? 'cortesia' : 'cortesias'} para ${d.nome} no evento "${evento}"` +
    (datas.length ? ` (${datas.map(formatarData).join(', ')})` : '') +
    `. Informe neste link quem vai receber${d.pedirMatricula ? ' (nome e matrícula)' : ''}:\n${linkDasCortesias(d.token)}\n\n` +
    `Você pode salvar e voltar pelo mesmo link${d.prazo ? ` até ${formatarData(d.prazo)}` : ''}.`
  );
}

type FormDestino = { id: string; nome: string; quantidade: string; pedirMatricula: boolean };

function ModalDestino({ eventoId, destino, aoFechar }: { eventoId: string; destino: DestinoCortesias | 'novo'; aoFechar: () => void }) {
  const novo = destino === 'novo';
  const [f, setF] = useState<FormDestino>(
    novo ? { id: '', nome: '', quantidade: '', pedirMatricula: true } : { id: destino.id, nome: destino.nome, quantidade: String(destino.quantidade), pedirMatricula: destino.pedirMatricula },
  );
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const salvar = useMutacao('cortesias.salvarDestino', [...INVALIDAR]);
  const remover = useMutacao('cortesias.removerDestino', [...INVALIDAR]);
  const travar = useMutacao('cortesias.travar', [...INVALIDAR]);
  const novoLink = useMutacao('cortesias.novoLink', [...INVALIDAR]);

  async function executar(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Modal
      aberto
      titulo={novo ? 'Novo destino de cortesias' : `Destino: ${destino.nome}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Voltar</Botao>
          <Botao
            variante="primario"
            carregando={salvar.isPending}
            onClick={() => executar(() => salvar.mutateAsync({ id: f.id, eventoId, nome: f.nome, quantidade: Number(f.quantidade), pedirMatricula: f.pedirMatricula }))}
          >
            Salvar destino
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <div className="grade-2">
          <Campo rotulo="Destino" ajuda="Ex.: Casa do Estudante, CEU II, PRE">
            {(id) => <input id={id} className="cc-entrada" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />}
          </Campo>
          <Campo rotulo="Quantidade">
            {(id) => <input id={id} className="cc-entrada" type="number" inputMode="numeric" min={1} value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} />}
          </Campo>
        </div>
        <label className="cc-caixa">
          <input type="checkbox" checked={f.pedirMatricula} onChange={(e) => setF({ ...f, pedirMatricula: e.target.checked })} />
          <span>Pedir a matrícula de cada pessoa (desmarque para destinos de fora da UFSM)</span>
        </label>
        {!novo && (
          <div className="linha">
            {destino.travada ? (
              <Botao tamanho="pequeno" onClick={() => executar(() => travar.mutateAsync({ id: destino.id, trava: 'destravada' }))}>
                Destravar para o destino
              </Botao>
            ) : (
              <Botao tamanho="pequeno" onClick={() => executar(() => travar.mutateAsync({ id: destino.id, trava: 'travada' }))}>
                Travar agora
              </Botao>
            )}
            {destino.trava !== 'auto' && (
              <Botao tamanho="pequeno" variante="fantasma" onClick={() => executar(() => travar.mutateAsync({ id: destino.id, trava: 'auto' }))}>
                Voltar ao prazo automático
              </Botao>
            )}
            <Botao tamanho="pequeno" variante="fantasma" onClick={() => executar(() => novoLink.mutateAsync({ id: destino.id }))}>
              Gerar novo link (o atual deixa de valer)
            </Botao>
            {confirmarRemover ? (
              <Botao tamanho="pequeno" variante="perigo" onClick={() => executar(() => remover.mutateAsync({ id: destino.id }))}>
                Confirmar: remover destino e lista
              </Botao>
            ) : (
              <Botao tamanho="pequeno" variante="fantasma" onClick={() => setConfirmarRemover(true)}>
                Remover destino
              </Botao>
            )}
          </div>
        )}
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

function ModalLista({ destino, aoFechar }: { destino: DestinoCortesias; aoFechar: () => void }) {
  const [pessoas, setPessoas] = useState<PessoaCortesia[]>(destino.pessoas);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useMutacao('cortesias.salvarPessoas', [...INVALIDAR]);
  return (
    <Modal
      aberto
      titulo={`Lista: ${destino.nome}`}
      largura="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Voltar</Botao>
          <Botao
            variante="primario"
            carregando={salvar.isPending}
            onClick={async () => {
              setTentou(true);
              setErro(null);
              if (errosDasLinhas(pessoas, destino.pedirMatricula).length) return setErro('Confira as linhas destacadas.');
              try {
                await salvar.mutateAsync({ id: destino.id, pessoas });
                aoFechar();
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Salvar lista
          </Botao>
        </>
      }
    >
      <ListaPessoas pessoas={pessoas} aoMudar={setPessoas} quantidade={destino.quantidade} pedirMatricula={destino.pedirMatricula} mostrarErros={tentou} />
      {erro && <Alerta tom="erro">{erro}</Alerta>}
    </Modal>
  );
}

/** Cartão "Cortesias" na tela do evento: destinos, quantidades, links e a lista para imprimir. */
export function CortesiasEvento({ evento, sessoes }: { evento: Evento; sessoes: Sessao[] }) {
  const dados = useConsulta('cortesias.listar', { eventoId: evento.id });
  const [editando, setEditando] = useState<DestinoCortesias | 'novo' | null>(null);
  const [lista, setLista] = useState<DestinoCortesias | null>(null);
  const [aviso, setAviso] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [email, setEmail] = useState<RascunhoEmail | null>(null);
  const datas = sessoes.filter((s) => s.status === 'ativa').map((s) => s.data).sort();

  async function copiar(texto: string, ok: string) {
    setAviso(null);
    try {
      if (!navigator.clipboard) throw new Error('Não foi possível copiar: abra a lista e copie à mão.');
      await navigator.clipboard.writeText(texto);
      setAviso({ tom: 'sucesso', texto: ok });
    } catch (e) {
      setAviso({ tom: 'erro', texto: (e as Error).message });
    }
  }

  if (dados.isLoading) return <Carregando />;
  const destinos = dados.data?.destinos ?? [];
  const total = dados.data?.totalContrato ?? null;
  const reservadas = destinos.reduce((n, d) => n + d.quantidade, 0);

  const colunas: ColunaTabela<DestinoCortesias>[] = [
    { chave: 'nome', titulo: 'Destino', render: (d) => <span className="negrito">{d.nome}</span> },
    {
      chave: 'lancados',
      titulo: 'Nomes',
      render: (d) => (
        <Etiqueta tom={preenchidas(d.pessoas).length >= d.quantidade ? 'sucesso' : d.pessoas.length ? 'info' : 'aviso'}>
          {preenchidas(d.pessoas).length} de {d.quantidade}
        </Etiqueta>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (d) => (
        <span className="pequeno texto-2">
          {d.travada ? 'travada' : d.prazo ? `aberta até ${formatarData(d.prazo)}` : 'aberta'}
          {d.atualizadoPeloDestinoEm && ` · lançada em ${formatarDataHora(d.atualizadoPeloDestinoEm)}`}
        </span>
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      render: (d) => (
        <span className="linha" style={{ flexWrap: 'nowrap' }}>
          <Botao tamanho="pequeno" onClick={() => copiar(mensagemDasCortesias(evento.nome, datas, d), `Mensagem para ${d.nome} copiada. Cole no e-mail ou no WhatsApp.`)}>
            <Copy size={14} aria-hidden /> Copiar mensagem
          </Botao>
          <Botao
            tamanho="pequeno"
            variante="fantasma"
            aria-label={`E-mail para ${d.nome}`}
            onClick={() =>
              setEmail({
                tipo: 'cortesias',
                titulo: 'Mandar as cortesias por e-mail',
                para: [],
                assunto: `Cortesias: ${evento.nome}`,
                mensagem: mensagemDasCortesias(evento.nome, datas, d),
              })
            }
          >
            <Mail size={14} aria-hidden /> E-mail
          </Botao>
          <a
            className="cc-botao"
            data-variante="fantasma"
            data-tamanho="pequeno"
            href={linkWhatsapp(mensagemDasCortesias(evento.nome, datas, d))}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp para ${d.nome}`}
          >
            <MessageCircle size={14} aria-hidden /> WhatsApp
          </a>
          <Botao tamanho="pequeno" variante="fantasma" onClick={() => copiar(linkDasCortesias(d.token), 'Link copiado.')}>
            Link
          </Botao>
          <Botao tamanho="pequeno" variante="fantasma" onClick={() => setLista(d)} aria-label={`Ver a lista de ${d.nome}`}>
            <ListChecks size={14} aria-hidden /> Lista
          </Botao>
          <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEditando(d)} aria-label={`Editar ${d.nome}`}>
            <Pencil size={14} aria-hidden />
          </Botao>
        </span>
      ),
    },
  ];

  return (
    <Cartao
      titulo="Cortesias"
      acoes={
        <>
          <Botao tamanho="pequeno" onClick={() => setEditando('novo')}>
            <Plus size={16} aria-hidden /> Novo destino
          </Botao>
          {destinos.length > 0 && (
            <Link to={`/agenda/${evento.id}/cortesias`} className="cc-botao" data-variante="secundario" data-tamanho="pequeno">
              <Printer size={16} aria-hidden /> Imprimir lista
            </Link>
          )}
        </>
      }
    >
      <p className="pequeno texto-2" style={{ margin: 0 }}>
        {total !== null ? `Contrato: ${total} cortesias · ` : ''}
        {reservadas} reservadas para {destinos.length} {destinos.length === 1 ? 'destino' : 'destinos'}. Cada destino recebe um link para lançar quem vai receber.
      </p>
      {total !== null && reservadas > total && <Alerta tom="aviso">Os destinos somam {reservadas} cortesias, mais que as {total} do contrato.</Alerta>}
      {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}
      {destinos.length > 0 && <Tabela colunas={colunas} linhas={destinos} chaveLinha={(d) => d.id} />}
      {editando && <ModalDestino eventoId={evento.id} destino={editando} aoFechar={() => setEditando(null)} />}
      {lista && <ModalLista destino={lista} aoFechar={() => setLista(null)} />}
      <ModalEmail rascunho={email} aoFechar={() => setEmail(null)} />
    </Cartao>
  );
}
