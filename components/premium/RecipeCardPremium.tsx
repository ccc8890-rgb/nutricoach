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
    premium_chef?: boolean | null
    objetivos?: string[] | null
    estilos?: string[] | null
    className?: string
}

const LABELS: Record<string, string> = {
    perdida_grasa: 'Pérdida grasa',
    recomposicion: 'Recomposición',
    ganancia_muscular: 'Ganancia',
    mantenimiento: 'Mantener',
    rendimiento: 'Rendimiento',
    salud_general: 'Salud',
    chef_healthy: 'Chef healthy',
    comfort_healthy: 'Comfort',
    gourmet_simple: 'Gourmet',
}

/**
 * RecipeCardPremium — Card editorial estilo recetario premium.
 * Imagen protagonista, información en franja inferior para no tapar la foto.
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
    premium_chef,
    objetivos,
    estilos,
    className = '',
}: RecipeCardPremiumProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const hasMacros = proteinas > 0 || carbohidratos > 0 || grasas > 0

    return (
        <Link
            href={`/recetas/${id}`}
            className={`group relative flex flex-col overflow-hidden rounded-2xl ${className}`}
            style={{
                aspectRatio: '3/4',
                background: 'var(--surface)',
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
            <div className="relative flex-1 min-h-0 overflow-hidden">
                {/* Imagen */}
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
                        className="absolute inset-0 flex items-center justify-center text-sm font-black tracking-tight"
                        style={{
                            background: 'linear-gradient(135deg, var(--accent-bg), var(--bg-subtle))',
                            color: 'var(--accent)',
                        }}
                    >
                        CN
                    </div>
                )}

                {/* Skeleton shimmer mientras carga la imagen */}
                {imagen_url && !imgLoaded && (
                    <div className="absolute inset-0 skeleton" />
                )}

                <div
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 42%)',
                    }}
                />

                {/* Categoría pill — esquina superior */}
                {categoria && (
                    <span
                        className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] truncate text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{
                            background: 'rgba(0,0,0,0.36)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            color: '#FFFFFF',
                            border: '1px solid rgba(255,255,255,0.14)',
                        }}
                    >
                        {categoria}
                    </span>
                )}

                {(premium_chef || estilos?.includes('chef_healthy')) && (
                    <span
                        className="absolute right-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                            background: 'rgba(255,255,255,0.88)',
                            color: '#1C1C1E',
                            border: '1px solid rgba(255,255,255,0.34)',
                        }}
                    >
                        Chef healthy
                    </span>
                )}
            </div>

            {/* Info inferior — fuera de la imagen */}
            <div
                className="shrink-0 p-3 sm:p-4"
                style={{
                    borderTop: '1px solid var(--border)',
                    background: 'color-mix(in srgb, var(--surface) 92%, var(--bg) 8%)',
                }}
            >
                <h3
                    className="text-sm sm:text-base font-bold leading-tight mb-2 line-clamp-2"
                    style={{ color: 'var(--text)' }}
                >
                    {nombre}
                </h3>

                {/* Stats row */}
                <div className="flex items-center gap-x-3 gap-y-1 text-[11px] flex-wrap" style={{ color: 'var(--text-muted)' }}>
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
                        <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--text)' }}>
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

                {objetivos && objetivos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {objetivos.slice(0, 2).map(objetivo => (
                            <span
                                key={objetivo}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
                            >
                                {LABELS[objetivo] ?? objetivo}
                            </span>
                        ))}
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
        <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{Math.round(value)}g</span>
            <div
                className="h-1 rounded-full overflow-hidden"
                style={{ width: 24, background: 'var(--surface-hover)' }}
            >
                <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
        </div>
    )
}
