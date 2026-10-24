import type { ReactNode } from 'react';

export type TomEtiqueta = 'neutro' | 'sucesso' | 'aviso' | 'erro' | 'destaque' | 'info';

export function Etiqueta({ tom = 'neutro', children, title }: { tom?: TomEtiqueta; children: ReactNode; title?: string }) {
  return (
    <span className="cc-etiqueta" data-tom={tom} title={title}>
      {children}
    </span>
  );
}
