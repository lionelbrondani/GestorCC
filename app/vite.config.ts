import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, type Plugin } from 'vitest/config';
import { copiarPublicoSetor, defineSetor, lerSetor } from '../scripts/setor.mjs';

/** No build, os arquivos de setor/publico/ (fora do git) substituem os genéricos de public/. */
function publicoDoSetor(): Plugin {
  let saida = '';
  return {
    name: 'publico-do-setor',
    apply: 'build',
    configResolved: (c) => void (saida = resolve(c.root, c.build.outDir)),
    writeBundle: () => copiarPublicoSetor(saida),
  };
}

export default defineConfig(({ command }) => {
  // os dados do setor entram só no build; no protótipo e nos testes vale o exemplo genérico
  const setor = command === 'build' ? lerSetor() : null;
  return {
    plugins: [
      react(),
      publicoDoSetor(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png', 'logo-branco.png', 'logo-escuro.png', 'favicon-32.png', 'favicon-64.png', 'favicon-180.png'],
        manifest: {
          name: 'GestorCC',
          short_name: 'GestorCC',
          description: setor ? `Gestão do ${setor.nomeCompleto}` : 'Gestão de um centro de eventos',
          lang: 'pt-BR',
          theme_color: '#232323',
          background_color: '#F4F4F2',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    define: command === 'build' ? { __SETOR__: defineSetor() } : {},
    resolve: {
      alias: { '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)) },
    },
    // O maior trecho restante é o leitor de câmera (html5-qrcode), carregado só quando usado.
    build: { chunkSizeWarningLimit: 600 },
    server: { fs: { allow: ['..'] } },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['src/teste/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
