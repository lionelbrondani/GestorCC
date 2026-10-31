import { Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Botao, Carregando, Pagina } from '../../componentes';
import { janela } from '../../util/hoje';
import './placas.css';

/** O nome começa em 60 pt numa linha; se não couber até 40 pt, passa para duas linhas e desce até 18 pt. */
const MAIOR_PT = 60;
const DUAS_LINHAS_PT = 40;
const MENOR_PT = 18;

function NomeNaPlaca({ nome }: { nome: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [ajuste, setAjuste] = useState({ pt: MAIOR_PT, quebra: false });
  useLayoutEffect(() => setAjuste({ pt: MAIOR_PT, quebra: false }), [nome]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)) return;
    if (!ajuste.quebra) setAjuste(ajuste.pt > DUAS_LINHAS_PT ? { pt: ajuste.pt - 2, quebra: false } : { pt: DUAS_LINHAS_PT, quebra: true });
    else if (ajuste.pt > MENOR_PT) setAjuste({ pt: ajuste.pt - 2, quebra: true });
  }, [ajuste, nome]);
  return (
    <span ref={ref} className="placa-nome" style={{ fontSize: `${ajuste.pt}pt`, whiteSpace: ajuste.quebra ? 'normal' : undefined }}>
      {nome.toLocaleUpperCase('pt-BR')}
    </span>
  );
}

/**
 * Placas das portas dos camarins, no modelo do setor: uma por folha A4, com o nome na faixa cinza
 * (os nomes vêm da ficha técnica e podem ser corrigidos antes de imprimir).
 */
export function PlacasCamarins() {
  const { eventoId = '' } = useParams();
  const { de, ate } = janela(400, 400);
  const periodo = usePeriodo(de, ate);
  const ficha = useConsulta('fichas.obter', { eventoId });
  const [nomes, setNomes] = useState<string[] | null>(null);

  useEffect(() => {
    if (nomes || ficha.isLoading) return;
    const d = ficha.data?.dados;
    const daFicha = [...(d?.camarinsIndividuais ?? []), ...(d?.camarinsColetivos ?? [])].map((n) => n.trim()).filter(Boolean);
    setNomes(daFicha.length ? daFicha : ['']);
  }, [ficha.isLoading, ficha.data, nomes]);

  if (periodo.isLoading || !nomes) return <Carregando />;
  const evento = periodo.evento.get(eventoId);
  const mudar = (i: number, nome: string) => setNomes(nomes.map((n, k) => (k === i ? nome : n)));

  return (
    <div className="placas">
      <Pagina
        titulo={`Placas dos camarins${evento ? `: ${evento.nome}` : ''}`}
        subtitulo="Uma placa por folha A4. Confira os nomes, imprima e recorte na borda da placa."
        acoes={
          <>
            <Link to={`/agenda/${eventoId}`} className="cc-botao" data-variante="secundario">
              Voltar
            </Link>
            <Botao variante="primario" onClick={() => window.print()} disabled={!nomes.some((n) => n.trim())}>
              <Printer size={16} aria-hidden /> Imprimir
            </Botao>
          </>
        }
      >
        <div className="placas-nomes nao-imprimir">
          {nomes.map((n, i) => (
            <div key={i} className="linha">
              <input className="cc-entrada" aria-label={`Nome na placa ${i + 1}`} placeholder="Nome do artista ou do grupo" maxLength={60} value={n} onChange={(e) => mudar(i, e.target.value)} />
              <Botao tamanho="pequeno" variante="fantasma" aria-label={`Tirar a placa ${i + 1}`} onClick={() => setNomes(nomes.length > 1 ? nomes.filter((_, k) => k !== i) : [''])}>
                <Trash2 size={14} />
              </Botao>
            </div>
          ))}
          <div>
            <Botao tamanho="pequeno" onClick={() => setNomes([...nomes, ''])}>
              <Plus size={14} aria-hidden /> Adicionar placa
            </Botao>
          </div>
        </div>
        <div className="placas-previa">
          {nomes
            .filter((n) => n.trim())
            .map((n, i) => (
              <div key={i} className="placa-moldura">
                <div className="placa-folha">
                  <div className="placa" role="img" aria-label={`Placa: ${n.trim()}`}>
                    <div className="placa-faixa">
                      <NomeNaPlaca nome={n.trim()} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </Pagina>
    </div>
  );
}
