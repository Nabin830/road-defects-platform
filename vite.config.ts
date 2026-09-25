import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Big libraries in their own files: they change rarely, so browsers keep them cached between releases
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          supabase: ['@supabase/supabase-js'],
          map: ['leaflet'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
