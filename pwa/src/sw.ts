/// <reference lib="webworker" />

import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>
}

const APP_SHELL_URL = 'index.html'
const OFFLINE_FALLBACK_URL = 'offline.html'
const APP_SHELL_CACHE_NAME = 'one-detailer-app-shell-v1'
const APP_SHELL_SCOPE_URL = self.registration.scope
const APP_SHELL_INDEX_URL = new URL(APP_SHELL_URL, self.registration.scope).toString()
const OFFLINE_FALLBACK_ABSOLUTE_URL = new URL(OFFLINE_FALLBACK_URL, self.registration.scope).toString()
const DEBUG =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1'

function logDebug(event: string, details?: Record<string, unknown>) {
  if (!DEBUG) {
    return
  }

  const payload = {
    type: 'ONE_DETAILER_SW_DEBUG',
    event,
    details: details || {},
    at: new Date().toISOString(),
  }

  console.info('[One Detailer SW]', event, details || {})

  void self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage(payload))
  })
}

function isPwaNavigation(url: URL) {
  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith('/pwa/') &&
    !url.pathname.endsWith('/offline.html')
  )
}

async function populateAppShellCache() {
  const cache = await caches.open(APP_SHELL_CACHE_NAME)
  const shellRequests = [
    APP_SHELL_SCOPE_URL,
    APP_SHELL_INDEX_URL,
    OFFLINE_FALLBACK_ABSOLUTE_URL,
  ]

  for (const url of shellRequests) {
    try {
      const response = await fetch(new Request(url, { cache: 'reload' }))
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      await cache.put(url, response.clone())
      logDebug('app-shell-cached', { url })
    } catch (error) {
      logDebug('app-shell-cache-failed', {
        url,
        error: error instanceof Error ? error.message : String(error || 'unknown'),
      })
    }
  }
}

async function cleanupOldAppShellCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('one-detailer-app-shell-') && cacheName !== APP_SHELL_CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName))
  )
}

async function getCachedAppShellResponse() {
  const cache = await caches.open(APP_SHELL_CACHE_NAME)
  return (
    (await cache.match(APP_SHELL_SCOPE_URL)) ||
    (await cache.match(APP_SHELL_INDEX_URL)) ||
    (await matchPrecache(APP_SHELL_URL)) ||
    null
  )
}

async function getOfflineFallbackResponse() {
  const cache = await caches.open(APP_SHELL_CACHE_NAME)
  return (
    (await cache.match(OFFLINE_FALLBACK_ABSOLUTE_URL)) ||
    (await matchPrecache(OFFLINE_FALLBACK_URL)) ||
    null
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(populateAppShellCache())
  logDebug('installed')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldAppShellCaches()
      await populateAppShellCache()
      await self.clients.claim()
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable()
        } catch {
          // Ignore browsers that reject navigation preload configuration.
        }
      }
      logDebug('activated', {
        scope: self.registration.scope,
      })
    })()
  )
})

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && isPwaNavigation(url),
  async ({ event, request, url }) => {
    logDebug('navigation-intercepted', {
      pathname: url.pathname,
      search: url.search,
    })

    const appShell = await getCachedAppShellResponse()
    if (appShell) {
      logDebug('app-shell-cache-hit', {
        pathname: url.pathname,
      })
      return appShell
    }

    logDebug('app-shell-cache-miss', {
      pathname: url.pathname,
    })

    const preloadResponse = await event.preloadResponse
    if (preloadResponse) {
      logDebug('navigation-preload-used', {
        pathname: url.pathname,
      })
      return preloadResponse
    }

    try {
      const networkResponse = await fetch(request)
      logDebug('navigation-network-response', {
        pathname: url.pathname,
        status: networkResponse.status,
      })
      return networkResponse
    } catch (error) {
      logDebug('offline-fallback-triggered', {
        pathname: url.pathname,
        error: error instanceof Error ? error.message : String(error || 'unknown'),
      })

      const fallback = await getOfflineFallbackResponse()
      if (fallback) {
        return fallback
      }

      return new Response(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>One Detailer Offline</title></head><body><h1>One Detailer is offline</h1><p>Reconnect once to finish loading the app shell.</p></body></html>',
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        }
      )
    }
  }
)

const apiStrategy = new NetworkFirst({
  cacheName: 'one-detailer-api-v1',
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
    new ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 60 * 60 * 24,
    }),
  ],
})

registerRoute(
  ({ url }) =>
    url.pathname.includes('/api/products') || url.pathname.includes('/api/mobile-config'),
  (context) => apiStrategy.handle(context),
  'GET'
)

registerRoute(
  ({ url }) => url.pathname.includes('/api/login-events'),
  new NetworkOnly({
    plugins: [
      new BackgroundSyncPlugin('one-detailer-login-events', {
        maxRetentionTime: 24 * 60,
      }),
    ],
  }),
  'POST'
)

const uploadsStrategy = new CacheFirst({
  cacheName: 'one-detailer-presentation-assets-v1',
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
    new ExpirationPlugin({
      maxEntries: 800,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  ],
})

registerRoute(
  ({ url }) => url.pathname.includes('/uploads/'),
  (context) => uploadsStrategy.handle(context),
  'GET'
)

const imageStrategy = new CacheFirst({
  cacheName: 'one-detailer-media-v1',
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
    new ExpirationPlugin({
      maxEntries: 600,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  ],
})

registerRoute(
  ({ request }) => request.destination === 'image',
  (context) => imageStrategy.handle(context),
  'GET'
)
