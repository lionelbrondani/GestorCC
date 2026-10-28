import { conflitosDoPedido, formatarData, formatarDataHora, NOMES_ATIVIDADE, type ConflitoPedido, type PedidoDatas, type StatusPedido } from '@shared';
import { CalendarPlus, Copy, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePeriodo } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Abas, Alerta, Botao, Campo, Carregando, EstadoVazio, Etiqueta, Modal, Pagina, Tabela } from '../../componentes';
import { ModalEmail, type RascunhoEmail } from '../../componentes/ModalEmail';
import { hoje } from '../../util/hoje';
import { dataLonga } from '../../util/sessoes';
import './pedido.css';

const INVALIDAR = ['pedidos.listar', 'eventos.listar', 'contratos.listar'] as const;
const categoria = (p: PedidoDatas) => (p.categoria === 'Outro' && p.categoriaOutra ? p.categoriaOutra : p.categoria);
const datasTexto = (p: PedidoDatas) => [...new Set(p.dias.map((d) => d.data))].sort().map((d) => formatarData(d).slice(0, 5)).join(', ');

function EtiquetaAgenda({ conflitos }: { conflitos: ConflitoPedido[] }) {
  const graves = conflitos.filter((c) => c.grave).length;
  if (graves) return <Etiqueta tom="erro">{graves === 1 ? '1 conflito' : `${graves} conflitos`}</Etiqueta>;
  if (conflitos.length) return <Etiqueta tom="aviso">outro evento no mesmo dia</Etiqueta>;
  return <Etiqueta tom="sucesso">agenda livre</Etiqueta>;
}

function mensagemPara(p: PedidoDatas): string {
  const ola = `Olá, ${p.responsavel.nome.split(' ')[0] || 'tudo bem'}!`;
  const fim = '\n\nAtenciosamente,\nCentro de Convenções UFSM';
  if (p.status === 'aprovado') {
    return `${ola}\n\nO pedido ${p.protocolo}, para "${p.evento}", foi aprovado. Em breve enviaremos o contrato e o link da ficha técnica do evento.${fim}`;
  }
  if (p.status === 'recusado') {
    return `${ola}\n\nInfelizmente não será possível atender o pedido ${p.protocolo}, para "${p.evento}".\nMotivo: ${p.motivoRecusa}${fim}`;
  }
  return `${ola}\n\nRecebemos o pedido ${p.protocolo}, para "${p.evento}", e estamos analisando as datas.${fim}`;
}

function ModalPedido({ pedido: p, conflitos, aoFechar }: { pedido: PedidoDatas; conflitos: ConflitoPedido[]; aoFechar: () => void }) {
  const navegar = useNavigate();
  const aprovar = useMutacao('pedidos.aprovar', [...INVALIDAR]);
  const recusar = useMutacao('pedidos.recusar', [...INVALIDAR]);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [email, setEmail] = useState<RascunhoEmail | null>(null);

  async function executar(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const linha = (rotulo: string, valor: string | number | null) =>
    valor === null || valor === '' ? null : (
      <div>
        <dt>{rotulo}</dt>
        <dd>{valor}</dd>
      </div>
    );

  const rodape =
    p.status === 'novo' ? (
      <>
        <Botao onClick={() => setEmail({ tipo: 'pedido', titulo: 'Responder o pedido por e-mail', para: [p.responsavel.email], assunto: `Pedido de data ${p.protocolo}: ${p.evento}`, mensagem: mensagemPara(p) })}>
          <Mail size={16} aria-hidden /> E-mail
        </Botao>
        <Botao variante="perigo" onClick={() => setRecusando(true)}>
          Recusar
        </Botao>
        <Botao
          variante="primario"
          carregando={aprovar.isPending}
          onClick={() =>
            executar(async () => {
              const r = await aprovar.mutateAsync({ id: p.id });
              navegar(`/agenda/${r.eventoId}`);
            })
          }
        >
          <CalendarPlus size={16} aria-hidden /> Aprovar e criar evento
        </Botao>
      </>
    ) : (
      <>
        <Botao onClick={() => setEmail({ tipo: 'pedido', titulo: 'Responder o pedido por e-mail', para: [p.responsavel.email].filter(Boolean), assunto: `Pedido de data ${p.protocolo}: ${p.evento}`, mensagem: mensagemPara(p) })}>
          <Mail size={16} aria-hidden /> E-mail
        </Botao>
        {p.eventoId && (
          <Link to={`/agenda/${p.eventoId}`} className="cc-botao" data-variante="primario">
            Abrir o evento
          </Link>
        )}
      </>
    );

  return (
    <>
      <Modal aberto titulo={`Pedido ${p.protocolo}`} largura="grande" aoFechar={aoFechar} rodape={rodape}>
        <div className="pilha">
          <div>
            <h3 style={{ margin: 0 }}>{p.evento}</h3>
            <p className="pequeno texto-2" style={{ margin: 0 }}>
              {categoria(p)} · recebido em {formatarDataHora(p.recebidoEm)}
              {p.decididoEm && ` · ${p.status === 'aprovado' ? 'aprovado' : 'recusado'} em ${formatarDataHora(p.decididoEm)}`}
            </p>
          </div>
          {p.status === 'recusado' && p.motivoRecusa && <Alerta tom="aviso">Motivo da recusa: {p.motivoRecusa}</Alerta>}
          <ul className="pedido-dias">
            {[...p.dias]
              .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio))
              .map((d, i) => (
                <li key={i}>
                  <strong>{dataLonga(d.data)}</strong> · {NOMES_ATIVIDADE[d.atividade]} · {d.inicio} às {d.fim}
                </li>
              ))}
          </ul>
          {p.status === 'novo' &&
            (conflitos.length ? (
              <Alerta tom={conflitos.some((c) => c.grave) ? 'erro' : 'aviso'}>
                <strong>Na agenda nesses dias:</strong>
                <ul className="pedido-conflitos">
                  {conflitos.map((c, i) => (
                    <li key={i}>
                      {formatarData(c.data).slice(0, 5)}: {c.texto}
                    </li>
                  ))}
                </ul>
              </Alerta>
            ) : (
              <Alerta tom="sucesso">A agenda está livre nos dias pedidos.</Alerta>
            ))}
          <dl className="pedido-dados">
            {linha('Espaços', [...p.espacos, ...(p.espacoOutro ? [p.espacoOutro] : [])].join(', '))}
            {linha('Indicação etária', p.indicacao)}
            {linha('Público estimado', p.publico)}
            {linha('Pessoas envolvidas', p.pessoasEnvolvidas)}
            {linha('Programação', p.programacao)}
            {linha('Observações sobre os horários', p.observacoesHorarios)}
            {linha('Informações complementares', p.informacoes)}
          </dl>
          <div className="grade-2">
            <dl className="pedido-dados">
              <h4>Solicitante</h4>
              {linha('Nome jurídico', p.solicitante.razaoSocial)}
              {linha('CNPJ / CPF', p.solicitante.documento)}
              {linha('Endereço', [p.solicitante.endereco, p.solicitante.cep].filter(Boolean).join(' · CEP '))}
              {linha('Inscrição estadual', p.solicitante.inscricaoEstadual)}
              {linha('Inscrição municipal', p.solicitante.inscricaoMunicipal)}
            </dl>
            <dl className="pedido-dados">
              <h4>Responsável</h4>
              {linha('Nome', p.responsavel.nome)}
              {linha('CPF', p.responsavel.cpf)}
              {linha('E-mail', p.responsavel.email)}
              {linha('Telefone/WhatsApp', p.responsavel.telefone)}
            </dl>
          </div>
          {recusando && (
            <div className="pilha-2">
              <Campo rotulo="Motivo da recusa">
                {(id) => <textarea id={id} className="cc-entrada" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: o teatro já está reservado nessas datas." />}
              </Campo>
              <div className="linha">
                <Botao variante="perigo" carregando={recusar.isPending} onClick={() => executar(async () => { await recusar.mutateAsync({ id: p.id, motivo }); setRecusando(false); })}>
                  Confirmar recusa
                </Botao>
                <span className="pequeno texto-2">Depois, responda a pessoa pelo botão E-mail.</span>
              </div>
            </div>
          )}
          {erro && <Alerta tom="erro">{erro}</Alerta>}
        </div>
      </Modal>
      <ModalEmail rascunho={email} aoFechar={() => setEmail(null)} />
    </>
  );
}

/** Pedidos que chegam pela página pública: conflitos com a agenda, aprovar (vira evento) ou recusar. */
export function Pedidos() {
  const pedidos = useConsulta('pedidos.listar', null);
  const [aba, setAba] = useState<StatusPedido>('novo');
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const lista = pedidos.data ?? [];
  const dias = lista.filter((p) => p.status === 'novo').flatMap((p) => p.dias.map((d) => d.data)).sort();
  const periodo = usePeriodo(dias[0] ?? hoje(), dias.at(-1) ?? hoje());

  if (pedidos.isLoading) return <Carregando />;
  const conflitos = (p: PedidoDatas) => conflitosDoPedido(p, periodo.sessoes, periodo.eventos, lista);
  const quantos = (s: StatusPedido) => lista.filter((p) => p.status === s).length;
  const daAba = lista.filter((p) => p.status === aba);
  const selecionado = lista.find((p) => p.id === aberto);
  const link = `${window.location.origin}/pedido-de-data`;

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link);
      setAviso(`Link copiado: ${link}. Use no site, no Instagram e nas respostas, no lugar do formulário do Google.`);
    } catch {
      setAviso(`Link do formulário: ${link}`);
    }
  }

  return (
    <Pagina
      titulo="Pedidos de data"
      subtitulo="Chegam pela página pública. Aprovado, o pedido vira evento na agenda."
      acoes={
        <Botao onClick={copiarLink}>
          <Copy size={16} aria-hidden /> Copiar link do formulário
        </Botao>
      }
    >
      {aviso && <Alerta tom="info">{aviso}</Alerta>}
      <Abas
        abas={[
          { id: 'novo', rotulo: `Para analisar (${quantos('novo')})` },
          { id: 'aprovado', rotulo: `Aprovados (${quantos('aprovado')})` },
          { id: 'recusado', rotulo: `Recusados (${quantos('recusado')})` },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {daAba.length ? (
        <Tabela
          colunas={[
            { chave: 'protocolo', titulo: 'Protocolo', render: (p) => <span className="pequeno">{p.protocolo}</span> },
            {
              chave: 'evento',
              titulo: 'Evento',
              render: (p) => (
                <span>
                  <strong>{p.evento}</strong>
                  <br />
                  <span className="pequeno texto-2">
                    {categoria(p)} · {p.solicitante.razaoSocial}
                  </span>
                </span>
              ),
            },
            { chave: 'datas', titulo: 'Datas', render: datasTexto },
            {
              chave: 'agenda',
              titulo: 'Agenda',
              render: (p) => (p.status === 'novo' ? <EtiquetaAgenda conflitos={conflitos(p)} /> : <span className="pequeno texto-2">{formatarDataHora(p.decididoEm)}</span>),
            },
          ]}
          linhas={daAba}
          chaveLinha={(p) => p.id}
          aoClicar={(p) => setAberto(p.id)}
        />
      ) : (
        <EstadoVazio
          titulo={aba === 'novo' ? 'Nenhum pedido para analisar' : 'Nada por aqui'}
          texto={aba === 'novo' ? 'Os pedidos feitos pela página pública aparecem aqui, com os conflitos da agenda.' : undefined}
        />
      )}
      {selecionado && <ModalPedido pedido={selecionado} conflitos={conflitos(selecionado)} aoFechar={() => setAberto(null)} />}
    </Pagina>
  );
}
