import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Botao } from '../../componentes';

/** Os nomes guardados (um por linha), sem linhas vazias. */
export const nomesDaLista = (valor: string) =>
  valor
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);

const MAX_NOMES = 60;

/**
 * Um campo por nome, com "Adicionar nome" (e Enter no último campo abre o próximo). Guarda como texto, um nome por
 * linha, igual ao que a ficha já salvava.
 */
export function ListaNomes({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  const nomes = valor === '' ? [''] : valor.split('\n');
  const campos = useRef<(HTMLInputElement | null)[]>([]);
  const [focar, setFocar] = useState<number | null>(null);

  useEffect(() => {
    if (focar === null) return;
    campos.current[focar]?.focus();
    setFocar(null);
  }, [focar]);

  const mudar = (lista: string[]) => aoMudar(lista.join('\n'));
  const adicionar = () => {
    if (nomes.length >= MAX_NOMES) return;
    mudar([...nomes, '']);
    setFocar(nomes.length);
  };

  return (
    <fieldset className="ficha-pergunta">
      <legend>{rotulo}</legend>
      <ol className="ficha-nomes">
        {nomes.map((n, i) => (
          <li key={i}>
            <span className="ficha-nomes-num" aria-hidden>
              {i + 1}
            </span>
            <input
              ref={(el) => {
                campos.current[i] = el;
              }}
              className="cc-entrada"
              aria-label={`Nome ${i + 1}`}
              placeholder="Nome completo"
              autoComplete="off"
              value={n}
              onChange={(e) => mudar(nomes.map((x, j) => (j === i ? e.target.value.replace(/\n/g, ' ') : x)))}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (i === nomes.length - 1) adicionar();
                else setFocar(i + 1);
              }}
            />
            {(nomes.length > 1 || n) && (
              <Botao
                variante="fantasma"
                tamanho="pequeno"
                aria-label={`Remover ${n.trim() || `nome ${i + 1}`}`}
                onClick={() => mudar(nomes.length > 1 ? nomes.filter((_, j) => j !== i) : [''])}
              >
                <X size={16} aria-hidden />
              </Botao>
            )}
          </li>
        ))}
      </ol>
      {nomes.length < MAX_NOMES && (
        <Botao tamanho="pequeno" onClick={adicionar} style={{ justifySelf: 'start' }}>
          <Plus size={16} aria-hidden /> Adicionar nome
        </Botao>
      )}
    </fieldset>
  );
}
