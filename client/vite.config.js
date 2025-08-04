import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { APP } from './src/config/constants.js'

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
        name: APP.name,
        short_name: APP.short,
        description: APP.desc,
        display: APP.pwa.display,
        orientation: APP.pwa.orientation,
        scope: APP.pwa.scope,
        start_url: APP.pwa.start,
        categories: APP.pwa.categories,
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
  ]
})