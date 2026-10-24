import { CalendarCheck, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu, useSessao } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Cartao, Etiqueta } from '../../componentes';

/** Preferência do bolsista: receber convites das próprias escalas no Google Agenda. */
export function CartaoAgendaPessoal() {
  const eu = useEu();
  const { atualizarPessoa } = useSessao();
  const salvar = useMutacao('perfil.salvarAgenda', ['pessoas.listar']);
  const emails = [eu.emailAcademico, eu.emailAlternativo].filter((e): e is string => !!e);
  const [ativo, setAtivo] = useState(!!eu.convitesAgenda);
  const [email, setEmail] = useState(eu.convitesAgenda ?? emails[0] ?? '');
  const [msg, setMsg] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);

  return (
    <Cartao titulo="Minhas escalas no Google Agenda">
      <div className="pilha">
        <p className="pequeno texto-2">
          Quando sua escala for publicada, você recebe um convite do Centro de Convenções no seu Google Agenda. Trocas, horários definidos e
          cancelamentos atualizam sozinhos. Os outros convidados não veem o seu e-mail.
        </p>
        <label className="cc-caixa">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Receber minhas escalas no Google Agenda
        </label>
        {ativo && emails.length > 1 && (
          <Campo rotulo="E-mail que recebe os convites">
            {(id) => (
              <select id={id} className="cc-entrada" value={email} onChange={(e) => setEmail(e.target.value)}>
                {emails.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            )}
          </Campo>
        )}
        {ativo && emails.length === 1 && <p className="pequeno">Os convites vão para {emails[0]}.</p>}
        {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
        <div>
          <Botao
            variante="primario"
            carregando={salvar.isPending}
            onClick={async () => {
              setMsg(null);
              try {
                const p = await salvar.mutateAsync({ email: ativo ? email : null });
                atualizarPessoa(p);
                setMsg({ tom: 'sucesso', texto: ativo ? `Convites ativados para ${email}.` : 'Convites desativados.' });
              } catch (e) {
                setMsg({ tom: 'erro', texto: (e as Error).message });
              }
            }}
          >
            Salvar preferência
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

/** Aviso em Minhas escalas para quem ainda não ativou os convites. */
export function AvisoAgendaPessoal() {
  const eu = useEu();
  if (eu.convitesAgenda) return null;
  return (
    <Alerta tom="info">
      <div className="linha-entre">
        <span>Receba suas escalas no seu Google Agenda, com atualização automática.</span>
        <Link to="/perfil" className="cc-botao" data-variante="secundario" data-tamanho="pequeno">
          <CalendarCheck size={14} aria-hidden /> Ativar no Perfil
        </Link>
      </div>
    </Alerta>
  );
}

/** Situação da agenda Google do setor (Agenda e Configurações). */
export function CartaoAgendaSetor() {
  const q = useConsulta('config.obter', null);
  const a = q.data?.agendaSetor;
  if (!a) return null;
  return (
    <Cartao
      titulo="Google Agenda do setor"
      acoes={<Etiqueta tom={a.conectada ? 'sucesso' : 'aviso'}>{a.conectada ? 'Sincronizada' : 'Desconectada'}</Etiqueta>}
    >
      <div className="linha-entre">
        <span className="pequeno texto-2">
          Agenda "{a.nome}" da conta {a.conta}. Todo evento criado, alterado ou cancelado aqui é atualizado lá automaticamente; a equipe só
          precisa assinar a agenda.
        </span>
        <a className="cc-botao" data-variante="secundario" data-tamanho="pequeno" href={a.link} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden /> Abrir no Google Agenda
        </a>
      </div>
      <p className="pequeno texto-3" style={{ marginTop: 8 }}>
        Protótipo: a sincronização real começa quando o sistema for ligado à conta do setor (fase 2).
      </p>
    </Cartao>
  );
}
