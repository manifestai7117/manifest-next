const CACHE = 'manifest-v1'
const OFFLINE_PAGES = ['/dashboard', '/']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_PAGES)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/')) return
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)) }
      return res
    }).catch(() => caches.match(e.request).then(cached => {
      if (cached) return cached
      if (e.request.destination === 'document') return caches.match('/dashboard')
      return new Response('Offline', { status: 503 })
    }))
  )
})
