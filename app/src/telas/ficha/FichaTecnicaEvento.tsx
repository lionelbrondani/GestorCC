import { formatarData, formatarDataHora, type Evento, type FichaPublica, type FichaTecnica, type Sessao } from '@shared';
import { CalendarPlus, Copy, Eye, Link2, Lock, LockOpen, Mail, Pencil, Printer, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/cliente';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Alerta, Botao, Carregando, Cartao, Etiqueta, Modal } from '../../componentes';
import { ModalEmail, type RascunhoEmail } from '../../componentes/ModalEmail';
import { baixar } from '../../util/arquivos';
import { FormularioFicha } from './FormularioFicha';
import { ResumoFicha } from './ResumoFicha';

const INVALIDAR = ['fichas.obter'] as const;
const NOME_ITEM = { montagem: 'montagem', passagem: 'passagem de som', desmontagem: 'desmontagem' } as const;

/** O evento como a ficha o vê: nome e sessões ativas em ordem. */
export function eventoDaFicha(evento: Evento, sessoes: Sessao[]): FichaPublica['evento'] {
  return {
    nome: evento.nome,
    sessoes: sessoes
      .filter((s) => s.status === 'ativa')
      .sort((a, b) => a.data.localeCompare(b.data) || (a.inicio ?? '').localeCompare(b.inicio ?? ''))
      .map((s) => ({ id: s.id, data: s.data, rotulo: s.rotulo ?? '', inicio: s.inicio, fim: s.fim })),
  };
}

export const linkDaFicha = (token: string) => `${window.location.origin}/ficha/${token}`;

export function mensagemDaFicha(nomeEvento: string, token: string, prazo: string): string {
  return (
    `Olá! Para o evento "${nomeEvento}", pedimos que preencha a ficha técnica do Centro de Convenções da UFSM neste link:\n${linkDaFicha(token)}\n\n` +
    `Você pode salvar e continuar depois pelo mesmo link, no celular ou no computador.` +
    (prazo ? ` Prazo para enviar e corrigir: ${formatarData(prazo)}.` : '')
  );
}

function EtiquetasFicha({ f }: { f: FichaTecnica }) {
  return (
    <span className="linha">
      {f.status === 'enviada' ? (
        <Etiqueta tom="sucesso">Enviada{f.enviadaEm ? ` em ${formatarDataHora(f.enviadaEm)}` : ''}</Etiqueta>
      ) : (
        <Etiqueta tom="aviso">Ainda não enviada</Etiqueta>
      )}
      {f.travada ? <Etiqueta tom="erro">Travada para o produtor</Etiqueta> : <Etiqueta>Aberta{f.prazo ? ` até ${formatarData(f.prazo)}` : ''}</Etiqueta>}
      {f.trava !== 'auto' && <Etiqueta tom="info">{f.trava === 'travada' ? 'Travada à mão' : 'Destravada à mão'}</Etiqueta>}
    </span>
  );
}

/** Cartão "Ficha técnica" na tela do evento: gerar e copiar o link, ver, corrigir, travar e imprimir. */
export function FichaTecnicaEvento({ evento, sessoes }: { evento: Evento; sessoes: Sessao[] }) {
  const api = useApi();
  const ficha = useConsulta('fichas.obter', { eventoId: evento.id });
  const gerar = useMutacao('fichas.link', [...INVALIDAR]);
  const travar = useMutacao('fichas.travar', [...INVALIDAR]);
  const lancar = useMutacao('fichas.lancarAgenda', [...INVALIDAR]);
  const salvar = useMutacao('fichas.salvar', [...INVALIDAR]);
  const [aviso, setAviso] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [modal, setModal] = useState<'ver' | 'corrigir' | 'novoLink' | null>(null);
  const [email, setEmail] = useState<RascunhoEmail | null>(null);
  const ev = eventoDaFicha(evento, sessoes);

  async function executar(fn: () => Promise<unknown>, ok?: string) {
    setAviso(null);
    try {
      await fn();
      if (ok) setAviso({ tom: 'sucesso', texto: ok });
    } catch (e) {
      setAviso({ tom: 'erro', texto: (e as Error).message });
    }
  }
  const copiar = (texto: string, ok: string) =>
    executar(async () => {
      if (!navigator.clipboard) throw new Error('Não foi possível copiar: selecione o texto e copie à mão.');
      await navigator.clipboard.writeText(texto);
    }, ok);
  const baixarAnexo = (a: { id: string; nome: string }) =>
    executar(async () => {
      const dados = await api.chamar('fichas.anexo', { eventoId: evento.id, anexoId: a.id });
      if (!dados) throw new Error('O arquivo não está mais no Drive.');
      baixar(dados, a.nome);
    });

  if (ficha.isLoading) return <Carregando />;
  const f = ficha.data;

  return (
    <Cartao titulo="Ficha técnica" acoes={f && <EtiquetasFicha f={f} />}>
      {!f ? (
        <div className="pilha-2">
          <p style={{ margin: 0 }}>
            Gere o link e mande ao produtor. Ele preenche sem login, no celular ou no computador, e pode voltar para corrigir até 2 dias antes do evento.
          </p>
          <Botao variante="primario" carregando={gerar.isPending} onClick={() => executar(() => gerar.mutateAsync({ eventoId: evento.id, novo: false }))} style={{ alignSelf: 'flex-start' }}>
            <Link2 size={16} aria-hidden /> Gerar link da ficha técnica
          </Botao>
        </div>
      ) : (
        <div className="pilha">
          <input className="cc-entrada" readOnly value={linkDaFicha(f.token)} aria-label="Link da ficha técnica" onFocus={(e) => e.target.select()} />
          <div className="linha">
            <Botao tamanho="pequeno" onClick={() => copiar(linkDaFicha(f.token), 'Link copiado.')}>
              <Copy size={16} aria-hidden /> Copiar link
            </Botao>
            <Botao tamanho="pequeno" onClick={() => copiar(mensagemDaFicha(evento.nome, f.token, f.prazo), 'Mensagem copiada. Cole no e-mail ou no WhatsApp do produtor.')}>
              <Copy size={16} aria-hidden /> Copiar mensagem para o produtor
            </Botao>
            <Botao
              tamanho="pequeno"
              onClick={() =>
                setEmail({
                  tipo: 'ficha',
                  titulo: 'Mandar a ficha técnica por e-mail',
                  para: f.dados.responsavel.email ? [f.dados.responsavel.email] : [],
                  assunto: `Ficha técnica do Centro de Convenções: ${evento.nome}`,
                  mensagem: mensagemDaFicha(evento.nome, f.token, f.prazo),
                })
              }
            >
              <Mail size={16} aria-hidden /> Enviar por e-mail
            </Botao>
            <Botao tamanho="pequeno" onClick={() => setModal('ver')}>
              <Eye size={16} aria-hidden /> Ver ficha
            </Botao>
            <Botao tamanho="pequeno" onClick={() => setModal('corrigir')}>
              <Pencil size={16} aria-hidden /> Corrigir
            </Botao>
            <Link to={`/agenda/${evento.id}/ficha`} className="cc-botao" data-variante="secundario" data-tamanho="pequeno">
              <Printer size={16} aria-hidden /> Imprimir resumo
            </Link>
            {f.travada ? (
              <Botao tamanho="pequeno" carregando={travar.isPending} onClick={() => executar(() => travar.mutateAsync({ eventoId: evento.id, trava: 'destravada' }), 'O produtor pode alterar a ficha de novo.')}>
                <LockOpen size={16} aria-hidden /> Destravar para o produtor
              </Botao>
            ) : (
              <Botao tamanho="pequeno" carregando={travar.isPending} onClick={() => executar(() => travar.mutateAsync({ eventoId: evento.id, trava: 'travada' }), 'Ficha travada: o produtor só consegue ver.')}>
                <Lock size={16} aria-hidden /> Travar agora
              </Botao>
            )}
            {f.trava !== 'auto' && (
              <Botao tamanho="pequeno" variante="fantasma" onClick={() => executar(() => travar.mutateAsync({ eventoId: evento.id, trava: 'auto' }), 'A ficha volta a travar sozinha 2 dias antes do evento.')}>
                Voltar ao prazo automático
              </Botao>
            )}
            <Botao tamanho="pequeno" variante="fantasma" onClick={() => setModal('novoLink')}>
              <RefreshCw size={16} aria-hidden /> Gerar novo link
            </Botao>
          </div>
          <div className="linha">
            <Botao
              tamanho="pequeno"
              variante={f.agenda ? 'secundario' : 'primario'}
              carregando={lancar.isPending}
              onClick={() =>
                executar(async () => {
                  const r = await lancar.mutateAsync({ eventoId: evento.id });
                  setAviso({ tom: 'sucesso', texto: `Na agenda do CC: ${(r.agenda?.itens ?? []).map((i) => NOME_ITEM[i]).join(', ')}.` });
                })
              }
            >
              <CalendarPlus size={16} aria-hidden /> {f.agenda ? 'Atualizar na agenda do CC' : 'Lançar montagem e desmontagem na agenda do CC'}
            </Botao>
            {f.agenda && (
              <span className="pequeno texto-2">
                Lançado em {formatarDataHora(f.agenda.lancadoEm)}: {f.agenda.itens.map((i) => NOME_ITEM[i]).join(', ')}. Se a ficha mudar, atualize.
              </span>
            )}
          </div>
        </div>
      )}
      {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}
      <ModalEmail rascunho={email} aoFechar={() => setEmail(null)} />

      {f && (
        <>
          <Modal aberto={modal === 'ver'} titulo="Ficha técnica" largura="grande" aoFechar={() => setModal(null)}>
            <ResumoFicha evento={ev} dados={f.dados} aoBaixarAnexo={baixarAnexo} />
          </Modal>
          <Modal aberto={modal === 'corrigir'} titulo="Corrigir a ficha técnica" largura="grande" aoFechar={() => setModal(null)}>
            <FormularioFicha
              evento={ev}
              inicial={f.dados}
              modo="gestor"
              aoBaixarAnexo={baixarAnexo}
              aoSalvar={async (dados) => {
                await salvar.mutateAsync({ eventoId: evento.id, dados, versao: f.atualizadoEm });
                setModal(null);
                setAviso({ tom: 'sucesso', texto: 'Ficha corrigida.' });
              }}
            />
          </Modal>
          <Modal
            aberto={modal === 'novoLink'}
            titulo="Gerar novo link"
            aoFechar={() => setModal(null)}
            rodape={
              <>
                <Botao onClick={() => setModal(null)}>Voltar</Botao>
                <Botao
                  variante="perigo"
                  carregando={gerar.isPending}
                  onClick={() => executar(() => gerar.mutateAsync({ eventoId: evento.id, novo: true }), 'Novo link gerado. Mande o novo link ao produtor.').then(() => setModal(null))}
                >
                  Gerar novo link
                </Botao>
              </>
            }
          >
            <p>O link atual deixa de funcionar na hora. O que já foi preenchido continua salvo. Use quando o link foi parar com a pessoa errada.</p>
          </Modal>
        </>
      )}
    </Cartao>
  );
}
