'use client'

import { useEffect, useState } from 'react'
import { ChefHat, ExternalLink } from 'lucide-react'

interface RecetaData {
    id: string
    nombre: string
    imagen_url: string | null
    kcal: number
    proteinas: number
    tiempo_prep_min: number | null
}

interface RecetaDelDiaProps {
    kcal: number
    proteinas: number
}

export default function RecetaDelDia({ kcal, proteinas }: RecetaDelDiaProps) {
    const [receta, setReceta] = useState<RecetaData | null>(null)

    useEffect(() => {
        if (kcal <= 0) return
        // Apuntar al rango de una comida principal (~1/3 del día)
        const kcalTarget = Math.round(kcal / 3)
        const protTarget = Math.round(proteinas / 3)
        fetch(`/api/recetas/sugeridas?kcal=${kcalTarget}&proteinas=${protTarget}&limite=1`)
            .then(r => r.json())
            .then(({ recetas }) => { if (recetas?.length) setReceta(recetas[0]) })
            .catch(() => {})
    }, [kcal, proteinas])

    if (!receta) return null

    return (
        <a
            href={`/recetas/${receta.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-2xl border transition-shadow hover:shadow-md no-print"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
            {receta.imagen_url ? (
                <img
                    src={receta.imagen_url}
                    alt={receta.nombre}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                />
            ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--primary-bg)' }}>
                    <ChefHat size={22} style={{ color: 'var(--primary)' }} />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--primary)' }}>
                    Receta del día
                </p>
                <p className="text-sm font-semibold line-clamp-2 leading-tight" style={{ color: 'var(--text)' }}>
                    {receta.nombre}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {receta.kcal} kcal · {receta.proteinas}g P
                    {receta.tiempo_prep_min ? ` · ${receta.tiempo_prep_min} min` : ''}
                </p>
            </div>
            <ExternalLink size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        </a>
    )
}
