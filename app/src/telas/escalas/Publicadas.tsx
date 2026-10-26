import {
  candidatos,
  contaNaEscala,
  linkWhatsapp,
  textoConvocacao,
  textoWhatsappIndividual,
  textoWhatsappSessao,
  type Sessao,
} from '@shared';
import { Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Etiqueta, Modal } from '../../componentes';
import { agora, hoje } from '../../util/hoje';
import { dataLonga, horarioTexto, tituloSessao } from '../../util/sessoes';
import { copiarTexto, INVALIDAR_ESCALAS, useDadosEscalas } from './dadosEscalas';

type Dados = ReturnType<typeof useDadosEscalas>;

function BotoesTexto({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <span className="linha">
      <Botao
        tamanho="pequeno"
        onClick={async () => {
          setCopiado(await copiarTexto(texto));
          setTimeout(() => setCopiado(false), 2000);
        }}
      >
        <Copy size={14} aria-hidden /> {copiado ? 'Copiado!' : 'Copiar'}
      </Botao>
      <a className="cc-botao" data-variante="secundario" data-tamanho="pequeno" href={linkWhatsapp(texto)} target="_blank" rel="noreferrer">
        <MessageCircle size={14} aria-hidden /> Abrir no WhatsApp
      </a>
    </span>
  );
}

function ModalTroca({ sessao, dados, aoFechar }: { sessao: Sessao; dados: Dados; aoFechar: () => void }) {
  const escalados = dados.escalas.filter((e) => e.sessaoId === sessao.id && contaNaEscala(e));
  const [sai, setSai] = useState('');
  const [entra, setEntra] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const trocar = useMutacao('escalas.trocar', [...INVALIDAR_ESCALAS]);
  const papelSai = escalados.find((e) => e.pessoaId === sai)?.papel;
  const ctx = { ...dados.ctxBase, escalas: dados.escalas };
  const opcoesEntra =
    papelSai === 'servidor'
      ? dados.ctxBase.pessoas.filter((p) => p.tipo === 'servidor' && !escalados.some((e) => e.pessoaId === p.id))
      : candidatos(sessao, ctx);
  const outrosBolsistas = dados.ctxBase.pessoas.filter(
    (p) => p.tipo === (papelSai === 'servidor' ? 'servidor' : 'bolsista') && !escalados.some((e) => e.pessoaId === p.id) && !opcoesEntra.includes(p),
  );
  const nome = (id: string) => dados.pessoas.pessoa.get(id)?.nome ?? id;

  async function confirmar() {
    setErro(null);
    try {
      await trocar.mutateAsync({ sessaoId: sessao.id, sai: sai || null, entra: entra || null, justificativa });
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Modal
      aberto
      titulo="Trocar pessoas na escala"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" carregando={trocar.isPending} onClick={confirmar}>
            Confirmar troca
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <p className="texto-2">{tituloSessao(dados.periodo.evento.get(sessao.eventoId), sessao)} · {dataLonga(sessao.data)}</p>
        <Campo rotulo="Quem sai">
          {(id) => (
            <select id={id} className="cc-entrada" value={sai} onChange={(e) => { setSai(e.target.value); setEntra(''); }}>
              <option value="">(ninguém — só adicionar)</option>
              {escalados.map((e) => (
                <option key={e.id} value={e.pessoaId}>
                  {nome(e.pessoaId)} {e.papel === 'servidor' ? '(servidor)' : ''}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Quem entra" ajuda="Servidor só troca com servidor; bolsista com bolsista.">
          {(id) => (
            <select id={id} className="cc-entrada" value={entra} onChange={(e) => setEntra(e.target.value)}>
              <option value="">(ninguém — só remover)</option>
              <optgroup label="Disponíveis">
                {opcoesEntra.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Sem disponibilidade marcada">
                {outrosBolsistas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            </select>
          )}
        </Campo>
        <Campo rotulo="Justificativa (obrigatória)">
          {(id) => <textarea id={id} className="cc-entrada" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex.: pediu troca no grupo do WhatsApp" />}
        </Campo>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}

function ModalConvocacao({ sessao, dados, aoFechar }: { sessao: Sessao; dados: Dados; aoFechar: () => void }) {
  const [vagas, setVagas] = useState(2);
  const [ate, setAte] = useState(`${hoje()}T18:00`);
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const convocar = useMutacao('escalas.convocar', [...INVALIDAR_ESCALAS, 'notificacoes.listar']);
  const texto = textoConvocacao(dados.periodo.evento.get(sessao.eventoId)!, sessao, vagas, ate);

  return (
    <Modal aberto titulo="Pedir mais bolsistas" aoFechar={aoFechar} rodape={<Botao onClick={aoFechar}>Fechar</Botao>}>
      <div className="pilha">
        <p className="texto-2">
          Os escalados continuam. A sessão volta a receber disponibilidade só de quem ainda não está nela, e os bolsistas são avisados no app.
        </p>
        <div className="grade-2">
          <Campo rotulo="Vagas extras">{(id) => <input id={id} className="cc-entrada" type="number" min={1} value={vagas} onChange={(e) => setVagas(Number(e.target.value))} />}</Campo>
          <Campo rotulo="Responder até">{(id) => <input id={id} className="cc-entrada" type="datetime-local" value={ate} onChange={(e) => setAte(e.target.value)} />}</Campo>
        </div>
        {!feito ? (
          <Botao
            variante="primario"
            carregando={convocar.isPending}
            onClick={async () => {
              setErro(null);
              try {
                await convocar.mutateAsync({ sessaoId: sessao.id, vagas, abertaAte: ate });
                setFeito(true);
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Abrir convocação
          </Botao>
        ) : (
          <Alerta tom="sucesso">Convocação aberta. Quando houver respostas, escale os novos pela opção "Trocar" (só entra).</Alerta>
        )}
        {erro && <Alerta tom="erro">{erro}</Alerta>}
        <div className="pilha-2">
          <strong className="pequeno">Mensagem para o grupo</strong>
          <pre className="texto-whats">{texto}</pre>
          <BotoesTexto texto={texto} />
        </div>
      </div>
    </Modal>
  );
}

export function Publicadas({ mes }: { mes: string }) {
  const dados = useDadosEscalas(mes);
  const [troca, setTroca] = useState<Sessao | null>(null);
  const [convocacao, setConvocacao] = useState<Sessao | null>(null);
  const [individuais, setIndividuais] = useState(false);

  if (dados.carregando) return <Carregando />;
  const publicadas = dados.sessoes.filter((s) => s.publicadaEm && s.status === 'ativa');
  if (!publicadas.length) return <EstadoVazio titulo="Nenhuma sessão publicada neste mês" texto="Monte a escala e publique na aba Montar." />;

  const nomes = (s: Sessao, papel: 'bolsista' | 'servidor') =>
    dados.escalas
      .filter((e) => e.sessaoId === s.id && e.papel === papel && contaNaEscala(e))
      .map((e) => dados.pessoas.pessoa.get(e.pessoaId)?.nomeCurto ?? '—')
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const vagasDe = (s: Sessao) => nomes(s, 'bolsista').length;

  const porPessoa = dados.ctxBase.pessoas
    .map((p) => ({
      p,
      itens: publicadas
        .filter((s) => dados.escalas.some((e) => e.sessaoId === s.id && e.pessoaId === p.id && contaNaEscala(e)))
        .map((s) => ({ evento: dados.periodo.evento.get(s.eventoId)!, sessao: s })),
    }))
    .filter((x) => x.itens.length);

  return (
    <div className="pilha">
      <div className="linha">
        <Botao onClick={() => setIndividuais(true)}>
          <MessageCircle size={16} aria-hidden /> Mensagens individuais ({porPessoa.length})
        </Botao>
      </div>
      {publicadas.map((s) => {
        const ev = dados.periodo.evento.get(s.eventoId)!;
        const texto = textoWhatsappSessao(ev, s, nomes(s, 'servidor'), nomes(s, 'bolsista'));
        const futura = s.data >= hoje();
        return (
          <Cartao
            key={s.id}
            titulo={
              <div>
                <h2>{tituloSessao(ev, s)}</h2>
                <p className="pequeno texto-2">
                  {dataLonga(s.data)} · {horarioTexto(s)}
                </p>
              </div>
            }
            acoes={
              <>
                <Etiqueta tom={vagasDe(s) >= s.vagasBolsistas ? 'sucesso' : 'aviso'}>
                  {vagasDe(s)}/{s.vagasBolsistas}
                </Etiqueta>
                {s.convocacao && s.convocacao.abertaAte >= agora() && <Etiqueta tom="destaque">Convocação aberta</Etiqueta>}
                {/* troca vale também depois do evento (troca de última hora) */}
                <Botao tamanho="pequeno" onClick={() => setTroca(s)}>
                  Trocar
                </Botao>
                {futura && (
                  <Botao tamanho="pequeno" onClick={() => setConvocacao(s)}>
                    Pedir mais bolsistas
                  </Botao>
                )}
              </>
            }
          >
            <details>
              <summary className="pequeno texto-2" style={{ cursor: 'pointer' }}>
                Equipe: {[...nomes(s, 'servidor'), ...nomes(s, 'bolsista')].join(', ') || '—'} · ver mensagem do WhatsApp
              </summary>
              <div className="pilha-2" style={{ marginTop: 8 }}>
                <pre className="texto-whats">{texto}</pre>
                <BotoesTexto texto={texto} />
              </div>
            </details>
          </Cartao>
        );
      })}
      {troca && <ModalTroca sessao={troca} dados={dados} aoFechar={() => setTroca(null)} />}
      {convocacao && <ModalConvocacao sessao={convocacao} dados={dados} aoFechar={() => setConvocacao(null)} />}
      <Modal aberto={individuais} titulo="Mensagens individuais" aoFechar={() => setIndividuais(false)} largura="grande">
        <div className="pilha">
          {porPessoa.map(({ p, itens }) => {
            const t = textoWhatsappIndividual(p.nomeCurto, itens);
            return (
              <div key={p.id} className="pilha-2">
                <div className="linha-entre">
                  <strong>{p.nome}</strong>
                  <BotoesTexto texto={t} />
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
