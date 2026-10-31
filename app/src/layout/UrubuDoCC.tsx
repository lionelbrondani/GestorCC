/**
 * O mascote do assistente: um urubu desenhado à mão.
 * Desenho próprio: urubu-de-cabeça-preta, de gravatinha amarela, sentado no ninho.
 */
export function UrubuDoCC({ tamanho = 48, titulo }: { tamanho?: number; titulo?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 120 120" role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : true} aria-label={titulo}>
      {/* ninho */}
      <ellipse cx="60" cy="103" rx="44" ry="10" fill="#7a5230" />
      <path d="M18 100 q20 -8 42 -2 q22 -6 42 2" stroke="#a0703f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M22 106 q18 6 38 2 q20 4 38 -2" stroke="#5e3d22" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M14 98 l10 -4 M100 95 l8 4 M30 109 l-8 3 M92 109 l8 2" stroke="#a0703f" strokeWidth="3" strokeLinecap="round" />
      {/* corpo e asa */}
      <ellipse cx="60" cy="76" rx="31" ry="25" fill="#232323" />
      <path d="M36 64 q-14 16 -4 33 q14 -2 22 -14 z" fill="#3b3b3b" />
      <path d="M33 92 l-6 6 M38 95 l-4 7 M44 95 l-1 7" stroke="#e8e6e1" strokeWidth="3" strokeLinecap="round" />
      {/* pescoço com a gola de penas */}
      <ellipse cx="60" cy="54" rx="17" ry="8" fill="#3b3b3b" />
      {/* cabeça cinza, enrugada */}
      <circle cx="58" cy="38" r="16" fill="#8d8d8d" />
      <path d="M46 34 q4 -3 8 0 M47 41 q4 -2 7 0 M52 27 q3 -2 6 0" stroke="#6f6f6f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* olho */}
      <circle cx="63" cy="35" r="5.5" fill="#fff" />
      <circle cx="64.5" cy="35.5" r="3" fill="#232323" />
      <circle cx="65.6" cy="34.2" r="1" fill="#fff" />
      {/* bico em gancho */}
      <path d="M71 37 q13 1 13 11 q-4 -3 -12 -3 q-3 -4 -1 -8 z" fill="#d8cdb0" />
      <circle cx="74" cy="40" r="1" fill="#6f6f6f" />
      {/* gravatinha amarela */}
      <path d="M60 58 l-10 -5 v10 z M60 58 l10 -5 v10 z" fill="#f5c518" stroke="#c99a00" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="60" cy="58" r="2.6" fill="#c99a00" />
    </svg>
  );
}
