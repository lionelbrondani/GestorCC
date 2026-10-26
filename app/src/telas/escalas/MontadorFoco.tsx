import { alertasDaEscala, candidatos, contaNaEscala, diaDaSemana, estaDisponivel, sessoesDaPessoa, type ContextoEscala, type Pessoa, type Sessao, type TipoAlerta } from '@shared';
import { Check, ChevronLeft, ChevronRight, Plus, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { Alerta, Botao } from '../../componentes';
import { horarioTexto, tituloSessao } from '../../util/sessoes';
import type { useDadosEscalas } from './dadosEscalas';
import { nivelContagem, type AcoesMontador } from './Montador';

const ALERTA: Record<TipoAlerta, string> = {
  conflito: '🔴 conflito',
  diasSeguidos: '🟡 dia seguido',
  mesmoDia: '⚪ mesmo dia',
};

type Situacao = 'completo' | 'parcial' | 'vazio' | 'publicada';

/** Completo: vagas de bolsistas e servidores preenchidas e o mínimo de experientes. */
export function situacaoDaSessao(s: Sessao, ctx: ContextoEscala): Situacao {
  if (s.publicadaEm) return 'publicada';
  const escalados = ctx.escalas.filter((e) => e.sessaoId === s.id && contaNaEscala(e));
  if (!escalados.length) return 'vazio';
  const bolsistas = escalados.filter((e) => e.papel === 'bolsista');
  const servidores = escalados.filter((e) => e.papel === 'servidor');
  const experientes = bolsistas.filter((e) => ctx.pessoas.find((p) => p.id === e.pessoaId)?.experiente).length;
  return bolsistas.length >= s.vagasBolsistas && servidores.length >= s.vagasServidores && experientes >= s.minimoExperientes ? 'completo' : 'parcial';
}

/** Um bloco por pessoa: clicar escala (ou tira, se já está na vaga). */
function Bloco({ p, contagem, alertas, aoClicar, desligado, rotulo }: {
  p: Pessoa;
  contagem?: number;
  alertas?: TipoAlerta[];
  aoClicar?: () => void;
  desligado?: boolean;
  rotulo: string;
}) {
  return (
    <button type="button" className="bloco-pessoa" data-experiente={p.experiente || undefined} onClick={aoClicar} disabled={desligado || !aoClicar} aria-label={rotulo} title={p.nome}>
      <span className="bloco-nome">
        {p.experiente && <Star size={14} aria-hidden fill="currentColor" />}
        {p.nomeCurto}
      </span>
      {contagem !== undefined && (
        <span className="contagem" data-nivel={nivelContagem(contagem)}>
          {contagem}x
        </span>
      )}
      {p.escalarMenos && <span className="bloco-alerta">escalar menos</span>}
      {alertas?.map((a) => (
        <span key={a} className="bloco-alerta">
          {ALERTA[a]}
        </span>
      ))}
    </button>
  );
}

/**
 * Escalar evento por evento: um evento por tela, vagas como caixas, pessoas como blocos grandes. "Escalar próximo
 * evento" salva o rascunho e passa para o seguinte. Feito para ser bem visual.
 */
export function MontadorFoco({
  sessoes,
  sessao,
  aoEscolherSessao,
  dados,
  ctx,
  contagem,
  acoes,
  aoAutoPreencher,
  aoLimpar,
  aoSalvar,
  aoPublicar,
}: {
  sessoes: Sessao[];
  sessao: Sessao;
  aoEscolherSessao: (id: string) => void;
  dados: ReturnType<typeof useDadosEscalas>;
  ctx: ContextoEscala;
  contagem: Map<string, number>;
  acoes: AcoesMontador;
  aoAutoPreencher: () => void;
  aoLimpar: () => void;
  /** Salva o rascunho (se houver mudança); false se falhou. */
  aoSalvar: () => Promise<boolean>;
  aoPublicar: () => void;
}) {
  const [mostrarIndisponiveis, setMostrarIndisponiveis] = useState(false);
  const [indo, setIndo] = useState(false);
  const indice = Math.max(0, sessoes.findIndex((s) => s.id === sessao.id));
  const ultima = indice === sessoes.length - 1;
  const publicada = !!sessao.publicadaEm;
  const escalados = ctx.escalas.filter((e) => e.sessaoId === sessao.id && contaNaEscala(e));
  const bolsistas = escalados.filter((e) => e.papel === 'bolsista');
  const servidores = escalados.filter((e) => e.papel === 'servidor');
  const pessoa = (id: string) => dados.pessoas.pessoa.get(id);
  const naSessao = new Set(escalados.map((e) => e.pessoaId));
  const experientes = bolsistas.filter((e) => pessoa(e.pessoaId)?.experiente).length;
  const situacao = situacaoDaSessao(sessao, ctx);
  const completos = sessoes.filter((s) => ['completo', 'publicada'].includes(situacaoDaSessao(s, ctx))).length;

  const livresBolsistas = candidatos(sessao, ctx);
  const servidoresLivres = ctx.pessoas.filter((p) => p.tipo === 'servidor' && !naSessao.has(p.id) && estaDisponivel(p.id, sessao.id, ctx));
  const indisponiveis = ctx.pessoas.filter((p) => !naSessao.has(p.id) && !estaDisponivel(p.id, sessao.id, ctx)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const alertas = (p: Pessoa) => alertasDaEscala(sessao, sessoesDaPessoa(p.id, ctx, sessao.id));
  const evento = dados.periodo.evento.get(sessao.eventoId);
  const faltam: string[] = [];
  if (bolsistas.length < sessao.vagasBolsistas) faltam.push(`${sessao.vagasBolsistas - bolsistas.length} bolsista(s)`);
  if (experientes < sessao.minimoExperientes) faltam.push(`${sessao.minimoExperientes - experientes} experiente(s)`);
  if (servidores.length < sessao.vagasServidores) faltam.push(`${sessao.vagasServidores - servidores.length} servidor(es)`);

  async function irPara(i: number) {
    setIndo(true);
    try {
      if (await aoSalvar()) aoEscolherSessao(sessoes[i].id);
    } finally {
      setIndo(false);
    }
  }

  const vagas = (lista: typeof escalados, total: number, papel: string, testid?: string) => (
    <div className="vagas">
      <ul data-testid={testid} className="vagas-lista">
        {lista.map((e) => {
          const p = pessoa(e.pessoaId);
          if (!p) return null;
          return (
            <li key={e.id}>
              <Bloco
                p={p}
                rotulo={`Tirar ${p.nomeCurto} da vaga`}
                alertas={alertas(p)}
                aoClicar={e.status === 'rascunho' ? () => acoes.remover(sessao, p.id) : undefined}
              />
              {e.adicaoDireta && <span className="bloco-alerta">adição direta</span>}
            </li>
          );
        })}
      </ul>
      {Array.from({ length: Math.max(0, total - lista.length) }, (_, i) => (
        <span key={i} className="vaga-vazia" aria-label={`Vaga de ${papel} livre`}>
          <Plus size={16} aria-hidden />
        </span>
      ))}
    </div>
  );

  return (
    <div className="pilha guiado">
      <nav className="guiado-trilha" aria-label="Eventos do mês">
        <span className="pequeno texto-2">
          Evento {indice + 1} de {sessoes.length} · {completos} completo(s)
        </span>
        <ol>
          {sessoes.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                data-situacao={situacaoDaSessao(s, ctx)}
                aria-current={i === indice ? 'step' : undefined}
                aria-label={`${s.data.slice(8, 10)}/${s.data.slice(5, 7)} · ${tituloSessao(dados.periodo.evento.get(s.eventoId), s)}`}
                title={`${s.data.slice(8, 10)}/${s.data.slice(5, 7)} · ${tituloSessao(dados.periodo.evento.get(s.eventoId), s)}`}
                onClick={() => irPara(i)}
              />
            </li>
          ))}
        </ol>
      </nav>

      <section className="guiado-evento" data-situacao={situacao}>
        <div className="guiado-data">
          <span>{diaDaSemana(sessao.data)}</span>
          <strong>
            {sessao.data.slice(8, 10)}/{sessao.data.slice(5, 7)}
          </strong>
        </div>
        <div className="guiado-info">
          <h2>{tituloSessao(evento, sessao)}</h2>
          <p className="texto-2">{horarioTexto(sessao)}</p>
          <div className="guiado-progresso">
            <strong data-testid="progresso-sessao">
              {bolsistas.length} / {sessao.vagasBolsistas}
            </strong>{' '}
            bolsistas
            {situacao === 'completo' ? (
              <span className="guiado-completo">
                <Check size={16} aria-hidden /> Completo
              </span>
            ) : publicada ? (
              <span className="guiado-completo">Publicada</span>
            ) : (
              faltam.length > 0 && <span className="guiado-falta">Falta: {faltam.join(' · ')}</span>
            )}
          </div>
        </div>
      </section>

      {publicada && <Alerta tom="info">Este evento já foi publicado. Para mudar alguém, use "Trocar" na aba Publicadas.</Alerta>}

      <section className="guiado-bloco">
        <h3>VAGAS DE BOLSISTAS</h3>
        {vagas(bolsistas, sessao.vagasBolsistas, 'bolsista', 'lista-bolsistas')}
        {sessao.vagasServidores > 0 && (
          <>
            <h3>VAGAS DE SERVIDORES</h3>
            {vagas(servidores, sessao.vagasServidores, 'servidor')}
          </>
        )}
      </section>

      {!publicada && (
        <section className="guiado-bloco">
          <div className="linha-entre">
            <h3>DISPONÍVEIS · toque para escalar (menos escalados primeiro)</h3>
            <span className="linha">
              <Botao tamanho="pequeno" onClick={aoAutoPreencher}>
                <Sparkles size={16} aria-hidden /> Auto-preencher este evento
              </Botao>
              <Botao tamanho="pequeno" variante="fantasma" onClick={aoLimpar}>
                Limpar
              </Botao>
            </span>
          </div>
          <div className="blocos">
            {livresBolsistas.length === 0 && <p className="texto-3 pequeno">Nenhum bolsista disponível sem conflito.</p>}
            {livresBolsistas.map((p) => (
              <Bloco key={p.id} p={p} contagem={contagem.get(p.id) ?? 0} alertas={alertas(p)} rotulo={`Escalar ${p.nomeCurto}`} aoClicar={() => acoes.incluir(sessao, p, 'bolsista')} />
            ))}
          </div>
          {servidoresLivres.length > 0 && (
            <>
              <h3>SERVIDORES DISPONÍVEIS</h3>
              <div className="blocos">
                {servidoresLivres.map((p) => (
                  <Bloco key={p.id} p={p} contagem={contagem.get(p.id) ?? 0} rotulo={`Escalar ${p.nomeCurto}`} aoClicar={() => acoes.incluir(sessao, p, 'servidor')} />
                ))}
              </div>
            </>
          )}
          <label className="cc-caixa pequeno">
            <input type="checkbox" checked={mostrarIndisponiveis} onChange={(e) => setMostrarIndisponiveis(e.target.checked)} />
            Mostrar quem não marcou disponível ({indisponiveis.length})
          </label>
          {mostrarIndisponiveis && (
            <div className="blocos blocos-indisponiveis">
              {indisponiveis.map((p) => (
                <Bloco
                  key={p.id}
                  p={p}
                  contagem={contagem.get(p.id) ?? 0}
                  rotulo={`Escalar ${p.nomeCurto} (não marcou disponível)`}
                  aoClicar={() => acoes.incluir(sessao, p, p.tipo === 'servidor' ? 'servidor' : 'bolsista')}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="guiado-rodape">
        <Botao onClick={() => irPara(indice - 1)} disabled={indice === 0 || indo}>
          <ChevronLeft size={18} aria-hidden /> Evento anterior
        </Botao>
        {ultima ? (
          <Botao variante="primario" carregando={indo} onClick={async () => (await aoSalvar()) && aoPublicar()}>
            Revisar e publicar <ChevronRight size={18} aria-hidden />
          </Botao>
        ) : (
          <Botao variante="primario" carregando={indo} onClick={() => irPara(indice + 1)}>
            Escalar próximo evento <ChevronRight size={18} aria-hidden />
          </Botao>
        )}
      </div>
    </div>
  );
}

