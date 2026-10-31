import {
  contaNaEscala,
  ehApoio,
  contarNoMes,
  estaDisponivel,
  sugestoesEquilibrio,
  type ContextoEscala,
  type Pessoa,
  type Sessao,
} from '@shared';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { useApi } from '../../api/cliente';
import { useMutacao } from '../../api/hooks';
import { Abas, Alerta, Botao, Carregando, Cartao, EstadoVazio, Modal } from '../../componentes';
import { useQueryClient } from '@tanstack/react-query';
import { dataLonga, tituloSessao } from '../../util/sessoes';
import { INVALIDAR_ESCALAS, useDadosEscalas } from './dadosEscalas';
import { bloqueioInclusao, reduzirMontador } from './estadoMontador';
import { MontadorFoco } from './MontadorFoco';
import { MontadorGrade } from './MontadorGrade';

export function nivelContagem(n: number): number {
  return n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3;
}

export interface AcoesMontador {
  incluir(sessao: Sessao, pessoa: Pessoa, papel: 'bolsista' | 'servidor'): void;
  remover(sessao: Sessao, pessoaId: string): void;
}

export function Montador({ mes, aoPublicar }: { mes: string; aoPublicar: () => void }) {
  const dados = useDadosEscalas(mes);
  const api = useApi();
  const qc = useQueryClient();
  const [estado, despachar] = useReducer(reduzirMontador, { escalas: [], alterado: false, alteradas: [] });
  const [visao, setVisao] = useState<'foco' | 'grade'>('foco');
  const [sessaoId, setSessaoId] = useState<string>('');
  const [aviso, setAviso] = useState<{ tom: 'erro' | 'sucesso' | 'aviso'; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<{ sessao: Sessao; pessoa: Pessoa; papel: 'bolsista' | 'servidor' } | null>(null);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const publicar = useMutacao('escalas.publicar', [...INVALIDAR_ESCALAS, 'notificacoes.listar']);

  useEffect(() => {
    if (!dados.carregando && !estado.alterado) despachar({ tipo: 'carregar', escalas: dados.escalas });
    // recarrega quando o servidor devolve novas escalas e não há edição pendente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.carregando, dados.escalas]);

  // atividades de apoio têm escala própria (aba Apoio)
  const ativas = dados.sessoes.filter((s) => s.status === 'ativa' && !ehApoio(s));
  const editaveis = ativas.filter((s) => !s.publicadaEm);
  useEffect(() => {
    if (!sessaoId && ativas.length) setSessaoId((editaveis[0] ?? ativas[0]).id);
  }, [ativas, editaveis, sessaoId]);

  const ctx: ContextoEscala = useMemo(() => ({ ...dados.ctxBase, escalas: estado.escalas }), [dados.ctxBase, estado.escalas]);
  const contagem = useMemo(() => contarNoMes(estado.escalas, dados.sessoes, mes), [estado.escalas, dados.sessoes, mes]);

  if (dados.carregando) return <Carregando />;
  if (!ativas.length) return <EstadoVazio titulo="Nenhuma sessão neste mês" texto="Cadastre os eventos na Agenda para montar a escala." />;

  const sessao = ativas.find((s) => s.id === sessaoId) ?? ativas[0];

  const acoes: AcoesMontador = {
    incluir(s, pessoa, papel) {
      setAviso(null);
      if (s.publicadaEm) return setAviso({ tom: 'aviso', texto: 'Esta sessão já foi publicada. Use "Trocar" na aba Publicadas.' });
      const bloqueio = bloqueioInclusao(s, pessoa, papel, ctx);
      if (bloqueio === 'papel') return setAviso({ tom: 'erro', texto: 'Servidor só ocupa vaga de servidor, e bolsista só vaga de bolsista.' });
      if (bloqueio === 'conflito') return setAviso({ tom: 'erro', texto: `${pessoa.nomeCurto} já está em outra sessão no mesmo horário.` });
      if (!estaDisponivel(pessoa.id, s.id, ctx)) return setConfirmar({ sessao: s, pessoa, papel });
      despachar({ tipo: 'incluir', sessaoId: s.id, pessoaId: pessoa.id, papel, adicaoDireta: false });
    },
    remover(s, pessoaId) {
      despachar({ tipo: 'remover', sessaoId: s.id, pessoaId });
    },
  };

  async function salvar(): Promise<boolean> {
    setSalvando(true);
    try {
      for (const id of estado.alteradas) {
        const itens = estado.escalas
          .filter((e) => e.sessaoId === id && e.status === 'rascunho')
          .map((e) => ({ pessoaId: e.pessoaId, papel: e.papel, adicaoDireta: e.adicaoDireta }));
        await api.chamar('escalas.salvarRascunho', { sessaoId: id, itens });
      }
      despachar({ tipo: 'salvo' });
      await qc.invalidateQueries({ predicate: (q) => (INVALIDAR_ESCALAS as readonly string[]).includes(q.queryKey[0] as string) });
      setAviso({ tom: 'sucesso', texto: 'Rascunho salvo.' });
      return true;
    } catch (e) {
      setAviso({ tom: 'erro', texto: (e as Error).message });
      return false;
    } finally {
      setSalvando(false);
    }
  }

  const sugestoes = sugestoesAbertas ? sugestoesEquilibrio(editaveis.map((s) => s.id), ctx) : [];
  const nome = (id: string) => dados.pessoas.pessoa.get(id)?.nomeCurto ?? id;
  const comRascunho = editaveis.filter((s) => estado.escalas.some((e) => e.sessaoId === s.id && e.status === 'rascunho'));
  const bolsistasOrdenados = dados.ctxBase.pessoas
    .filter((p) => p.tipo === 'bolsista')
    .sort((a, b) => (contagem.get(a.id) ?? 0) - (contagem.get(b.id) ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <div className="pilha">
      <div className="linha-entre">
        <Abas
          abas={[
            { id: 'foco', rotulo: 'Evento a evento' },
            { id: 'grade', rotulo: 'Grade do mês' },
          ]}
          ativa={visao}
          aoMudar={setVisao}
        />
        <div className="linha">
          <Botao onClick={() => despachar({ tipo: 'autoPreencher', sessaoIds: editaveis.map((s) => s.id), ctx })}>Auto-preencher mês</Botao>
          <Botao onClick={() => setSugestoesAbertas(true)}>Sugestões</Botao>
          <Botao variante="primario" disabled={!estado.alterado} carregando={salvando} onClick={salvar}>
            Salvar rascunho
          </Botao>
          <Botao variante="primario" disabled={!comRascunho.length} onClick={() => setPublicando(true)}>
            Publicar…
          </Botao>
        </div>
      </div>

      {estado.alterado && <Alerta tom="aviso">Há alterações não salvas no rascunho.</Alerta>}
      {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}

      <div className="montador">
        <div className="pilha">
          {visao === 'foco' ? (
            <MontadorFoco
              sessoes={ativas}
              sessao={sessao}
              aoEscolherSessao={setSessaoId}
              dados={dados}
              ctx={ctx}
              contagem={contagem}
              acoes={acoes}
              aoAutoPreencher={() => despachar({ tipo: 'autoPreencher', sessaoIds: [sessao.id], ctx })}
              aoLimpar={() => despachar({ tipo: 'limpar', sessaoId: sessao.id })}
              aoSalvar={async () => (estado.alterado ? salvar() : true)}
              aoPublicar={() => (comRascunho.length ? setPublicando(true) : setAviso({ tom: 'sucesso', texto: 'Tudo revisado. Não há rascunho para publicar.' }))}
            />
          ) : (
            <MontadorGrade sessoes={ativas} dados={dados} ctx={ctx} acoes={acoes} />
          )}
        </div>
        <Cartao titulo="Escalas no mês" className="totais">
          <ul className="lista-pessoas">
            {bolsistasOrdenados.map((p) => (
              <li key={p.id}>
                <span className="pessoa-nome" data-experiente={p.experiente || undefined}>
                  {p.nomeCurto}
                  {p.escalarMenos && <span className="pequeno texto-3">(menos)</span>}
                </span>
                <span className="contagem" data-nivel={nivelContagem(contagem.get(p.id) ?? 0)}>
                  {contagem.get(p.id) ?? 0}x
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>

      <Modal
        aberto={!!confirmar}
        titulo="Escalar pessoa indisponível?"
        aoFechar={() => setConfirmar(null)}
        rodape={
          <>
            <Botao onClick={() => setConfirmar(null)}>Cancelar</Botao>
            <Botao
              variante="primario"
              onClick={() => {
                despachar({ tipo: 'incluir', sessaoId: confirmar!.sessao.id, pessoaId: confirmar!.pessoa.id, papel: confirmar!.papel, adicaoDireta: true });
                setConfirmar(null);
              }}
            >
              Escalar mesmo assim
            </Botao>
          </>
        }
      >
        <p>
          <strong>{confirmar?.pessoa.nome}</strong> marcou indisponível (ou não respondeu) para esta sessão. Escalar mesmo assim? Ficará registrado
          como adição direta.
        </p>
      </Modal>

      <Modal aberto={sugestoesAbertas} titulo="Sugestões de equilíbrio" aoFechar={() => setSugestoesAbertas(false)} largura="grande">
        {sugestoes.length === 0 ? (
          <Alerta tom="sucesso">Tudo equilibrado: não há trocas recomendadas com as disponibilidades atuais.</Alerta>
        ) : (
          <ul className="lista-pessoas">
            {sugestoes.map((s, i) => {
              const sess = dados.periodo.sessao.get(s.sessaoId)!;
              return (
                <li key={i}>
                  <span className="pilha-2" style={{ gap: 2 }}>
                    <strong className="pequeno">
                      {tituloSessao(dados.periodo.evento.get(sess.eventoId), sess)} · {dataLonga(sess.data)}
                    </strong>
                    <span className="pequeno">
                      Tirar <strong>{nome(s.tirar)}</strong> ({contagem.get(s.tirar) ?? 0}x) e colocar <strong>{nome(s.colocar)}</strong> (
                      {contagem.get(s.colocar) ?? 0}x){s.motivo === 'escalarMenos' ? ' · reduz quem deve ser escalado menos' : ''}
                    </span>
                  </span>
                  <Botao tamanho="pequeno" variante="primario" onClick={() => despachar({ tipo: 'aplicarSugestao', sugestao: s })}>
                    Aplicar
                  </Botao>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {publicando && (
        <ModalPublicar
          sessoes={comRascunho}
          rotulo={(s) => `${dataLonga(s.data)} · ${tituloSessao(dados.periodo.evento.get(s.eventoId), s)}`}
          escaladosEm={(s) => estado.escalas.filter((e) => e.sessaoId === s.id && contaNaEscala(e)).length}
          carregando={publicar.isPending || salvando}
          aoFechar={() => setPublicando(false)}
          aoConfirmar={async (ids) => {
            if (estado.alterado && !(await salvar())) return;
            await publicar.mutateAsync({ sessaoIds: ids });
            setPublicando(false);
            aoPublicar();
          }}
        />
      )}
    </div>
  );
}

function ModalPublicar({
  sessoes,
  rotulo,
  escaladosEm,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  sessoes: Sessao[];
  rotulo: (s: Sessao) => string;
  escaladosEm: (s: Sessao) => number;
  carregando: boolean;
  aoFechar: () => void;
  aoConfirmar: (ids: string[]) => Promise<void>;
}) {
  const [marcadas, setMarcadas] = useState(new Set(sessoes.map((s) => s.id)));
  const [erro, setErro] = useState<string | null>(null);
  return (
    <Modal
      aberto
      titulo="Publicar escala"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            carregando={carregando}
            disabled={!marcadas.size}
            onClick={async () => {
              setErro(null);
              try {
                await aoConfirmar([...marcadas]);
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Publicar {marcadas.size} sessão(ões)
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <p className="texto-2">Ao publicar, os escalados passam a ver a escala no app e recebem uma notificação.</p>
        <div className="pilha-2">
          {sessoes.map((s) => (
            <label key={s.id} className="cc-caixa">
              <input
                type="checkbox"
                checked={marcadas.has(s.id)}
                onChange={(e) => {
                  const n = new Set(marcadas);
                  if (e.target.checked) n.add(s.id);
                  else n.delete(s.id);
                  setMarcadas(n);
                }}
              />
              {rotulo(s)} <span className="texto-3 pequeno">({escaladosEm(s)} pessoas)</span>
            </label>
          ))}
        </div>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
      </div>
    </Modal>
  );
}
