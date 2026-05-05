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

export function useNotificaciones(refreshInterval = 30000) {
    const [estado, setEstado] = useState<EstadoNotificaciones>({
        noLeidas: 0,
        total: 0,
        ultimaRespuesta: null,
        cargando: true,
        clientesPendientes: 0,
    })

    const cargar = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setEstado(prev => ({ ...prev, cargando: false }))
                return
            }

            const { data, error } = await supabase
                .from('respuestas_clientes')
                .select('id, leida, created_at')
                .eq('coach_id', user.id)
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
                    .eq('coach_id', user.id)
                    .eq('revisado_por_coach', false)
                if (!pendError && count !== null) {
                    pendientes = count
                }
            } catch {
                // ignore
            }

            setEstado({ noLeidas: noLeidas + pendientes, total, ultimaRespuesta, cargando: false, clientesPendientes: pendientes })
        } catch (error: any) {
            // El error PGRST205 (tabla no existe) es esperado hasta ejecutar el schema SQL
            if (error?.code !== 'PGRST205') {
                console.error('Error cargando notificaciones:', error)
            }
            setEstado(prev => ({ ...prev, cargando: false }))
        }
    }, [])

    // Carga inicial
    useEffect(() => {
        cargar()
    }, [cargar])

    // Polling periódico
    useEffect(() => {
        const interval = setInterval(cargar, refreshInterval)
        return () => clearInterval(interval)
    }, [cargar, refreshInterval])

    // Recalcular cuando la ventana recupera el foco (vuelve de otra pestaña)
    useEffect(() => {
        const onFocus = () => cargar()
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [cargar])

    return estado
}
