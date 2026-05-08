const CACHE = 'nutricoach-v1'
const STATIC_ASSETS = [
    '/',
    '/cliente',
    '/manifest.json',
    '/icon-192.svg',
    '/icon-512.svg',
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS))
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Only handle same-origin GET requests
    if (request.method !== 'GET' || url.origin !== self.location.origin) return

    // API requests → network first, fallback to cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then(res => {
                    const clone = res.clone()
                    caches.open(CACHE).then(cache => cache.put(request, clone))
                    return res
                })
                .catch(() => caches.match(request))
        )
        return
    }

    // Static assets / pages → cache first, network fallback
    event.respondWith(
        caches.match(request).then(cached => {
            const fetchPromise = fetch(request).then(res => {
                const clone = res.clone()
                caches.open(CACHE).then(cache => cache.put(request, clone))
                return res
            }).catch(() => cached)
            return cached || fetchPromise
        })
    )
})
