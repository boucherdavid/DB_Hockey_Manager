const CACHE_NAME = 'hockey-pool-v2'
const STATIC_ASSETS = ['/', '/offline']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = event.request.url

  // Ne pas intercepter les requêtes Supabase, API NHL, admin ou non-GET
  if (
    event.request.method !== 'GET' ||
    url.includes('supabase') ||
    url.includes('nhle.com') ||
    url.includes('/api/') ||
    url.includes('/admin')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).catch(() => caches.match('/offline'))
    })
  )
})
