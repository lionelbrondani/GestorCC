import { contaNaEscala, ehApoio, NOMES_ATIVIDADE, type Escala, type Sessao } from '@shared';
import { Send, X } from 'lucide-react';
import { useState } from 'react';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Carregando, Cartao, EstadoVazio, Etiqueta } from '../../componentes';
import { dataLonga, horarioTexto, tituloSessao } from '../../util/sessoes';
import { INVALIDAR_ESCALAS, useDadosEscalas } from './dadosEscalas';

type Item = { pessoaId: string; papel: 'bolsista' | 'servidor' };

/** Uma atividade de apoio: quem acompanha (bolsistas fixos e servidores), salvar e publicar ali mesmo. */
function CartaoApoio({ s, dados, escalas }: { s: Sessao; dados: ReturnType<typeof useDadosEscalas>; escalas: Escala[] }) {
  const publicada = !!s.publicadaEm;
  const atuais: Item[] = escalas.map((e) => ({ pessoaId: e.pessoaId, papel: e.papel }));
  const [itens, setItens] = useState<Item[] | null>(null);
  const [escolha, setEscolha] = useState('');
  const [aviso, setAviso] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const salvar = useMutacao('escalas.salvarRascunho', [...INVALIDAR_ESCALAS]);
  const publicar = useMutacao('escalas.publicar', [...INVALIDAR_ESCALAS, 'notificacoes.listar']);
  const lista = itens ?? atuais;
  const alterado = itens !== null;
  const pessoa = (id: string) => dados.pessoas.pessoa.get(id);
  // apoio é com os bolsistas fixos (administração) e os servidores
  const candidatos = dados.pessoas.lista
    .filter((p) => p.ativo && (p.tipo === 'servidor' || p.vinculo === 'fixo') && !lista.some((i) => i.pessoaId === p.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  async function executar(publicarTambem: boolean) {
    setAviso(null);
    try {
      if (alterado || !escalas.length) await salvar.mutateAsync({ sessaoId: s.id, itens: lista.map((i) => ({ ...i, adicaoDireta: false })) });
      if (publicarTambem) await publicar.mutateAsync({ sessaoIds: [s.id] });
      setItens(null);
      setAviso({ tom: 'sucesso', texto: publicarTambem ? 'Escala publicada: quem foi escalado recebe o aviso no app.' : 'Rascunho salvo.' });
    } catch (e) {
      setAviso({ tom: 'erro', texto: (e as Error).message });
    }
  }

  return (
    <Cartao
      titulo={
        <div>
          <span className="linha">
            <Etiqueta tom="destaque">{NOMES_ATIVIDADE[s.atividade!]}</Etiqueta>
            {publicada ? <Etiqueta tom="info">Publicada</Etiqueta> : <Etiqueta tom="aviso">Não publicada</Etiqueta>}
          </span>
          <h2 style={{ marginTop: 6 }}>{tituloSessao(dados.periodo.evento.get(s.eventoId), s)}</h2>
          <p className="pequeno texto-2">
            {dataLonga(s.data)} · {horarioTexto(s)}
          </p>
        </div>
      }
    >
      <div className="ver-equipe">
        {lista.length === 0 && <span className="texto-3 pequeno">Ninguém escalado ainda.</span>}
        {lista.map((i) => (
          <span key={i.pessoaId} className="ver-chip" data-papel={i.papel}>
            {pessoa(i.pessoaId)?.nomeCurto ?? i.pessoaId}
            {!publicada && (
              <button type="button" className="link-botao" aria-label={`Tirar ${pessoa(i.pessoaId)?.nomeCurto}`} onClick={() => setItens(lista.filter((x) => x.pessoaId !== i.pessoaId))}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      {publicada ? (
        <p className="pequeno texto-2" style={{ margin: 0 }}>
          Para mudar alguém, use "Trocar" na aba Publicadas.
        </p>
      ) : (
        <div className="linha" style={{ alignItems: 'flex-end' }}>
          <select className="cc-entrada" aria-label={`Escalar em ${NOMES_ATIVIDADE[s.atividade!]}`} value={escolha} onChange={(e) => setEscolha(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
            <option value="">Escolha quem acompanha…</option>
            {candidatos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} {p.tipo === 'servidor' ? '(servidor)' : '(bolsista fixo)'}
              </option>
            ))}
          </select>
          <Botao
            disabled={!escolha}
            onClick={() => {
              const p = pessoa(escolha);
              if (p) setItens([...lista, { pessoaId: p.id, papel: p.tipo === 'servidor' ? 'servidor' : 'bolsista' }]);
              setEscolha('');
            }}
          >
            Escalar
          </Botao>
          <Botao disabled={!alterado} carregando={salvar.isPending && !publicar.isPending} onClick={() => executar(false)}>
            Salvar rascunho
          </Botao>
          <Botao variante="primario" disabled={!lista.length} carregando={publicar.isPending} onClick={() => executar(true)}>
            <Send size={16} aria-hidden /> Publicar
          </Botao>
        </div>
      )}
      {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}
    </Cartao>
  );
}

/** Escala das atividades de apoio (montagem, passagem de som, desmontagem, ensaio): bolsistas fixos, sem rodada e sem diária. */
export function Apoio({ mes }: { mes: string }) {
  const dados = useDadosEscalas(mes);
  if (dados.carregando) return <Carregando />;
  const sessoes = dados.sessoes.filter((s) => s.status === 'ativa' && ehApoio(s));
  if (!sessoes.length) {
    return (
      <EstadoVazio
        titulo="Nenhuma atividade de apoio neste mês"
        texto="Cadastre montagem, passagem de som ou desmontagem como sessões do evento (Agenda → Editar) ou lance pela ficha técnica do evento."
      />
    );
  }
  return (
    <div className="pilha">
      <Alerta tom="info">
        Atividades de apoio são acompanhadas pelos bolsistas fixos (administração) e servidores. Não entram na rodada de disponibilidade nem pagam diária.
      </Alerta>
      {sessoes.map((s) => (
        <CartaoApoio key={s.id} s={s} dados={dados} escalas={dados.escalas.filter((e) => e.sessaoId === s.id && contaNaEscala(e))} />
      ))}
    </div>
  );
}
