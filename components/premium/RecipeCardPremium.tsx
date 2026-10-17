'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Users, Fire, Sparkle } from '@phosphor-icons/react'

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
    deportes?: string[] | null
    momentos?: string[] | null
    estilos?: string[] | null
    adherencia_score?: number | null
    recipe_intelligence_score?: number | null
    recipe_intelligence_tier?: string | null
    macro_flex_score?: number | null
    planning_roles?: string[] | null
    digestibilidad?: string | null
    className?: string
}

const LABELS: Record<string, string> = {
    perdida_grasa: 'Pérdida grasa',
    recomposicion: 'Recomposición',
    ganancia_muscular: 'Ganancia',
    mantenimiento: 'Mantener',
    rendimiento: 'Rendimiento',
    running: 'Running',
    hyrox: 'Hyrox',
    endurance: 'Endurance',
    post_entreno: 'Post',
    pre_entreno: 'Pre',
    batch_cooking: 'Batch',
    tupper: 'Tupper',
    chef_healthy: 'Chef healthy',
    comfort_healthy: 'Comfort',
    gourmet_simple: 'Gourmet',
    media_manana: 'Merienda',
    merienda: 'Merienda',
    desayuno: 'Desayuno',
    comida: 'Comida',
    cena: 'Cena',
    snack: 'Snack',
}

const OMITTED_CARD_TAGS = new Set(['salud_general'])

function normaliseTag(value: string) {
    return value.trim().toLocaleLowerCase('es-ES').replace(/[\s_-]+/g, '')
}

function humaniseTag(value: string) {
    const known = LABELS[value]
    if (known) return known

    const readable = value.replace(/[_-]+/g, ' ').trim()
    return readable ? readable.charAt(0).toLocaleUpperCase('es-ES') + readable.slice(1) : ''
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
    deportes,
    momentos,
    estilos,
    adherencia_score,
    recipe_intelligence_score,
    recipe_intelligence_tier,
    macro_flex_score,
    planning_roles,
    className = '',
}: RecipeCardPremiumProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const hasMacros = proteinas > 0 || carbohidratos > 0 || grasas > 0
    const visibleTags = (() => {
        const tags: string[] = []
        const categoryKey = categoria ? normaliseTag(categoria) : ''

        const add = (label: string) => {
            if (!label || normaliseTag(label) === categoryKey) return
            if (!tags.some(existing => normaliseTag(existing) === normaliseTag(label))) tags.push(label)
        }

        ;[...(momentos ?? []), ...(deportes ?? []), ...(objetivos ?? []), ...(estilos ?? [])]
            .filter(item => !OMITTED_CARD_TAGS.has(item))
            .forEach(item => add(humaniseTag(item)))

        if (macro_flex_score !== null && macro_flex_score !== undefined && macro_flex_score >= 75) {
            add('Macros ajustables')
        }
        if (planning_roles?.includes('performance_fuel')) add('Nutrición deportiva')

        return tags.slice(0, 2)
    })()

    return (
        <Link
            href={`/recetas/${id}`}
            className={`coach-recipe-card group relative flex flex-col overflow-hidden ${className}`}
        >
            <div className="coach-recipe-card__media relative min-h-0 overflow-hidden">
                {/* Imagen */}
                {imagen_url ? (
                    <img
                        src={imagen_url}
                        alt={nombre}
                        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.025] ${imgLoaded ? 'opacity-100' : 'opacity-0'
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
                    className="coach-recipe-card__eyebrow absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate"
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
                        className="coach-recipe-card__flag absolute right-3 top-3 max-w-[calc(100%-1.5rem)] truncate"
                        style={{
                            background: 'rgba(255,255,255,0.88)',
                            color: '#1C1C1E',
                            border: '1px solid rgba(255,255,255,0.34)',
                        }}
                    >
                        Chef healthy
                    </span>
                )}

                {adherencia_score !== null && adherencia_score !== undefined && adherencia_score >= 80 && (
                    <span
                        className="coach-recipe-card__score absolute bottom-3 left-3 inline-flex items-center gap-1"
                        style={{
                            background: 'rgba(255,255,255,0.88)',
                            color: '#1C1C1E',
                            border: '1px solid rgba(255,255,255,0.34)',
                        }}
                    >
                        <Sparkle size={11} weight="fill" />
                        {adherencia_score}
                    </span>
                )}

                {recipe_intelligence_score !== null && recipe_intelligence_score !== undefined && recipe_intelligence_score >= 70 && (
                    <span
                        className="coach-recipe-card__iq absolute bottom-3 right-3 inline-flex items-center gap-1"
                        style={{
                            background: recipe_intelligence_tier === 'elite' ? 'rgba(16,185,129,0.92)' : 'rgba(15,23,42,0.78)',
                            color: '#FFFFFF',
                            border: '1px solid rgba(255,255,255,0.22)',
                        }}
                    >
                        IQ {recipe_intelligence_score}
                    </span>
                )}
            </div>

            {/* Info inferior — fuera de la imagen */}
            <div
                className="coach-recipe-card__body shrink-0"
            >
                <h3
                    className="coach-recipe-card__title line-clamp-2"
                    style={{ color: 'var(--text)' }}
                >
                    {nombre}
                </h3>

                {/* Stats row */}
                <div className="coach-recipe-card__meta flex items-center gap-x-3 gap-y-1 flex-wrap">
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
                            <Fire size={12} weight="fill" />
                            {Math.round(kcal)} kcal/p.
                        </span>
                    )}
                </div>

                {/* Macros por porción — siempre visibles */}
                {hasMacros && (
                    <div className="coach-recipe-card__macros">
                        <MacroMini value={proteinas} max={60} color="var(--macro-protein)" label="P" />
                        <MacroMini value={carbohidratos} max={100} color="var(--macro-carbs)" label="C" />
                        <MacroMini value={grasas} max={40} color="var(--macro-fat)" label="G" />
                    </div>
                )}

                {visibleTags.length > 0 && (
                    <div className="coach-recipe-card__tags">
                        {visibleTags.map(item => (
                            <span
                                key={item}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
                            >
                                {item}
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
