import { contaNaEscala, type Escala, type Sessao } from '@shared';
import { useState } from 'react';
import { Abas, Campo, Carregando, Cartao, EstadoVazio, Etiqueta, Tabela } from '../../componentes';
import { dataLonga, horarioTexto, tituloSessao } from '../../util/sessoes';
import { useDadosEscalas } from './dadosEscalas';

type Visao = 'evento' | 'pessoa';

/** Ver a escala do mês (ou de uma rodada) sem precisar imprimir: por evento ou por pessoa. */
export function VerEscala({ mes }: { mes: string }) {
  const dados = useDadosEscalas(mes);
  const [rodadaId, setRodadaId] = useState('');
  const [visao, setVisao] = useState<Visao>('evento');
  const [comRascunho, setComRascunho] = useState(true);

  if (dados.carregando) return <Carregando />;
  const rodadasDoMes = dados.rodadas.filter((r) => r.sessaoIds.some((id) => dados.periodo.sessao.has(id)));
  const rodada = rodadasDoMes.find((r) => r.id === rodadaId);
  const sessoes = dados.sessoes.filter((s) => s.status === 'ativa' && (!rodada || rodada.sessaoIds.includes(s.id)));
  const valeEscala = (e: Escala) => contaNaEscala(e) && (comRascunho || e.status !== 'rascunho');
  const daSessao = (s: Sessao) => dados.escalas.filter((e) => e.sessaoId === s.id && valeEscala(e));
  const pessoa = (id: string) => dados.pessoas.pessoa.get(id);
  const titulo = (s: Sessao) => tituloSessao(dados.periodo.evento.get(s.eventoId), s);

  const porDia = new Map<string, Sessao[]>();
  for (const s of sessoes) porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);

  const porPessoa = [...new Set(sessoes.flatMap((s) => daSessao(s).map((e) => e.pessoaId)))]
    .map((id) => ({ p: pessoa(id), sessoes: sessoes.filter((s) => daSessao(s).some((e) => e.pessoaId === id)) }))
    .filter((x) => x.p)
    .sort((a, b) => b.sessoes.length - a.sessoes.length || a.p!.nome.localeCompare(b.p!.nome, 'pt-BR'));

  const chip = (e: Escala) => {
    const p = pessoa(e.pessoaId);
    return (
      <span key={e.id} className="ver-chip" data-papel={e.papel} data-status={e.status} title={p?.nome}>
        {p?.nomeCurto ?? '—'}
        {e.status === 'rascunho' && <small> (rascunho)</small>}
        {e.status === 'faltou' && <small> (faltou)</small>}
      </span>
    );
  };

  return (
    <div className="pilha">
      <div className="linha" style={{ alignItems: 'flex-end' }}>
        <Campo rotulo="Rodada">
          {(id) => (
            <select id={id} className="cc-entrada" value={rodadaId} onChange={(e) => setRodadaId(e.target.value)}>
              <option value="">Todo o mês</option>
              {rodadasDoMes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <label className="cc-caixa">
          <input type="checkbox" checked={comRascunho} onChange={(e) => setComRascunho(e.target.checked)} />
          Mostrar rascunhos
        </label>
      </div>
      <Abas
        abas={[
          { id: 'evento', rotulo: 'Por evento' },
          { id: 'pessoa', rotulo: 'Por pessoa' },
        ]}
        ativa={visao}
        aoMudar={setVisao}
      />

      {!sessoes.length ? (
        <EstadoVazio titulo="Nenhuma sessão aqui" texto="Escolha outro mês ou outra rodada." />
      ) : visao === 'evento' ? (
        [...porDia].map(([dia, lista]) => (
          <Cartao key={dia} titulo={dataLonga(dia)}>
            <ul className="ver-lista">
              {lista.map((s) => {
                const equipe = daSessao(s);
                const bolsistas = equipe.filter((e) => e.papel === 'bolsista');
                return (
                  <li key={s.id}>
                    <div className="linha-entre">
                      <span>
                        <strong>{titulo(s)}</strong> <span className="pequeno texto-2">{horarioTexto(s)}</span>
                      </span>
                      <span className="linha">
                        {s.publicadaEm ? <Etiqueta tom="info">Publicada</Etiqueta> : <Etiqueta tom="aviso">Não publicada</Etiqueta>}
                        <Etiqueta tom={bolsistas.length >= s.vagasBolsistas ? 'sucesso' : 'aviso'}>
                          {bolsistas.length}/{s.vagasBolsistas} bolsistas
                        </Etiqueta>
                      </span>
                    </div>
                    <div className="ver-equipe">
                      {equipe.length ? [...equipe].sort((a, b) => (a.papel === b.papel ? 0 : a.papel === 'servidor' ? -1 : 1)).map(chip) : <span className="texto-3 pequeno">Ninguém escalado ainda.</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        ))
      ) : (
        <Tabela
          colunas={[
            { chave: 'nome', titulo: 'Pessoa', render: (x) => <span className="negrito">{x.p!.nome}</span> },
            { chave: 'qtd', titulo: 'Escalas', alinhar: 'centro', render: (x) => x.sessoes.length },
            {
              chave: 'sessoes',
              titulo: 'Quando',
              render: (x) => <span className="pequeno">{x.sessoes.map((s) => `${s.data.slice(8, 10)}/${s.data.slice(5, 7)} ${titulo(s)}`).join(' · ')}</span>,
            },
          ]}
          linhas={porPessoa}
          chaveLinha={(x) => x.p!.id}
          vazio="Ninguém escalado ainda."
        />
      )}
    </div>
  );
}
