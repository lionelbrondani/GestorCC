import { PESOS_SCORE } from '@shared';
import { usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Carregando, Tabela } from '../../componentes';

const p = PESOS_SCORE;

/** Score dos bolsistas nos últimos 6 meses (só a gestão vê): o que mais conta para escalar, depois de quem tem menos escalas. */
export function Score() {
  const q = useConsulta('bolsistas.score', null);
  const pessoas = usePessoas();
  if (q.isLoading || pessoas.isLoading) return <Carregando />;

  return (
    <div className="pilha">
      <p className="pequeno texto-2" style={{ margin: 0 }}>
        Começa em {p.base}. A disponibilidade marcada pelo próprio bolsista nas rodadas soma até {p.disponibilidade}, e a avaliação média soma ou tira até{' '}
        {p.avaliacao * 2}. Cada falta tira {p.falta} e cada troca pedida pelo bolsista tira {p.troca}. Período: os últimos 6 meses. Ao montar a escala, entre
        quem tem o mesmo número de escalas no mês, vem primeiro quem tem o score maior.
      </p>
      <Tabela
        colunas={[
          { chave: 'nome', titulo: 'Bolsista', render: (s) => pessoas.pessoa.get(s.pessoaId)?.nome ?? '—' },
          { chave: 'score', titulo: 'Score', alinhar: 'direita', render: (s) => <strong>{s.score}</strong> },
          { chave: 'escalas', titulo: 'Escalas feitas', alinhar: 'direita', render: (s) => s.escalas },
          { chave: 'faltas', titulo: 'Faltas', alinhar: 'direita', render: (s) => s.faltas },
          { chave: 'trocas', titulo: 'Trocas pedidas', alinhar: 'direita', render: (s) => s.trocas },
          { chave: 'disp', titulo: 'Disponibilidade', alinhar: 'direita', render: (s) => (s.disponibilidade === null ? '—' : `${Math.round(s.disponibilidade * 100)}%`) },
          { chave: 'aval', titulo: 'Avaliação', alinhar: 'direita', render: (s) => (s.avaliacao === null ? '—' : s.avaliacao.toFixed(1).replace('.', ',')) },
        ]}
        linhas={q.data ?? []}
        chaveLinha={(s) => s.pessoaId}
        vazio="Nenhum bolsista ativo."
      />
    </div>
  );
}
