/** Ornamento geométrico da identidade do CC (losangos sobrepostos amarelo e grafite). */
export function Losango({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden focusable="false">
      <rect x="11" y="3" width="18" height="18" transform="rotate(45 20 12)" fill="#232323" />
      <rect x="11" y="17" width="16" height="16" transform="rotate(45 19 25)" fill="#F5C518" />
    </svg>
  );
}
