import { errosCortesias, type PessoaCortesia } from '@shared';
import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Botao } from '../../componentes';
import './cortesias.css';

const vazia = (p: PessoaCortesia) => !p.nome.trim() && !p.matricula.trim();

/** Erros por linha da tela (linhas totalmente em branco são ignoradas, como na gravação). */
export function errosDasLinhas(pessoas: PessoaCortesia[], pedirMatricula: boolean) {
  return errosCortesias(pessoas, pedirMatricula).filter((e) => !vazia(pessoas[e.indice]));
}

export const preenchidas = (pessoas: PessoaCortesia[]) => pessoas.filter((p) => !vazia(p));

/** Uma linha por pessoa (nome e, se o destino pede, matrícula), até a quantidade de cortesias. */
export function ListaPessoas({
  pessoas,
  aoMudar,
  quantidade,
  pedirMatricula,
  mostrarErros,
  somenteLeitura,
}: {
  pessoas: PessoaCortesia[];
  aoMudar: (p: PessoaCortesia[]) => void;
  quantidade: number;
  pedirMatricula: boolean;
  mostrarErros: boolean;
  somenteLeitura?: boolean;
}) {
  const linhas = pessoas.length ? pessoas : [{ nome: '', matricula: '' }];
  const erros = mostrarErros ? errosDasLinhas(linhas, pedirMatricula) : [];
  const campos = useRef<(HTMLInputElement | null)[]>([]);
  const [focar, setFocar] = useState<number | null>(null);

  useEffect(() => {
    if (focar === null) return;
    campos.current[focar * 2]?.focus();
    setFocar(null);
  }, [focar]);

  const mudar = (i: number, p: Partial<PessoaCortesia>) => aoMudar(linhas.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const adicionar = () => {
    if (linhas.length >= quantidade) return;
    aoMudar([...linhas, { nome: '', matricula: '' }]);
    setFocar(linhas.length);
  };
  const erroDe = (i: number, campo: 'nome' | 'matricula') => erros.find((e) => e.indice === i && e.campo === campo)?.mensagem;
  const enter = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i === linhas.length - 1) adicionar();
    else setFocar(i + 1);
  };

  return (
    <div className="cortesias-lista" data-matricula={pedirMatricula || undefined}>
      <div className="cortesias-contador" aria-live="polite">
        <span>
          {preenchidas(linhas).length} de {quantidade}
        </span>
      </div>
      <ol>
        {linhas.map((p, i) => (
          <li key={i}>
            <span className="cortesias-num" aria-hidden>
              {i + 1}
            </span>
            <div className="cortesias-campos">
              <div>
                <input
                  ref={(el) => {
                    campos.current[i * 2] = el;
                  }}
                  className="cc-entrada"
                  aria-label={`Nome ${i + 1}`}
                  placeholder="Nome completo"
                  autoComplete="off"
                  value={p.nome}
                  readOnly={somenteLeitura}
                  aria-invalid={!!erroDe(i, 'nome') || undefined}
                  onChange={(e) => mudar(i, { nome: e.target.value })}
                  onKeyDown={pedirMatricula ? undefined : enter(i)}
                />
                {erroDe(i, 'nome') && <span className="cc-campo-erro">{erroDe(i, 'nome')}</span>}
              </div>
              {pedirMatricula && (
                <div>
                  <input
                    ref={(el) => {
                      campos.current[i * 2 + 1] = el;
                    }}
                    className="cc-entrada"
                    aria-label={`Matrícula ${i + 1}`}
                    placeholder="Matrícula"
                    inputMode="numeric"
                    autoComplete="off"
                    value={p.matricula}
                    readOnly={somenteLeitura}
                    aria-invalid={!!erroDe(i, 'matricula') || undefined}
                    onChange={(e) => mudar(i, { matricula: e.target.value })}
                    onKeyDown={enter(i)}
                  />
                  {erroDe(i, 'matricula') && <span className="cc-campo-erro">{erroDe(i, 'matricula')}</span>}
                </div>
              )}
            </div>
            {!somenteLeitura && (linhas.length > 1 || !vazia(p)) && (
              <Botao
                variante="fantasma"
                tamanho="pequeno"
                aria-label={`Remover ${p.nome.trim() || `linha ${i + 1}`}`}
                onClick={() => aoMudar(linhas.length > 1 ? linhas.filter((_, j) => j !== i) : [{ nome: '', matricula: '' }])}
              >
                <X size={16} aria-hidden />
              </Botao>
            )}
          </li>
        ))}
      </ol>
      {!somenteLeitura && linhas.length < quantidade && (
        <Botao onClick={adicionar} style={{ justifySelf: 'start' }}>
          <Plus size={16} aria-hidden /> Adicionar pessoa
        </Botao>
      )}
    </div>
  );
}
