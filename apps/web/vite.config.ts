import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    // El prototipo carga el catálogo completo y Recharts: el chunk principal
    // supera el default de 500 kB sin que eso sea un problema para una demo.
    chunkSizeWarningLimit: 1600,
  },
});
