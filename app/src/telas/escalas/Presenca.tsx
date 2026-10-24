import type { Sessao } from '@shared';
import { useState } from 'react';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Carregando, Cartao, EstadoVazio } from '../../componentes';
import { hoje } from '../../util/hoje';
import { dataLonga, tituloSessao } from '../../util/sessoes';
import { INVALIDAR_ESCALAS, useDadosEscalas } from './dadosEscalas';

function CartaoPresenca({ sessao, dados }: { sessao: Sessao; dados: ReturnType<typeof useDadosEscalas> }) {
  const escalados = dados.escalas.filter((e) => e.sessaoId === sessao.id && e.status === 'publicado');
  const [faltaram, setFaltaram] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = useMutacao('escalas.confirmarPresenca', [...INVALIDAR_ESCALAS, 'lotes.listar']);

  return (
    <Cartao
      titulo={
        <div>
          <h2>{tituloSessao(dados.periodo.evento.get(sessao.eventoId), sessao)}</h2>
          <p className="pequeno texto-2">{dataLonga(sessao.data)}</p>
        </div>
      }
    >
      <div className="pilha">
        <p className="pequeno texto-2">Todos estão marcados como presentes. Desmarque só quem faltou.</p>
        <div className="grade-cartoes" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
          {escalados.map((e) => (
            <label key={e.id} className="cc-caixa">
              <input
                type="checkbox"
                checked={!faltaram.has(e.pessoaId)}
                onChange={(ev) => {
                  const n = new Set(faltaram);
                  if (ev.target.checked) n.delete(e.pessoaId);
                  else n.add(e.pessoaId);
                  setFaltaram(n);
                }}
              />
              {dados.pessoas.pessoa.get(e.pessoaId)?.nome ?? e.pessoaId}
              {e.papel === 'servidor' && <span className="pequeno texto-3">(servidor)</span>}
            </label>
          ))}
        </div>
        {erro && <Alerta tom="erro">{erro}</Alerta>}
        <div>
          <Botao
            variante="primario"
            carregando={confirmar.isPending}
            onClick={async () => {
              setErro(null);
              try {
                await confirmar.mutateAsync({ sessaoId: sessao.id, faltaram: [...faltaram] });
              } catch (e) {
                setErro((e as Error).message);
              }
            }}
          >
            Confirmar presença{faltaram.size ? ` (${faltaram.size} falta(s))` : ''}
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

export function Presenca({ mes }: { mes: string }) {
  const dados = useDadosEscalas(mes);
  if (dados.carregando) return <Carregando />;
  const pendentes = dados.sessoes.filter(
    (s) => s.status === 'ativa' && s.data < hoje() && dados.escalas.some((e) => e.sessaoId === s.id && e.status === 'publicado'),
  );
  if (!pendentes.length) return <EstadoVazio titulo="Nenhuma presença pendente neste mês" texto="Depois de cada evento, a sessão aparece aqui para confirmar quem compareceu." />;
  return (
    <div className="pilha">
      {pendentes.map((s) => (
        <CartaoPresenca key={s.id} sessao={s} dados={dados} />
      ))}
    </div>
  );
}
