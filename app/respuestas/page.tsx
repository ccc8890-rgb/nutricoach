'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import RespuestasClientes from '@/components/RespuestasClientes'
import type { RespuestaCliente } from '@/types'
import { MessageSquareReply } from 'lucide-react'

export default function RespuestasPage() {
    const [respuestas, setRespuestas] = useState<RespuestaCliente[]>([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data } = await supabase
            .from('respuestas_clientes')
            .select('*, cuestionario:cuestionarios(titulo)')
            .eq('coach_id', user.id)
            .order('created_at', { ascending: false })
        setRespuestas(data ?? [])
        setLoading(false)

        const idsNoLeidas = (data ?? [])
            .filter(r => !r.leida)
            .map(r => r.id)

        if (idsNoLeidas.length > 0) {
            await supabase
                .from('respuestas_clientes')
                .update({ leida: true, updated_at: new Date().toISOString() })
                .in('id', idsNoLeidas)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Consultas pendientes</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {loading ? 'Cargando...' : `${respuestas.length} respuesta${respuestas.length !== 1 ? 's' : ''} recibida${respuestas.length !== 1 ? 's' : ''}`}
                </p>
            </header>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card flex items-center gap-4 animate-pulse">
                            <div className="w-11 h-11 rounded-xl skeleton flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 skeleton rounded w-48" />
                                <div className="h-3 skeleton rounded w-32" />
                            </div>
                            <div className="h-6 w-20 skeleton rounded-full" />
                        </div>
                    ))}
                </div>
            ) : (
                <RespuestasClientes
                    respuestas={respuestas as RespuestaCliente[]}
                    onActualizar={() => window.location.reload()}
                />
            )}
        </div>
    )
}
