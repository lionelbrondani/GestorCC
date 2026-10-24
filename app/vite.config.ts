import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)) },
  },
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/teste/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
