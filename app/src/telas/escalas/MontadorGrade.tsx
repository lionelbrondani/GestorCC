import { contaNaEscala, diaDaSemanaCurto, estaDisponivel, type ContextoEscala, type Sessao } from '@shared';
import type { useDadosEscalas } from './dadosEscalas';
import type { AcoesMontador } from './Montador';

export function MontadorGrade({
  sessoes,
  dados,
  ctx,
  acoes,
}: {
  sessoes: Sessao[];
  dados: ReturnType<typeof useDadosEscalas>;
  ctx: ContextoEscala;
  acoes: AcoesMontador;
}) {
  const pessoas = [...ctx.pessoas].sort(
    (a, b) => Number(a.tipo === 'bolsista') - Number(b.tipo === 'bolsista') || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
  return (
    <div className="cc-tabela-caixa">
      <table className="grade-escala">
        <thead>
          <tr>
            <th>Pessoa</th>
            {sessoes.map((s) => {
              const ev = dados.periodo.evento.get(s.eventoId);
              return (
                <th key={s.id} title={`${ev?.nome ?? ''} ${s.rotulo ?? ''}`}>
                  <div>
                    {s.data.slice(8, 10)}/{s.data.slice(5, 7)} {diaDaSemanaCurto(s.data)}
                  </div>
                  <div className="pequeno texto-2" style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev?.nome}
                  </div>
                  {s.rotulo && <div className="pequeno texto-3">{s.rotulo}</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pessoas.map((p) => (
            <tr key={p.id}>
              <td className={p.experiente ? 'negrito' : undefined}>
                {p.nomeCurto}
                {p.tipo === 'servidor' && <span className="texto-3 pequeno"> (serv.)</span>}
              </td>
              {sessoes.map((s) => {
                const escala = ctx.escalas.find((e) => e.sessaoId === s.id && e.pessoaId === p.id && contaNaEscala(e));
                const disponivel = estaDisponivel(p.id, s.id, ctx);
                const papel = p.tipo === 'servidor' ? 'servidor' : 'bolsista';
                const estado = escala ? (escala.status === 'rascunho' ? 'escalado' : 'publicado') : disponivel ? 'disponivel' : 'indisponivel';
                const texto = escala ? '✓' : disponivel ? '•' : '—';
                return (
                  <td key={s.id}>
                    <button
                      className="celula"
                      data-estado={estado}
                      disabled={estado === 'publicado' || !!s.publicadaEm}
                      aria-label={`${p.nomeCurto} em ${s.data}: ${estado}`}
                      onClick={() => (escala ? acoes.remover(s, p.id) : acoes.incluir(s, p, papel))}
                    >
                      {texto}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pequeno texto-3" style={{ padding: 8 }}>
        ✓ escalado (preto = rascunho, verde = publicado) · • disponível · — indisponível. Clique para incluir ou retirar.
      </p>
    </div>
  );
}
