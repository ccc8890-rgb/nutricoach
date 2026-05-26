const CACHE = 'nutricoach-v5'
const STATIC_ASSETS = [
    '/manifest.json',
    '/icon-192.svg',
    '/icon-512.svg',
    '/limpiar-sw.html',
]

// Rutas de API que queremos cachear para offline parcial
const API_CACHE_ROUTES = [
    '/api/recetas',
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

    // Next.js genera HTML/RSC/chunks que deben revalidarse en cada deploy.
    // Cachearlos aquí puede mezclar módulos nuevos con chunks antiguos y romper
    // imports del cliente ("module factory is not available").
    if (
        pathname.startsWith('/_next/') ||
        pathname.endsWith('.js') ||
        pathname.endsWith('.css') ||
        pathname.endsWith('.map')
    ) {
        event.respondWith(fetch(request))
        return
    }

    // APIs cacheables → cache-first para lectura, network para escritura.
    // /api/alimentos no se cachea: el catálogo cambia por limpieza de BD y debe reflejarse al momento.
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

    // Navegaciones HTML → solo red. Si no hay conexión, mostramos una pantalla mínima
    // en vez de reutilizar HTML viejo incompatible con el build actual.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => new Response(
                    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px;background:#0b0b0f;color:white"><h1>Sin conexión</h1><p>Vuelve a intentarlo cuando tengas internet.</p></body>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                ))
        )
        return
    }

    // Resto de assets (iconos, manifest…) → cache first, network fallback
    event.respondWith(
        caches.match(request).then(cached => {
            const fetchPromise = fetch(request)
                .then(res => {
                    if (res.ok || res.type === 'basic') {
                        const clone = res.clone()
                        caches.open(CACHE).then(cache => cache.put(request, clone))
                    }
                    return res
                })
                .catch(() => cached)
            return cached || fetchPromise
        })
    )
})
