import { alertasDaEscala, candidatos, contaNaEscala, estaDisponivel, sessoesDaPessoa, type ContextoEscala, type Pessoa, type Sessao, type TipoAlerta } from '@shared';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Alerta, BarraProgresso, Botao, Campo, Cartao, Etiqueta } from '../../componentes';
import { dataLonga, horarioTexto, tituloSessao } from '../../util/sessoes';
import type { useDadosEscalas } from './dadosEscalas';
import { nivelContagem, type AcoesMontador } from './Montador';

const ALERTA: Record<TipoAlerta, { texto: string; tom: 'erro' | 'aviso' | 'neutro' }> = {
  conflito: { texto: '🔴 Conflito', tom: 'erro' },
  diasSeguidos: { texto: '🟡 Dias seguidos', tom: 'aviso' },
  mesmoDia: { texto: '⚪ Mesmo dia', tom: 'neutro' },
};

function NomePessoa({ p }: { p: Pessoa }) {
  return (
    <span className="pessoa-nome" data-experiente={p.experiente || undefined} title={p.nome}>
      {p.nomeCurto}
      {p.nomeCurto !== p.nome.toUpperCase() && <span className="pequeno texto-3">{p.nome.split(' ').slice(-1)[0]}</span>}
      {p.experiente && <Etiqueta tom="info">experiente</Etiqueta>}
      {p.escalarMenos && <Etiqueta tom="aviso">escalar menos</Etiqueta>}
    </span>
  );
}

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
}) {
  const [mostrarIndisponiveis, setMostrarIndisponiveis] = useState(false);
  const publicada = !!sessao.publicadaEm;
  const escalados = ctx.escalas.filter((e) => e.sessaoId === sessao.id && contaNaEscala(e));
  const bolsistas = escalados.filter((e) => e.papel === 'bolsista');
  const servidores = escalados.filter((e) => e.papel === 'servidor');
  const pessoa = (id: string) => dados.pessoas.pessoa.get(id);
  const naSessao = new Set(escalados.map((e) => e.pessoaId));

  const livresBolsistas = candidatos(sessao, ctx);
  const servidoresLivres = ctx.pessoas.filter((p) => p.tipo === 'servidor' && !naSessao.has(p.id) && estaDisponivel(p.id, sessao.id, ctx));
  const indisponiveis = ctx.pessoas
    .filter((p) => !naSessao.has(p.id) && !estaDisponivel(p.id, sessao.id, ctx))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const alertas = (p: Pessoa) => alertasDaEscala(sessao, sessoesDaPessoa(p.id, ctx, sessao.id));

  const linhaCandidato = (p: Pessoa, indisponivel = false) => (
    <li key={p.id} data-indisponivel={indisponivel || undefined}>
      <span className="linha">
        <NomePessoa p={p} />
        {alertas(p).map((a) => (
          <Etiqueta key={a} tom={ALERTA[a].tom}>
            {ALERTA[a].texto}
          </Etiqueta>
        ))}
      </span>
      <span className="linha">
        <span className="contagem" data-nivel={nivelContagem(contagem.get(p.id) ?? 0)}>
          {contagem.get(p.id) ?? 0}x
        </span>
        <Botao tamanho="pequeno" disabled={publicada} onClick={() => acoes.incluir(sessao, p, p.tipo === 'servidor' ? 'servidor' : 'bolsista')}>
          Incluir
        </Botao>
      </span>
    </li>
  );

  return (
    <div className="pilha">
      <Campo rotulo="Sessão">
        {(id) => (
          <select id={id} className="cc-entrada" value={sessao.id} onChange={(e) => aoEscolherSessao(e.target.value)}>
            {sessoes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.data.slice(8, 10)}/{s.data.slice(5, 7)} · {tituloSessao(dados.periodo.evento.get(s.eventoId), s)}
                {s.publicadaEm ? ' (publicada)' : ''}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <Cartao
        titulo={
          <div>
            <h2>{tituloSessao(dados.periodo.evento.get(sessao.eventoId), sessao)}</h2>
            <p className="pequeno texto-2">
              {dataLonga(sessao.data)} · {horarioTexto(sessao)}
            </p>
          </div>
        }
        acoes={
          !publicada && (
            <>
              <Botao tamanho="pequeno" onClick={aoAutoPreencher}>
                Auto-preencher sessão
              </Botao>
              <Botao tamanho="pequeno" variante="fantasma" onClick={aoLimpar}>
                Limpar
              </Botao>
            </>
          )
        }
      >
        <div className="pilha-2">
          <div className="linha-entre">
            <strong data-testid="progresso-sessao">
              {bolsistas.length} / {sessao.vagasBolsistas}
            </strong>
            <span className="pequeno texto-2">
              bolsistas · mínimo de {sessao.minimoExperientes} experiente(s) · {servidores.length}/{sessao.vagasServidores} servidor(es)
            </span>
          </div>
          <BarraProgresso atual={bolsistas.length} total={sessao.vagasBolsistas} />
          {bolsistas.length >= sessao.vagasBolsistas && sessao.vagasBolsistas > 0 && <span className="salvo">✅ Quantidade necessária atingida</span>}
          {publicada && <Alerta tom="info">Sessão publicada. Para mudar alguém, use "Trocar" na aba Publicadas.</Alerta>}
        </div>
      </Cartao>

      <div className="montador-colunas">
        <Cartao titulo="Escalados">
          <div className="pilha">
            <div>
              <h3 className="pequeno texto-2">SERVIDORES</h3>
              <ul className="lista-pessoas">
                {servidores.length === 0 && <li className="texto-3 pequeno">Nenhum servidor escalado.</li>}
                {servidores.map((e) => (
                  <li key={e.id}>
                    {pessoa(e.pessoaId) && <NomePessoa p={pessoa(e.pessoaId)!} />}
                    {e.status === 'rascunho' && (
                      <Botao tamanho="pequeno" variante="fantasma" aria-label="Remover" onClick={() => acoes.remover(sessao, e.pessoaId)}>
                        <X size={14} />
                      </Botao>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="pequeno texto-2">BOLSISTAS</h3>
              <ul className="lista-pessoas" data-testid="lista-bolsistas">
                {bolsistas.map((e) => {
                  const p = pessoa(e.pessoaId);
                  return (
                    <li key={e.id}>
                      <span className="linha">
                        {p && <NomePessoa p={p} />}
                        {e.adicaoDireta && <Etiqueta tom="aviso">adição direta</Etiqueta>}
                        {p &&
                          alertas(p).map((a) => (
                            <Etiqueta key={a} tom={ALERTA[a].tom}>
                              {ALERTA[a].texto}
                            </Etiqueta>
                          ))}
                      </span>
                      {e.status === 'rascunho' && (
                        <Botao tamanho="pequeno" variante="fantasma" aria-label="Remover" onClick={() => acoes.remover(sessao, e.pessoaId)}>
                          <X size={14} />
                        </Botao>
                      )}
                    </li>
                  );
                })}
              </ul>
              {bolsistas.length === 0 && <p className="texto-3 pequeno">Nenhum bolsista escalado.</p>}
            </div>
          </div>
        </Cartao>

        <Cartao titulo="Disponíveis">
          <div className="pilha">
            <div>
              <h3 className="pequeno texto-2">BOLSISTAS (menos escalados primeiro)</h3>
              <ul className="lista-pessoas">
                {livresBolsistas.length === 0 && <li className="texto-3 pequeno">Ninguém disponível sem conflito.</li>}
                {livresBolsistas.map((p) => linhaCandidato(p))}
              </ul>
            </div>
            <div>
              <h3 className="pequeno texto-2">SERVIDORES</h3>
              <ul className="lista-pessoas">
                {servidoresLivres.length === 0 && <li className="texto-3 pequeno">Nenhum servidor disponível.</li>}
                {servidoresLivres.map((p) => linhaCandidato(p))}
              </ul>
            </div>
            <label className="cc-caixa pequeno">
              <input type="checkbox" checked={mostrarIndisponiveis} onChange={(e) => setMostrarIndisponiveis(e.target.checked)} />
              Mostrar indisponíveis ({indisponiveis.length})
            </label>
            {mostrarIndisponiveis && <ul className="lista-pessoas">{indisponiveis.map((p) => linhaCandidato(p, true))}</ul>}
          </div>
        </Cartao>
      </div>
    </div>
  );
}
