'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Users, Flame } from 'lucide-react'

interface RecipeCardPremiumProps {
    id: string
    nombre: string
    imagen_url?: string | null
    tiempoTotal?: number
    porciones?: number
    kcal?: number | null
    categoria?: string | null
    proteinas?: number
    carbohidratos?: number
    grasas?: number
    className?: string
}

/**
 * RecipeCardPremium — Card full-bleed estilo Mela/Drizzle
 * Imagen como protagonista, overlay gradiente, info sobre la imagen
 * Sin bordes de card, solo sombra sutil
 * Micro-interacción: lift + glow al hover
 */
export function RecipeCardPremium({
    id,
    nombre,
    imagen_url,
    tiempoTotal,
    porciones,
    kcal,
    categoria,
    proteinas = 0,
    carbohidratos = 0,
    grasas = 0,
    className = '',
}: RecipeCardPremiumProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const hasMacros = proteinas > 0 || carbohidratos > 0 || grasas > 0

    return (
        <Link
            href={`/recetas/${id}`}
            className={`group relative block overflow-hidden rounded-2xl ${className}`}
            style={{
                aspectRatio: '3/4',
                boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
                transition: 'box-shadow 0.3s ease, transform 0.25s ease',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25), 0 0 20px var(--accent-glow)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.12)'
            }}
        >
            {/* Imagen full-bleed */}
            {imagen_url ? (
                <img
                    src={imagen_url}
                    alt={nombre}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${imgLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                    onLoad={() => setImgLoaded(true)}
                />
            ) : (
                <div
                    className="absolute inset-0 flex items-center justify-center text-6xl"
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-bg), var(--bg-subtle))',
                    }}
                >
                    🥗
                </div>
            )}

            {/* Skeleton shimmer mientras carga la imagen */}
            {imagen_url && !imgLoaded && (
                <div className="absolute inset-0 skeleton" />
            )}

            {/* Overlay gradiente oscuro de abajo a arriba */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)',
                }}
            />

            {/* Categoría pill — esquina superior */}
            {categoria && (
                <span
                    className="absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    {categoria}
                </span>
            )}

            {/* Info inferior — sobre el overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3
                    className="text-lg font-bold leading-tight text-white mb-2"
                    style={{
                        textShadow: '0 1px 8px rgba(0,0,0,0.3)',
                    }}
                >
                    {nombre}
                </h3>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-[11px] text-white/80 flex-wrap">
                    {tiempoTotal !== undefined && tiempoTotal > 0 && (
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {tiempoTotal} min
                        </span>
                    )}
                    {porciones !== undefined && porciones > 0 && (
                        <span className="flex items-center gap-1">
                            <Users size={12} />
                            {porciones} p.
                        </span>
                    )}
                    {kcal !== null && kcal !== undefined && kcal > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-white">
                            <Flame size={12} />
                            {Math.round(kcal)} kcal/p.
                        </span>
                    )}
                </div>

                {/* Macros por porción — siempre visibles */}
                {hasMacros && (
                    <div className="flex gap-2 mt-1.5">
                        <MacroMini value={proteinas} max={60} color="var(--macro-protein)" label="P" />
                        <MacroMini value={carbohidratos} max={100} color="var(--macro-carbs)" label="C" />
                        <MacroMini value={grasas} max={40} color="var(--macro-fat)" label="G" />
                    </div>
                )}
            </div>
        </Link>
    )
}

/** Mini macro badge — siempre visible, muestra valor en gramos */
function MacroMini({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
    const pct = Math.min((value / max) * 100, 100)
    return (
        <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
            <span className="text-[10px] text-white/80">{Math.round(value)}g</span>
            <div
                className="h-1 rounded-full overflow-hidden"
                style={{ width: 24, background: 'rgba(255,255,255,0.15)' }}
            >
                <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
        </div>
    )
}
