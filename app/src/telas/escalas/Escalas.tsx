import { mesExtenso } from '@shared';
import { Printer } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Abas, Pagina } from '../../componentes';
import { hoje } from '../../util/hoje';
import { Avaliacoes } from './Avaliacoes';
import { Montador } from './Montador';
import { Presenca } from './Presenca';
import { Publicadas } from './Publicadas';
import { Rodadas } from './Rodadas';
import './escalas.css';

type Aba = 'rodadas' | 'montar' | 'publicadas' | 'presenca' | 'avaliacoes';
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'rodadas', rotulo: 'Disponibilidade' },
  { id: 'montar', rotulo: 'Montar' },
  { id: 'publicadas', rotulo: 'Publicadas' },
  { id: 'presenca', rotulo: 'Presença' },
  { id: 'avaliacoes', rotulo: 'Avaliações' },
];

export function Escalas() {
  const [params, setParams] = useSearchParams();
  const aba = (params.get('aba') as Aba) || 'montar';
  const mes = params.get('mes') || hoje().slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const mudar = (k: string, v: string) => {
    const novo = new URLSearchParams(params);
    novo.set(k, v);
    setParams(novo, { replace: true });
  };

  return (
    <Pagina
      titulo="Escalas"
      subtitulo={`${mesExtenso(m).charAt(0)}${mesExtenso(m).slice(1).toLowerCase()} de ${ano}`}
      acoes={
        <>
          <input type="month" className="cc-entrada" style={{ width: 'auto' }} value={mes} onChange={(e) => e.target.value && mudar('mes', e.target.value)} aria-label="Mês" />
          <Link to={`/escalas/imprimir?mes=${mes}`} className="cc-botao" data-variante="secundario">
            <Printer size={16} aria-hidden /> Imprimir escala (formato tradicional)
          </Link>
        </>
      }
    >
      <Abas abas={ABAS} ativa={aba} aoMudar={(a) => mudar('aba', a)} />
      {aba === 'rodadas' && <Rodadas mes={mes} />}
      {aba === 'montar' && <Montador mes={mes} aoPublicar={() => mudar('aba', 'publicadas')} />}
      {aba === 'publicadas' && <Publicadas mes={mes} />}
      {aba === 'presenca' && <Presenca mes={mes} />}
      {aba === 'avaliacoes' && <Avaliacoes mes={mes} />}
    </Pagina>
  );
}
