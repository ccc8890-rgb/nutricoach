'use client'

import { useState, useEffect } from 'react'

type FotoProgreso = {
    id: string
    fecha: string
    peso: number | null
    signedUrl: string
}

export default function GaleriaFotosProgreso({ codigo }: { codigo: string }) {
    const [fotos, setFotos] = useState<FotoProgreso[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/cliente/${codigo}/fotos-progreso`)
            .then(r => r.json())
            .then(({ fotos }) => setFotos(fotos ?? []))
            .catch(e => console.error('[GaleriaFotosProgreso] Error cargando fotos de progreso:', e))
            .finally(() => setLoading(false))
    }, [codigo])

    if (loading) return null

    if (!fotos.length) return (
        <div className="card mt-4 text-center py-8">
            <p className="text-sm text-gray-400">Aún no has subido fotos de progreso.</p>
            <p className="text-xs text-gray-400 mt-1">Añade una en tu próximo check-in.</p>
        </div>
    )

    return (
        <div className="card mt-4">
            <h2 className="font-semibold text-gray-800 mb-3">📸 Fotos de progreso</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
                {fotos.map(f => (
                    <div key={f.id} className="flex-shrink-0 w-28">
                        <img
                            src={f.signedUrl}
                            alt={`Progreso ${f.fecha}`}
                            className="w-28 h-28 object-cover rounded-xl"
                            loading="lazy"
                        />
                        <p className="text-[10px] text-gray-500 text-center mt-1">
                            {new Date(f.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </p>
                        {f.peso && (
                            <p className="text-[10px] font-semibold text-gray-700 text-center">{f.peso} kg</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
