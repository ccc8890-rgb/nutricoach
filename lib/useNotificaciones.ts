'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

interface EstadoNotificaciones {
    noLeidas: number
    total: number
    ultimaRespuesta: string | null
    cargando: boolean
    clientesPendientes: number
}

const CACHE_TTL_MS = 10000

let cachedUserId: string | null | undefined
let userIdPromise: Promise<string | null> | null = null
let cachedEstado: { value: EstadoNotificaciones; at: number } | null = null
let authListenerReady = false

function resetNotificacionesCache() {
    cachedUserId = undefined
    userIdPromise = null
    cachedEstado = null
}

function installAuthCacheReset() {
    if (authListenerReady || typeof window === 'undefined') return
    authListenerReady = true
    supabase.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            resetNotificacionesCache()
        }
    })
}

async function getCachedUserId() {
    if (cachedUserId !== undefined) return cachedUserId
    if (userIdPromise) return userIdPromise

    userIdPromise = supabase.auth.getUser().then(({ data: { user } }) => {
        cachedUserId = user?.id ?? null
        return cachedUserId
    }).finally(() => {
        userIdPromise = null
    })

    return userIdPromise
}

function getErrorCode(error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        return String((error as { code?: unknown }).code)
    }
    return null
}

export function useNotificaciones(refreshInterval = 30000) {
    const [estado, setEstado] = useState<EstadoNotificaciones>({
        noLeidas: 0,
        total: 0,
        ultimaRespuesta: null,
        cargando: true,
        clientesPendientes: 0,
    })

    const cargar = useCallback(async (force = false) => {
        const now = Date.now()
        if (!force && cachedEstado && now - cachedEstado.at < CACHE_TTL_MS) {
            setEstado(cachedEstado.value)
            return
        }

        try {
            const userId = await getCachedUserId()
            if (!userId) {
                setEstado(prev => ({ ...prev, cargando: false }))
                return
            }

            const { data, error } = await supabase
                .from('respuestas_clientes')
                .select('id, leida, created_at')
                .eq('coach_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error

            const total = data?.length ?? 0
            const noLeidas = data?.filter(r => !r.leida).length ?? 0
            const ultimaRespuesta = data?.[0]?.created_at ?? null

            // Clientes pendientes de revisión
            let pendientes = 0
            try {
                const { count, error: pendError } = await supabase
                    .from('clientes')
                    .select('id', { count: 'exact', head: true })
                    .eq('coach_id', userId)
                    .eq('revisado_por_coach', false)
                if (!pendError && count !== null) {
                    pendientes = count
                }
            } catch {
                // ignore
            }

            const next = { noLeidas: noLeidas + pendientes, total, ultimaRespuesta, cargando: false, clientesPendientes: pendientes }
            cachedEstado = { value: next, at: Date.now() }
            setEstado(next)
        } catch (error: unknown) {
            // El error PGRST205 (tabla no existe) es esperado hasta ejecutar el schema SQL
            if (getErrorCode(error) !== 'PGRST205') {
                console.error('Error cargando notificaciones:', error)
            }
            setEstado(prev => ({ ...prev, cargando: false }))
        }
    }, [])

    // Carga inicial
    useEffect(() => {
        installAuthCacheReset()
        cargar()
    }, [cargar])

    // Polling periódico
    useEffect(() => {
        const interval = setInterval(cargar, refreshInterval)
        return () => clearInterval(interval)
    }, [cargar, refreshInterval])

    // Recalcular cuando la ventana recupera el foco (vuelve de otra pestaña)
    useEffect(() => {
        const onFocus = () => cargar(true)
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [cargar])

    return estado
}
