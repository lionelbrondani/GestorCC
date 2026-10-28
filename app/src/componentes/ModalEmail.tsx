import { EMAIL_JUNTO, LIMITE_ASSUNTO, LIMITE_DESTINATARIOS, separarEmails, type Id, type TipoEmail } from '@shared';
import { Plus, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useConsulta, useMutacao } from '../api/hooks';
import { Alerta, Botao, Campo, Modal } from '.';

/** O e-mail que a tela propõe; quem vai mandar ainda pode mudar tudo antes de clicar em Enviar. */
export interface RascunhoEmail {
  tipo: TipoEmail;
  /** Título da janela, ex.: "Mandar a ficha técnica por e-mail". */
  titulo: string;
  para: string[];
  /** Pessoas da equipe, pelo nome; o endereço de cada uma quem busca é o servidor. */
  pessoas?: { id: Id; nome: string }[];
  assunto: string;
  mensagem: string;
  /** Versão formatada (FUNDEP): só vai se a mensagem não for mudada. */
  html?: string;
  contratoIds?: Id[];
  /** O que mais vai junto, ex.: os PDFs anexados. */
  observacao?: string;
}

/** Janela de e-mail: mostra tudo o que vai sair e só manda quando a pessoa clica em Enviar. */
export function ModalEmail({ rascunho, aoFechar }: { rascunho: RascunhoEmail | null; aoFechar: () => void }) {
  return rascunho ? <JanelaEmail rascunho={rascunho} aoFechar={aoFechar} /> : null;
}

function JanelaEmail({ rascunho, aoFechar }: { rascunho: RascunhoEmail; aoFechar: () => void }) {
  const [paraTexto, setParaTexto] = useState(rascunho.para.join(', '));
  const [fora, setFora] = useState<Set<Id>>(new Set());
  const [assunto, setAssunto] = useState(rascunho.assunto);
  const [mensagem, setMensagem] = useState(rascunho.mensagem);
  const cota = useConsulta('emails.cota', null);
  const enviar = useMutacao('emails.enviar', ['emails.cota', 'historico.listar']);

  const pessoas = rascunho.pessoas ?? [];
  const pessoaIds = pessoas.filter((p) => !fora.has(p.id)).map((p) => p.id);
  const { validos, invalidos } = separarEmails(paraTexto);
  const total = validos.length + pessoaIds.length;
  const pronto = total > 0 && total <= LIMITE_DESTINATARIOS && !invalidos.length && assunto.trim() !== '' && mensagem.trim() !== '';
  const alternar = (id: Id) => {
    const n = new Set(fora);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setFora(n);
  };

  if (enviar.isSuccess) {
    const n = enviar.data.enviados;
    return (
      <Modal aberto titulo={rascunho.titulo} aoFechar={aoFechar} rodape={<Botao variante="primario" onClick={aoFechar}>Fechar</Botao>}>
        <Alerta tom="sucesso">
          E-mail enviado para {n} {n === 1 ? 'pessoa' : 'pessoas'}.
        </Alerta>
      </Modal>
    );
  }

  return (
    <Modal
      aberto
      titulo={rascunho.titulo}
      aoFechar={aoFechar}
      largura="grande"
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={!pronto}
            carregando={enviar.isPending}
            onClick={() =>
              enviar.mutate({
                tipo: rascunho.tipo,
                para: validos,
                pessoaIds,
                assunto,
                mensagem,
                ...(rascunho.html && mensagem === rascunho.mensagem ? { html: rascunho.html } : {}),
                ...(rascunho.contratoIds ? { contratoIds: rascunho.contratoIds } : {}),
              })
            }
          >
            <Send size={16} aria-hidden /> {total > 1 ? `Enviar para ${total} pessoas` : 'Enviar e-mail'}
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <Alerta tom="info">
          Nada é enviado até você clicar em <strong>Enviar</strong>. O e-mail sai pela conta do Centro de Convenções
          {EMAIL_JUNTO[rascunho.tipo] ? ', um só, para todos os destinatários.' : '; cada pessoa recebe o seu, sem ver os outros endereços.'}
        </Alerta>
        {pessoas.length > 0 && (
          <div className="email-pessoas">
            <span className="email-rotulo">
              Para: {pessoaIds.length} de {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'}
            </span>
            <ul>
              {pessoas.map((p) => (
                <li key={p.id} className="email-pessoa" data-fora={fora.has(p.id) || undefined}>
                  {p.nome}
                  <button type="button" onClick={() => alternar(p.id)} aria-label={fora.has(p.id) ? `Incluir ${p.nome}` : `Tirar ${p.nome}`}>
                    {fora.has(p.id) ? <Plus size={14} aria-hidden /> : <X size={14} aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Campo
          rotulo={pessoas.length ? 'Outros e-mails (opcional)' : 'Para'}
          erro={invalidos.length ? `E-mail inválido: ${invalidos.join(', ')}` : null}
          ajuda="Separe os e-mails por vírgula."
        >
          {(id) => <input id={id} className="cc-entrada" type="text" inputMode="email" placeholder="nome@exemplo.com" value={paraTexto} onChange={(e) => setParaTexto(e.target.value)} />}
        </Campo>
        <Campo rotulo="Assunto">
          {(id) => <input id={id} className="cc-entrada" maxLength={LIMITE_ASSUNTO} value={assunto} onChange={(e) => setAssunto(e.target.value)} />}
        </Campo>
        <Campo rotulo="Mensagem" ajuda={rascunho.html ? 'Se você mudar o texto, o e-mail vai sem a formatação (negrito).' : undefined}>
          {(id) => <textarea id={id} className="cc-entrada" rows={10} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />}
        </Campo>
        {rascunho.observacao && <p className="pequeno texto-2">{rascunho.observacao}</p>}
        {total > LIMITE_DESTINATARIOS && <Alerta tom="aviso">Mande para no máximo {LIMITE_DESTINATARIOS} pessoas de cada vez.</Alerta>}
        {cota.data && <p className="pequeno texto-3">Hoje ainda dá para mandar {cota.data.restante} e-mail(s) (limite diário do Google).</p>}
        {enviar.error && <Alerta tom="erro">{enviar.error.message}</Alerta>}
      </div>
    </Modal>
  );
}
