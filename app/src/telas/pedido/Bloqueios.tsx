import { formatarData, type DataISO } from '@shared';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Alerta, Botao, Campo, Cartao } from '../../componentes';
import { hoje } from '../../util/hoje';
import { CalendarioDatas, limitesDoMes } from './CalendarioDatas';

const periodo = (de: DataISO, ate: DataISO) => (de === ate ? formatarData(de) : `${formatarData(de)} a ${formatarData(ate)}`);

/** Aba Calendário de Pedidos de data: bloquear e desbloquear datas. A página pública avisa, mas ainda deixa pedir. */
export function Bloqueios() {
  const bloqueios = useConsulta('bloqueios.listar', null);
  const salvar = useMutacao('bloqueios.salvar', ['bloqueios.listar', 'pedido.calendario', 'historico.listar']);
  const remover = useMutacao('bloqueios.remover', ['bloqueios.listar', 'pedido.calendario', 'historico.listar']);
  const [mes, setMes] = useState(() => hoje().slice(0, 7));
  const cal = useConsulta('pedido.calendario', limitesDoMes(mes));
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const lista = bloqueios.data ?? [];

  async function executar(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  // um toque começa o período e o seguinte (no mesmo dia ou depois) o termina
  function escolher(d: DataISO) {
    if (!de || ate || d < de) {
      setDe(d);
      setAte('');
    } else setAte(d);
  }

  return (
    <div className="grade-2 pedido-bloqueios">
      <Cartao titulo="Bloquear datas">
        <div className="pilha">
          <p className="pequeno texto-2" style={{ margin: 0 }}>
            A página de pedido mostra o dia como bloqueado e avisa quem pede, mas ainda deixa pedir.
          </p>
          <div className="grade-2">
            <Campo rotulo="De">{(id) => <input id={id} className="cc-entrada" type="date" value={de} onChange={(e) => setDe(e.target.value)} />}</Campo>
            <Campo rotulo="Até">{(id) => <input id={id} className="cc-entrada" type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />}</Campo>
          </div>
          <Campo rotulo="Motivo (só a gestão vê)">
            {(id) => <input id={id} className="cc-entrada" maxLength={200} placeholder="ex.: manutenção, recesso, reservado para a instituição" value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {erro && <Alerta tom="erro">{erro}</Alerta>}
          <div>
            <Botao
              variante="primario"
              carregando={salvar.isPending}
              onClick={() =>
                executar(async () => {
                  await salvar.mutateAsync({ de, ate: ate || de, motivo });
                  setDe('');
                  setAte('');
                  setMotivo('');
                })
              }
            >
              <Lock size={16} aria-hidden /> Bloquear datas
            </Botao>
          </div>
          <h4 style={{ margin: 0 }}>Datas bloqueadas</h4>
          {lista.length ? (
            <ul className="pedido-bloqueios-lista">
              {lista.map((b) => (
                <li key={b.id}>
                  <span>
                    <strong>{periodo(b.de, b.ate)}</strong>
                    {b.motivo && <span className="pequeno texto-2">{b.motivo}</span>}
                  </span>
                  <Botao tamanho="pequeno" carregando={remover.isPending && remover.variables?.id === b.id} onClick={() => executar(() => remover.mutateAsync({ id: b.id }))}>
                    Desbloquear
                  </Botao>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pequeno texto-2" style={{ margin: 0 }}>
              Nenhuma data bloqueada.
            </p>
          )}
        </div>
      </Cartao>
      <Cartao titulo="Calendário">
        <CalendarioDatas
          mes={mes}
          aoMudarMes={setMes}
          ocupados={new Set(cal.data?.ocupados ?? [])}
          bloqueados={new Set(cal.data?.bloqueados ?? [])}
          escolhidos={new Set([de, ate].filter(Boolean))}
          carregando={cal.isLoading}
          aoEscolher={escolher}
        />
        <p className="pequeno texto-2">Toque num dia para começar o período e em outro para terminar.</p>
      </Cartao>
    </div>
  );
}
