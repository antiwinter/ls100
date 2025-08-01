import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // Enable PWA in development mode
      },
      manifest: {
        name: 'LS100 - Learn English with Movies',
        short_name: 'LS100',
        description: 'Interactive English learning using movie subtitles',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['education', 'entertainment'],
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,srt,vtt}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/subtitles\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'subtitles-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          },
          {
            urlPattern: /\/api\/shards.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'shards-cache',
              networkTimeoutSeconds: 5
            }
          }
        ]
      }
    })
  ],
})