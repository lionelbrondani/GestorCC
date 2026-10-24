import { useSearchParams } from 'react-router-dom';
import { Abas } from '../../componentes';

export type Modelo = 'atualizado' | 'legado';
const CHAVE = 'gestorcc-modelo-impressao';

function lembrado(): Modelo {
  try {
    return localStorage.getItem(CHAVE) === 'legado' ? 'legado' : 'atualizado';
  } catch {
    return 'atualizado';
  }
}

/** Modelo escolhido: o da URL, senão o último usado neste navegador, senão "atualizado". */
export function useModelo(): [Modelo, (m: Modelo) => void] {
  const [params, setParams] = useSearchParams();
  const daUrl = params.get('modelo');
  const modelo: Modelo = daUrl === 'legado' || daUrl === 'atualizado' ? daUrl : lembrado();
  const mudar = (m: Modelo) => {
    try {
      localStorage.setItem(CHAVE, m);
    } catch {
      // sem armazenamento: vale só para esta visita
    }
    const n = new URLSearchParams(params);
    n.set('modelo', m);
    setParams(n, { replace: true });
  };
  return [modelo, mudar];
}

export function SeletorModelo({ modelo, aoMudar }: { modelo: Modelo; aoMudar: (m: Modelo) => void }) {
  return (
    <div className="nao-imprimir">
      <Abas
        abas={[
          { id: 'atualizado', rotulo: 'Atualizado' },
          { id: 'legado', rotulo: 'Legado' },
        ]}
        ativa={modelo}
        aoMudar={aoMudar}
      />
    </div>
  );
}

export function CabecalhoImpresso({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="impresso-cabecalho">
      <div className="impresso-faixa">
        <img src="/logo-cc.png" alt="Centro de Convenções PRE | UFSM" />
      </div>
      <div>
        <h1>{titulo}</h1>
        <p>{subtitulo}</p>
      </div>
    </header>
  );
}
