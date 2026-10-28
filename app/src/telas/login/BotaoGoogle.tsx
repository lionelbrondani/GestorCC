import { useEffect, useRef } from 'react';

/** O pedaço do Google Identity Services que o botão usa. */
interface Gis {
  accounts: {
    id: {
      initialize(opcoes: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }): void;
      renderButton(onde: HTMLElement, opcoes: Record<string, unknown>): void;
    };
  };
}

function carregarGis(): Promise<Gis | null> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return new Promise((pronto) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => pronto(w.google ?? null);
    script.onerror = () => pronto(null); // sem internet ou bloqueado: fica só o login com senha
    document.head.appendChild(script);
  });
}

/**
 * Botão oficial "Fazer login com o Google". Só aparece com VITE_GOOGLE_CLIENT_ID (o ID do cliente OAuth do site);
 * devolve o comprovante assinado pelo Google, que a API confere antes de abrir a sessão.
 */
export function BotaoGoogle({ aoCredencial }: { aoCredencial: (credencial: string) => void }) {
  const clienteId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const lugar = useRef<HTMLDivElement>(null);
  const callback = useRef(aoCredencial);
  callback.current = aoCredencial;

  useEffect(() => {
    if (!clienteId) return;
    let cancelado = false;
    void carregarGis().then((google) => {
      if (cancelado || !google || !lugar.current) return;
      google.accounts.id.initialize({ client_id: clienteId, callback: (r) => callback.current(r.credential), ux_mode: 'popup' });
      google.accounts.id.renderButton(lugar.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR', width: 300 });
    });
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  if (!clienteId) return null;
  return <div ref={lugar} className="login-google" />;
}
