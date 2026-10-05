import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Service worker: keeps the app's files on the phone so RoadFix opens with no signal.
    // Only the app itself is cached — never Supabase data or sign-in requests.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,                       // public/manifest.webmanifest is used as it is
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,svg,ico}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(sitemap\.xml|robots\.txt)$/],
        cleanupOutdatedCaches: true,
        importScripts: ['push-sw.js'],       // phone notifications (public/push-sw.js)
        // Map tiles are not cached: browsers count each one as several MB of storage, which could
        // crowd out reports waiting in the offline outbox. The map is simply blank offline.
      },
    }),
  ],
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
    // Local only: exposing the dev server on the network lets anyone on the same Wi-Fi reach it
    // (and older Vite versions have path-traversal bugs). Run `npm run dev -- --host` when you need a phone test.
    host: 'localhost',
  },
});
