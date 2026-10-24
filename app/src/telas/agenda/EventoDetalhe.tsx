import { contaNaEscala, formatarReais, pode, type Evento, type Sessao } from '@shared';
import { Ban, ClipboardList, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Etiqueta, Modal, Pagina, Tabela } from '../../componentes';
import { janela } from '../../util/hoje';
import { dataLonga, horarioTexto } from '../../util/sessoes';
import { EventoForm } from './EventoForm';

const INVALIDAR = ['eventos.listar', 'escalas.listar'] as const;

export function eventoVazio(): Evento {
  return {
    id: '', nome: '', tipo: 'Show/Concerto', organizador: '', contatoOrganizador: '', pagamento: 'interno',
    instrumento: 'contrato', status: 'ativo',
  };
}

function ModalCancelar({
  alvo,
  aoFechar,
}: {
  alvo: { tipo: 'evento'; id: string; nome: string } | { tipo: 'sessao'; id: string; nome: string } | null;
  aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const cancelarEvento = useMutacao('eventos.cancelar', [...INVALIDAR]);
  const cancelarSessao = useMutacao('sessoes.cancelar', [...INVALIDAR]);
  if (!alvo) return null;
  const pendente = cancelarEvento.isPending || cancelarSessao.isPending;

  async function confirmar() {
    setErro(null);
    try {
      if (alvo!.tipo === 'evento') await cancelarEvento.mutateAsync({ eventoId: alvo!.id, justificativa: motivo });
      else await cancelarSessao.mutateAsync({ sessaoId: alvo!.id, justificativa: motivo });
      setMotivo('');
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Modal
      aberto
      titulo={alvo.tipo === 'evento' ? 'Cancelar evento' : 'Cancelar sessão'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Voltar</Botao>
          <Botao variante="perigo" carregando={pendente} onClick={confirmar}>
            Confirmar cancelamento
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <p>
          <strong>{alvo.nome}</strong>
        </p>
        <Alerta tom="aviso">Os escalados serão avisados e não receberão por esta sessão.</Alerta>
        <Campo rotulo="Motivo (obrigatório)">
          {(id) => <textarea id={id} className="cc-entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

export function EventoDetalhe() {
  const { eventoId = '' } = useParams();
  const novo = eventoId === 'novo';
  const eu = useEu();
  const navegar = useNavigate();
  const { de, ate } = janela(400, 400);
  const periodo = usePeriodo(de, ate);
  const escalas = useConsulta('escalas.listar', { de, ate });
  const pessoas = usePessoas();
  const config = useConsulta('config.obter', null);
  const salvar = useMutacao('eventos.salvar', [...INVALIDAR]);
  const [editando, setEditando] = useState(novo);
  const [cancelando, setCancelando] = useState<Parameters<typeof ModalCancelar>[0]['alvo']>(null);

  if (periodo.isLoading || pessoas.isLoading) return <Carregando />;

  const evento = novo ? eventoVazio() : periodo.evento.get(eventoId);
  if (!evento) return <EstadoVazio titulo="Evento não encontrado" acao={<Link to="/agenda">Voltar para a agenda</Link>} />;
  const sessoes = periodo.sessoes.filter((s) => s.eventoId === evento.id).sort((a, b) => a.data.localeCompare(b.data) || (a.chegada ?? '').localeCompare(b.chegada ?? ''));
  const servidores = pessoas.lista.filter((p) => p.tipo === 'servidor' && p.ativo);
  const podeEditar = pode(eu.permissoes, 'eventos', 'editar');

  if (editando) {
    return (
      <Pagina titulo={novo ? 'Novo evento' : `Editar: ${evento.nome}`}>
        <EventoForm
          evento={evento}
          sessoes={sessoes}
          servidores={servidores}
          config={config.data}
          salvando={salvar.isPending}
          aoCancelar={() => (novo ? navegar('/agenda') : setEditando(false))}
          aoSalvar={async (e, s) => {
            const r = await salvar.mutateAsync({ evento: e, sessoes: s });
            setEditando(false);
            if (novo) navegar(`/agenda/${r.evento.id}`, { replace: true });
          }}
        />
      </Pagina>
    );
  }

  const escalados = (s: Sessao, papel: 'bolsista' | 'servidor') =>
    (escalas.data ?? []).filter((e) => e.sessaoId === s.id && e.papel === papel && contaNaEscala(e)).length;
  const responsavel = evento.servidorResponsavelId ? pessoas.pessoa.get(evento.servidorResponsavelId)?.nome : '—';

  return (
    <Pagina
      titulo={evento.nome}
      subtitulo={
        <span className="linha">
          <Etiqueta>{evento.tipo}</Etiqueta>
          {evento.status === 'cancelado' && <Etiqueta tom="erro">Cancelado</Etiqueta>}
          <Etiqueta tom={evento.pagamento === 'externo' ? 'info' : 'neutro'}>
            {evento.pagamento === 'externo' ? `Pagamento externo · ${evento.pagadorExterno}` : 'Pagamento interno'}
          </Etiqueta>
        </span>
      }
      acoes={
        podeEditar &&
        evento.status === 'ativo' && (
          <>
            <Botao onClick={() => setEditando(true)}>
              <Pencil size={16} aria-hidden /> Editar
            </Botao>
            <Botao variante="perigo" onClick={() => setCancelando({ tipo: 'evento', id: evento.id, nome: evento.nome })}>
              <Ban size={16} aria-hidden /> Cancelar evento
            </Botao>
          </>
        )
      }
    >
      <Cartao titulo="Informações">
        <dl className="grade-2" style={{ margin: 0 }}>
          {[
            ['Organizador', evento.organizador || '—'],
            ['Contato', evento.contatoOrganizador || '—'],
            ['Servidor responsável', responsavel ?? '—'],
            ['Instrumento', { contrato: 'Contrato', termo: 'Termo de autorização', nenhum: 'Nenhum' }[evento.instrumento]],
            ['Público estimado', evento.publicoEstimado ?? '—'],
            ['Público real', evento.publicoReal ?? '—'],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="pequeno texto-2">{k}</dt>
              <dd style={{ margin: 0 }} className="negrito">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </Cartao>

      <Cartao
        titulo={`Sessões (${sessoes.length})`}
        acoes={
          <Link to="/escalas?aba=montar" className="cc-botao" data-variante="secundario" data-tamanho="pequeno">
            <ClipboardList size={16} aria-hidden /> Montar escala
          </Link>
        }
      >
        <Tabela
          colunas={[
            { chave: 'data', titulo: 'Data', render: (s) => dataLonga(s.data) },
            { chave: 'rotulo', titulo: 'Sessão', render: (s) => s.rotulo || '—' },
            { chave: 'horario', titulo: 'Horário', render: (s) => horarioTexto(s) },
            {
              chave: 'escala',
              titulo: 'Escala',
              render: (s) => (
                <span className="linha">
                  <Etiqueta tom={escalados(s, 'bolsista') >= s.vagasBolsistas ? 'sucesso' : 'aviso'}>
                    {escalados(s, 'bolsista')}/{s.vagasBolsistas} bolsistas
                  </Etiqueta>
                  <Etiqueta>{escalados(s, 'servidor')}/{s.vagasServidores} serv.</Etiqueta>
                </span>
              ),
            },
            { chave: 'diaria', titulo: 'Diária', render: (s) => (s.diaria ? formatarReais(s.diaria) : 'padrão') },
            {
              chave: 'status',
              titulo: '',
              render: (s) =>
                s.status === 'cancelada' ? (
                  <Etiqueta tom="erro">Cancelada</Etiqueta>
                ) : (
                  podeEditar && (
                    <Botao variante="fantasma" tamanho="pequeno" onClick={() => setCancelando({ tipo: 'sessao', id: s.id, nome: `${evento.nome} – ${dataLonga(s.data)}` })}>
                      Cancelar
                    </Botao>
                  )
                ),
            },
          ]}
          linhas={sessoes}
          chaveLinha={(s) => s.id}
        />
      </Cartao>
      <ModalCancelar alvo={cancelando} aoFechar={() => setCancelando(null)} />
    </Pagina>
  );
}
