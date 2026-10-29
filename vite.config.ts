import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { image: 'public/favicon.svg', preset: 'minimal-2023', overrideManifestIcons: true },
      manifest: {
        name: 'Hessa — Explore the world. Play its games.',
        short_name: 'Hessa',
        description:
          'Pick a country on the map, prop your phone up, and play its games in real life while Hessa referees through the camera.',
        theme_color: '#4D6A6D',
        background_color: '#EAE0CC',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['games', 'entertainment', 'sports'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // The AI runtime and models are large; cache them on first use instead of on install.
        globIgnores: ['mediapipe/**'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/mediapipe/'),
            handler: 'CacheFirst',
            options: { cacheName: 'hessa-ai-models', expiration: { maxEntries: 10 } },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'hessa-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
