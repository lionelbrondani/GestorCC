/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_RECURSOS?: string;
  /** ID do cliente OAuth do site (botão "Fazer login com o Google"); sem ele, só login com senha. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Chave pública do Cloudflare Turnstile (página do pedido de data); sem ela, só a armadilha e o limite diário. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
