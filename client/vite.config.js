import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { APP } from './src/config/constants.js'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || ''),
    global: 'globalThis' // Polyfill for global
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false // Disable PWA in development mode to prevent blank page
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
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
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
