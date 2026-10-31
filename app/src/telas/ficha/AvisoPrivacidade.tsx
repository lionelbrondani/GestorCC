import { ShieldCheck } from 'lucide-react';

/** Rodapé das páginas públicas (ficha técnica e cortesias): para que servem os dados e quando são apagados. */
export function AvisoPrivacidade({ texto }: { texto: string }) {
  return (
    <p className="aviso-privacidade">
      <ShieldCheck size={16} aria-hidden />
      <span>{texto}</span>
    </p>
  );
}
