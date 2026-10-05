import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// COOP/COEP headers are required for SharedArrayBuffer which WebLLM needs
// for multi-threaded WASM inference on Android Chrome.
const securityHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: '/SchoolBuddy/',
  server: {
    headers: securityHeaders,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: securityHeaders,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'SchoolBuddy – AI Learning Assistant',
        short_name: 'SchoolBuddy',
        description: 'AI-powered school learning assistant for parents',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // WebLLM bundles can be large — raise the precache limit to 10 MB.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Use NetworkFirst for JS/CSS so new deployments are never blocked by
        // stale cached chunks (avoids "error loading dynamically imported module").
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'assets-cache', networkTimeoutSeconds: 10 },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
