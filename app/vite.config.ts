import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-cc.png', 'logo-cc-branco.png', 'logo-cc-escuro.png', 'favicon-32.png', 'favicon-64.png', 'favicon-180.png'],
      manifest: {
        name: 'GestorCC',
        short_name: 'GestorCC',
        description: 'Gestão do Centro de Convenções da UFSM',
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
});
