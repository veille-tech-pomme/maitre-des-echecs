import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'privacy.html'],
      manifest: {
        name: 'Maître des Échecs — Apprendre & progresser',
        short_name: 'Maître Échecs',
        description: 'Apprenez les échecs de zéro jusqu’au niveau expert : leçons interactives, puzzles, IA coach et analyse.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B0C10',
        theme_color: '#0B0C10',
        categories: ['games', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,wasm,txt,webmanifest}'],
        // Hors précache (téléchargés à la demande puis mis en cache) : moteur multi-thread et packs de contenu.
        globIgnores: ['**/engine/stockfish-18-lite.*', '**/packs/**', '**/explorer/**', '**/daily/**', '**/node_modules/**'],
        runtimeCaching: [
          { urlPattern: /\/engine\/stockfish-18-lite\.(js|wasm)$/, handler: 'CacheFirst', options: { cacheName: 'moteur-mt', expiration: { maxEntries: 4 } } },
          { urlPattern: /\/explorer\//, handler: 'CacheFirst', options: { cacheName: 'explorer', expiration: { maxEntries: 1200 } } },
          // Coup du jour : calendrier figé (un fichier par année, immuable une fois publié)
          { urlPattern: /\/daily\/\d{4}\.json$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'daily', expiration: { maxEntries: 6 } } },
          { urlPattern: /\/packs\//, handler: 'CacheFirst', options: { cacheName: 'packs', expiration: { maxEntries: 2000 } } },
        ],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  // En-têtes COOP/COEP → crossOriginIsolated → Stockfish multi-thread (à reproduire sur l'hébergeur de production).
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 120000 }
} as any);
