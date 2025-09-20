import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { attachOssHandler } from './oss'

// Precache will be injected at build time
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

registerRoute(
  ({ url }) => /\/api\/subtitles\/.*/.test(url.pathname),
  new CacheFirst({
    cacheName: 'subtitles-cache'
  })
)

registerRoute(
  ({ url }) => /\/api\/shards.*/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'shards-cache',
    networkTimeoutSeconds: 5
  })
)

attachOssHandler(self)


