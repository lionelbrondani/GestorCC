import type { Avaliacao, Pessoa } from '@shared';
import { useEffect, useState } from 'react';
import { usePessoas } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Carregando } from '../../componentes';

function LinhaAvaliacao({ pessoa, mes, atual }: { pessoa: Pessoa; mes: string; atual?: Avaliacao }) {
  const salvar = useMutacao('avaliacoes.salvar', ['avaliacoes.listar']);
  const [obs, setObs] = useState(atual?.observacao ?? '');
  useEffect(() => setObs(atual?.observacao ?? ''), [atual?.observacao]);
  const nota = atual?.nota ?? 0;
  const gravar = (n: number) => n > 0 && salvar.mutate({ pessoaId: pessoa.id, mes, nota: n as Avaliacao['nota'], observacao: obs });

  return (
    <tr>
      <td className={pessoa.experiente ? 'negrito' : undefined}>{pessoa.nome}</td>
      <td>
        <span className="estrelas" role="radiogroup" aria-label={`Nota de ${pessoa.nome}`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} data-ativa={n <= nota} role="radio" aria-checked={n === nota} aria-label={`${n} estrela(s)`} onClick={() => gravar(n)}>
              ★
            </button>
          ))}
        </span>
      </td>
      <td style={{ minWidth: 220 }}>
        <input
          className="cc-entrada"
          value={obs}
          aria-label={`Observação de ${pessoa.nome}`}
          placeholder={nota ? 'Observação do mês' : 'Dê uma nota para salvar'}
          onChange={(e) => setObs(e.target.value)}
          onBlur={() => obs !== (atual?.observacao ?? '') && gravar(nota)}
        />
      </td>
    </tr>
  );
}

export function Avaliacoes({ mes }: { mes: string }) {
  const pessoas = usePessoas();
  const q = useConsulta('avaliacoes.listar', { mes });
  if (pessoas.isLoading || q.isLoading) return <Carregando />;
  const bolsistas = pessoas.lista.filter((p) => p.tipo === 'bolsista' && p.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return (
    <div className="pilha">
      <p className="texto-2 pequeno">Visível apenas para quem gerencia escalas. A observação é salva ao sair do campo.</p>
      <div className="cc-tabela-caixa">
        <table className="cc-tabela">
          <thead>
            <tr>
              <th>Bolsista</th>
              <th>Nota</th>
              <th>Observações do mês</th>
            </tr>
          </thead>
          <tbody>
            {bolsistas.map((p) => (
              <LinhaAvaliacao key={p.id} pessoa={p} mes={mes} atual={(q.data ?? []).find((a) => a.pessoaId === p.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
