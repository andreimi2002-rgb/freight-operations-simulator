import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('../../data', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ['../..'] },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
