'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface CacheEntry<T> {
    data: T
    timestamp: number
    promise?: Promise<T>
}

const cache = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL = 30_000 // 30 seconds

/**
 * Hook para fetching con caché en memoria y TTL configurable.
 * Similar a SWR pero liviano, sin dependencias externas.
 *
 * @param key - Clave única para cachear (ej: "clientes-123")
 * @param fetcher - Función async que devuelve los datos
 * @param options.ttl - Tiempo de vida en ms (default: 30000)
 * @param options.enabled - Si es false, no hace fetch (default: true)
 */
export function useCachedFetch<T>(
    key: string | null,
    fetcher: () => Promise<T>,
    options?: { ttl?: number; enabled?: boolean }
) {
    const { ttl = DEFAULT_TTL, enabled = true } = options ?? {}
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const mountedRef = useRef(true)
    const keyRef = useRef(key)

    const execute = useCallback(async () => {
        if (!key || !enabled) {
            setLoading(false)
            return
        }

        const cached = cache.get(key) as CacheEntry<T> | undefined
        const now = Date.now()

        // Si hay caché válida, úsala
        if (cached && now - cached.timestamp < ttl) {
            setData(cached.data)
            setLoading(false)
            setError(null)
            return
        }

        // Si ya hay una petición en curso para esta key, espera
        if (cached?.promise) {
            try {
                const result = await cached.promise
                if (mountedRef.current) {
                    setData(result)
                    setLoading(false)
                    setError(null)
                }
            } catch {
                // fall through to refetch
            }
            return
        }

        setLoading(true)
        setError(null)

        // Crear promesa y cachearla
        const promise = fetcher()
            .then(result => {
                cache.set(key, { data: result, timestamp: Date.now() })
                return result
            })

        // Guardar promesa en curso para deduplicación
        cache.set(key, { ...(cached ?? { data: null as unknown as T, timestamp: 0 }), promise })

        try {
            const result = await promise
            if (mountedRef.current) {
                setData(result)
                setLoading(false)
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Error al cargar datos')
                setLoading(false)
            }
        }
    }, [key, fetcher, ttl, enabled])

    useEffect(() => {
        mountedRef.current = true
        keyRef.current = key
        execute()

        return () => {
            mountedRef.current = false
        }
    }, [execute])

    const invalidateCache = useCallback(() => {
        if (key) cache.delete(key)
        execute()
    }, [key, execute])

    return { data, loading, error, invalidateCache }
}

/**
 * Limpia toda la caché (útil al hacer logout)
 */
export function clearAllCache() {
    cache.clear()
}
