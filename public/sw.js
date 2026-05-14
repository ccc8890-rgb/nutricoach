const CACHE = 'nutricoach-v2'
const STATIC_ASSETS = [
    '/',
    '/cliente',
    '/recetas',
    '/login',
    '/manifest.json',
    '/icon-192.svg',
    '/icon-512.svg',
    '/limpiar-sw.html',
]

// Rutas de API que queremos cachear para offline parcial
const API_CACHE_ROUTES = [
    '/api/recetas',
    '/api/alimentos',
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then(cache => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[SW] Error precacheando algunos assets:', err)
            })
        })
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => {
                console.log('[SW] Limpiando cache antigua:', k)
                return caches.delete(k)
            }))
        )
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Solo manejar GETs same-origin
    if (request.method !== 'GET' || url.origin !== self.location.origin) return

    const pathname = url.pathname

    // API de recetas y alimentos → cache-first para lectura, network para escritura
    const esApiCacheable = API_CACHE_ROUTES.some(route => pathname.startsWith(route))
    if (esApiCacheable) {
        event.respondWith(
            caches.match(request).then(cached => {
                const fetchPromise = fetch(request)
                    .then(res => {
                        const clone = res.clone()
                        caches.open(CACHE).then(cache => cache.put(request, clone))
                        return res
                    })
                    .catch(() => cached)
                return cached || fetchPromise
            })
        )
        return
    }

    // Otras API routes → network first, cache fallback
    if (pathname.startsWith('/api/')) {
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

    // Páginas y assets estáticos → cache first, network fallback
    event.respondWith(
        caches.match(request).then(cached => {
            const fetchPromise = fetch(request)
                .then(res => {
                    // Solo cachear respuestas válidas
                    if (res.ok || res.type === 'basic') {
                        const clone = res.clone()
                        caches.open(CACHE).then(cache => cache.put(request, clone))
                    }
                    return res
                })
                .catch(() => {
                    // Si es navegación y no hay cache, mostrar página offline
                    if (request.mode === 'navigate') {
                        return caches.match('/')
                    }
                    return cached
                })
            return cached || fetchPromise
        })
    )
})
