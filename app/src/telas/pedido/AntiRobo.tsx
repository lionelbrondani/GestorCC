import { useEffect, useRef } from 'react';

interface Turnstile {
  render(onde: HTMLElement, opcoes: Record<string, unknown>): string;
}

function carregarTurnstile(): Promise<Turnstile | null> {
  const w = window as unknown as { turnstile?: Turnstile };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  return new Promise((pronto) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => pronto(w.turnstile ?? null);
    script.onerror = () => pronto(null);
    document.head.appendChild(script);
  });
}

/**
 * Cloudflare Turnstile (gratuito): confirma que quem envia não é um robô, quase sempre sem pedir nada à pessoa.
 * Só aparece com VITE_TURNSTILE_SITE_KEY; a API confere o token com a chave secreta (TURNSTILE_SECRET).
 */
export function AntiRobo({ aoToken }: { aoToken: (token: string) => void }) {
  const chave = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const lugar = useRef<HTMLDivElement>(null);
  const callback = useRef(aoToken);
  callback.current = aoToken;

  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    void carregarTurnstile().then((turnstile) => {
      if (cancelado || !turnstile || !lugar.current) return;
      turnstile.render(lugar.current, {
        sitekey: chave,
        language: 'pt-br',
        callback: (token: string) => callback.current(token),
        'expired-callback': () => callback.current(''),
        'error-callback': () => callback.current(''),
      });
    });
    return () => {
      cancelado = true;
    };
  }, [chave]);

  if (!chave) return null;
  return <div ref={lugar} className="pedido-anti-robo" />;
}
