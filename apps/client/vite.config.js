import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Redirige /api al backend para evitar CORS y URLs absolutas en desarrollo
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
