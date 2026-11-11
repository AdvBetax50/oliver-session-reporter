import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Alias "@/..." -> src/ (convención de shadcn/ui; también en jsconfig.json para el editor)
    alias: { '@': path.resolve(dirname, './src') },
  },
  // Tests de componentes (Vitest + Testing Library) en un DOM simulado
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    restoreMocks: true,
  },
  server: {
    port: 5173,
    // Redirige /api/* al backend (quitando el prefijo) para evitar CORS y URLs absolutas.
    // La API expone las rutas tal como pide el enunciado: /sessions, /health...
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
