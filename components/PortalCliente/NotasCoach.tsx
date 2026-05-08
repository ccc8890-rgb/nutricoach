'use client'

import { useState, useEffect } from 'react'
import { MessageSquareText, Loader2 } from 'lucide-react'

interface Nota {
    id: string
    mensaje: string
    created_at: string
}

interface NotasCoachProps {
    codigo: string
}

export default function NotasCoach({ codigo }: NotasCoachProps) {
    const [notas, setNotas] = useState<Nota[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/cliente/${codigo}/notas`)
                if (!res.ok) throw new Error('Error')
                const data = await res.json()
                setNotas(data.notas ?? [])
            } catch {
                // Silencioso
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [codigo])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin" style={{ color: '#0D9488' }} />
            </div>
        )
    }

    if (notas.length === 0) {
        return null // No mostrar sección si no hay notas
    }

    return (
        <div className="card !p-4">
            <div className="flex items-center gap-2 mb-3">
                <MessageSquareText size={16} style={{ color: '#0D9488' }} />
                <h3 className="font-semibold text-gray-900 text-sm">Notas de tu coach</h3>
            </div>
            <div className="space-y-3">
                {notas.map(nota => (
                    <div
                        key={nota.id}
                        className="p-3 rounded-lg text-sm"
                        style={{ background: '#F0FDFA', borderLeft: '3px solid #0D9488' }}
                    >
                        <p className="text-gray-800">{nota.mensaje}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            {new Date(nota.created_at).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'long',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
