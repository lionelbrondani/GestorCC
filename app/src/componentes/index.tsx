import { X } from 'lucide-react';
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Losango } from './Losango';
import './componentes.css';

export { Etiqueta, type TomEtiqueta } from './Etiqueta';
export { Losango } from './Losango';

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';

export function Botao({
  variante = 'secundario',
  tamanho,
  carregando,
  children,
  disabled,
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: 'pequeno'; carregando?: boolean }) {
  return (
    <button
      type={type}
      className="cc-botao"
      data-variante={variante}
      data-tamanho={tamanho}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando && <span className="cc-giro" aria-hidden />}
      {children}
    </button>
  );
}

export function Campo({
  rotulo,
  ajuda,
  erro,
  children,
}: {
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string | null;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="cc-campo">
      <label htmlFor={id}>{rotulo}</label>
      {children(id)}
      {erro ? <span className="cc-campo-erro">{erro}</span> : ajuda ? <span className="cc-campo-ajuda">{ajuda}</span> : null}
    </div>
  );
}

export function Cartao({
  titulo,
  acoes,
  destaque,
  children,
  className,
}: {
  titulo?: ReactNode;
  acoes?: ReactNode;
  destaque?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`cc-cartao ${className ?? ''}`} data-destaque={destaque || undefined}>
      {(titulo || acoes) && (
        <div className="cc-cartao-cabecalho">
          {typeof titulo === 'string' ? <h2>{titulo}</h2> : titulo}
          {acoes && <div className="linha">{acoes}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alerta({ tom = 'info', children }: { tom?: 'info' | 'erro' | 'aviso' | 'sucesso' | 'destaque'; children: ReactNode }) {
  return (
    <div className="cc-alerta" data-tom={tom} role={tom === 'erro' ? 'alert' : 'status'}>
      <div>{children}</div>
    </div>
  );
}

export function Modal({
  aberto,
  titulo,
  aoFechar,
  rodape,
  largura,
  children,
}: {
  aberto: boolean;
  titulo: string;
  aoFechar: () => void;
  rodape?: ReactNode;
  largura?: 'grande';
  children: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="cc-modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="cc-modal" role="dialog" aria-modal="true" aria-label={titulo} data-largura={largura}>
        <div className="cc-modal-cabecalho">
          <h2>{titulo}</h2>
          <Botao variante="fantasma" tamanho="pequeno" onClick={aoFechar} aria-label="Fechar">
            <X size={18} />
          </Botao>
        </div>
        <div className="cc-modal-corpo">{children}</div>
        {rodape && <div className="cc-modal-rodape">{rodape}</div>}
      </div>
    </div>
  );
}

export interface ColunaTabela<T> {
  chave: string;
  titulo: string;
  render?: (linha: T) => ReactNode;
  alinhar?: 'direita' | 'centro';
}

export function Tabela<T>({
  colunas,
  linhas,
  chaveLinha,
  aoClicar,
  vazio,
}: {
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chaveLinha: (l: T) => string;
  aoClicar?: (l: T) => void;
  vazio?: string;
}) {
  const alinhamento = (c: ColunaTabela<T>) => (c.alinhar === 'direita' ? 'right' : c.alinhar === 'centro' ? 'center' : undefined);
  return (
    <div className="cc-tabela-caixa">
      <table className="cc-tabela">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} style={{ textAlign: alinhamento(c) }}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={colunas.length} className="texto-3">
                {vazio ?? 'Nada para mostrar.'}
              </td>
            </tr>
          )}
          {linhas.map((l) => (
            <tr key={chaveLinha(l)} data-clicavel={!!aoClicar || undefined} onClick={aoClicar ? () => aoClicar(l) : undefined}>
              {colunas.map((c) => (
                <td key={c.chave} style={{ textAlign: alinhamento(c) }}>
                  {c.render ? c.render(l) : String((l as Record<string, unknown>)[c.chave] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Abas<T extends string>({
  abas,
  ativa,
  aoMudar,
}: {
  abas: { id: T; rotulo: ReactNode }[];
  ativa: T;
  aoMudar: (id: T) => void;
}) {
  return (
    <div className="cc-abas" role="tablist">
      {abas.map((a) => (
        <button key={a.id} role="tab" aria-selected={a.id === ativa} className="cc-aba" onClick={() => aoMudar(a.id)}>
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}


export function EstadoVazio({ titulo, texto, acao }: { titulo: string; texto?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="cc-vazio">
      <Losango tamanho={44} />
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {acao}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="cc-carregando" role="status">
      <span className="cc-giro" aria-hidden />
      {texto}
    </div>
  );
}

export function Pagina({
  titulo,
  subtitulo,
  acoes,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="cc-pagina">
      <header className="cc-pagina-cabecalho">
        <div>
          <h1>{titulo}</h1>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {acoes && <div className="linha nao-imprimir">{acoes}</div>}
      </header>
      {children}
    </div>
  );
}

export function BarraProgresso({ atual, total }: { atual: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((atual / total) * 100)) : 0;
  return (
    <div className="cc-barra-progresso" data-completa={atual >= total && total > 0} role="progressbar" aria-valuenow={atual} aria-valuemax={total}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
