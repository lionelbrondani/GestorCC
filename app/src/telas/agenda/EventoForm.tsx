import { TIPOS_EVENTO, validarEvento, type Config, type Evento, type Pessoa, type Sessao, ATIVIDADES, NOMES_ATIVIDADE, type AtividadeSessao } from '@shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alerta, Botao, Campo, Cartao } from '../../componentes';
import { hoje } from '../../util/hoje';
import './agenda.css';

export function sessaoVazia(eventoId: string, config: Config | undefined, data = hoje()): Sessao {
  return {
    id: '', eventoId, data, rotulo: '', chegada: '18:30', inicio: '20:00', fim: '22:00', horarioADefinir: false,
    vagasBolsistas: config?.vagasBolsistasPadrao ?? 8, vagasServidores: config?.vagasServidoresPadrao ?? 1, diaria: null,
    minimoExperientes: config?.minimoExperientesPadrao ?? 1, status: 'ativa', publicadaEm: null, convocacao: null,
  };
}

export function EventoForm({
  evento,
  sessoes,
  servidores,
  config,
  salvando,
  aoSalvar,
  aoCancelar,
}: {
  evento: Evento;
  sessoes: Sessao[];
  servidores: Pessoa[];
  config: Config | undefined;
  salvando: boolean;
  aoSalvar: (e: Evento, s: Sessao[]) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [ev, setEv] = useState(evento);
  const [lista, setLista] = useState<Sessao[]>(sessoes.length ? sessoes : [sessaoVazia(evento.id, config)]);
  const [erro, setErro] = useState<string | null>(null);

  const mudarSessao = (i: number, parcial: Partial<Sessao>) => setLista(lista.map((s, k) => (k === i ? { ...s, ...parcial } : s)));
  const texto = (k: keyof Evento) => ({
    value: (ev[k] as string | number | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setEv({ ...ev, [k]: e.target.value }),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const normalizadas = lista.map((s) =>
      s.horarioADefinir ? { ...s, chegada: null, inicio: null, fim: null } : { ...s, chegada: s.chegada || null, inicio: s.inicio || null, fim: s.fim || null },
    );
    const problema = validarEvento(ev, normalizadas);
    if (problema) return setErro(problema);
    try {
      await aoSalvar(ev, normalizadas);
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <form className="pilha" onSubmit={enviar}>
      <Cartao titulo="Dados do evento">
        <div className="grade-2">
          <Campo rotulo="Nome do evento">{(id) => <input id={id} className="cc-entrada" {...texto('nome')} required />}</Campo>
          <Campo rotulo="Tipo">
            {(id) => (
              <select id={id} className="cc-entrada" {...texto('tipo')}>
                {TIPOS_EVENTO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Organizador / responsável externo">{(id) => <input id={id} className="cc-entrada" {...texto('organizador')} />}</Campo>
          <Campo rotulo="Contato do organizador">{(id) => <input id={id} className="cc-entrada" {...texto('contatoOrganizador')} />}</Campo>
          <Campo rotulo="Servidor responsável (CC)">
            {(id) => (
              <select id={id} className="cc-entrada" {...texto('servidorResponsavelId')}>
                <option value="">—</option>
                {servidores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Instrumento">
            {(id) => (
              <select id={id} className="cc-entrada" {...texto('instrumento')}>
                <option value="contrato">Contrato (externo)</option>
                <option value="termo">Termo de autorização</option>
                <option value="nenhum">Nenhum (evento do CC)</option>
              </select>
            )}
          </Campo>
          <Campo rotulo="Pagamento dos bolsistas">
            {(id) => (
              <select id={id} className="cc-entrada" {...texto('pagamento')}>
                <option value="interno">Interno (CC paga)</option>
                <option value="externo">Externo (outro pagador)</option>
              </select>
            )}
          </Campo>
          {ev.pagamento === 'externo' && (
            <Campo rotulo="Quem paga">{(id) => <input id={id} className="cc-entrada" {...texto('pagadorExterno')} />}</Campo>
          )}
          <Campo rotulo="Público estimado">
            {(id) => (
              <input id={id} className="cc-entrada" type="number" min={0} value={ev.publicoEstimado ?? ''} onChange={(e) => setEv({ ...ev, publicoEstimado: e.target.value ? Number(e.target.value) : undefined })} />
            )}
          </Campo>
          <Campo rotulo="Público real">
            {(id) => (
              <input id={id} className="cc-entrada" type="number" min={0} value={ev.publicoReal ?? ''} onChange={(e) => setEv({ ...ev, publicoReal: e.target.value ? Number(e.target.value) : undefined })} />
            )}
          </Campo>
        </div>
      </Cartao>

      <Cartao
        titulo="Sessões"
        acoes={
          <Botao tamanho="pequeno" onClick={() => setLista([...lista, sessaoVazia(ev.id, config, lista[lista.length - 1]?.data)])}>
            <Plus size={16} aria-hidden /> Adicionar sessão
          </Botao>
        }
      >
        <div className="pilha-2">
          <p className="pequeno texto-2">
            Cada sessão é escalada e paga separadamente (uma diária por sessão). Montagem, passagem de som, desmontagem e ensaio são atividades de apoio: entram na
            agenda, têm escala própria dos bolsistas fixos (aba Apoio, em Escalas) e não pagam diária.
          </p>
          {lista.map((s, i) => (
            <div key={i} className="sessao-editor">
              <Campo rotulo="Atividade">
                {(id) => (
                  <select
                    id={id}
                    className="cc-entrada"
                    value={s.atividade ?? 'evento'}
                    onChange={(e) => {
                      const atividade = e.target.value as AtividadeSessao;
                      // apoio: equipe pequena dos bolsistas fixos, sem diária
                      mudarSessao(i, atividade === 'evento' ? { atividade: undefined } : { atividade, vagasBolsistas: Math.min(s.vagasBolsistas, 2) || 1, vagasServidores: 0, minimoExperientes: 0, diaria: null });
                    }}
                  >
                    {ATIVIDADES.map((a) => (
                      <option key={a} value={a}>
                        {a === 'evento' ? 'Evento (sessão com público)' : NOMES_ATIVIDADE[a]}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Data">{(id) => <input id={id} className="cc-entrada" type="date" value={s.data} onChange={(e) => mudarSessao(i, { data: e.target.value })} />}</Campo>
              <Campo rotulo="Rótulo">{(id) => <input id={id} className="cc-entrada" placeholder="Ex.: Manhã" value={s.rotulo ?? ''} onChange={(e) => mudarSessao(i, { rotulo: e.target.value })} />}</Campo>
              <label className="cc-caixa">
                <input type="checkbox" checked={s.horarioADefinir} onChange={(e) => mudarSessao(i, { horarioADefinir: e.target.checked })} />
                Horário a definir
              </label>
              {!s.horarioADefinir && (
                <>
                  <Campo rotulo="Chegada">{(id) => <input id={id} className="cc-entrada" type="time" value={s.chegada ?? ''} onChange={(e) => mudarSessao(i, { chegada: e.target.value })} />}</Campo>
                  <Campo rotulo="Início">{(id) => <input id={id} className="cc-entrada" type="time" value={s.inicio ?? ''} onChange={(e) => mudarSessao(i, { inicio: e.target.value })} />}</Campo>
                  <Campo rotulo="Fim">{(id) => <input id={id} className="cc-entrada" type="time" value={s.fim ?? ''} onChange={(e) => mudarSessao(i, { fim: e.target.value })} />}</Campo>
                </>
              )}
              <Campo rotulo="Vagas bolsistas">{(id) => <input id={id} className="cc-entrada" type="number" min={0} value={s.vagasBolsistas} onChange={(e) => mudarSessao(i, { vagasBolsistas: Number(e.target.value) })} />}</Campo>
              <Campo rotulo="Vagas servidores">{(id) => <input id={id} className="cc-entrada" type="number" min={0} value={s.vagasServidores} onChange={(e) => mudarSessao(i, { vagasServidores: Number(e.target.value) })} />}</Campo>
              <Campo rotulo="Diária especial (R$)" ajuda="Vazio = valor padrão">
                {(id) => (
                  <input
                    id={id}
                    className="cc-entrada"
                    type="number"
                    min={0}
                    step="0.01"
                    value={s.diaria === null ? '' : s.diaria / 100}
                    onChange={(e) => mudarSessao(i, { diaria: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) })}
                  />
                )}
              </Campo>
              <Botao variante="fantasma" tamanho="pequeno" onClick={() => setLista(lista.filter((_, k) => k !== i))} aria-label="Remover sessão">
                <Trash2 size={16} aria-hidden /> Remover
              </Botao>
            </div>
          ))}
        </div>
      </Cartao>

      {erro && <Alerta tom="erro">{erro}</Alerta>}
      <div className="linha">
        <Botao type="submit" variante="primario" carregando={salvando}>
          Salvar evento
        </Botao>
        <Botao onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  );
}
