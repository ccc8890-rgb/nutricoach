'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resumenAptitud } from '@/lib/recetas-constants'
import { repartoKcal } from '@/lib/nutricion/reparto-macros'

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
    intolerancias?: string[] | null
    macro_flex_score?: number | null
    planning_roles?: string[] | null
    digestibilidad?: string | null
    className?: string
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
    intolerancias,
    recipe_intelligence_score,
    className = '',
}: RecipeCardPremiumProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const hasMacros = proteinas > 0 || carbohidratos > 0 || grasas > 0
    const dom = repartoKcal(proteinas, carbohidratos, grasas).dom
    const { aptaPara, contiene } = resumenAptitud(intolerancias)
    const meta = [
        tiempoTotal && tiempoTotal > 0 ? `${tiempoTotal} min` : null,
        porciones && porciones > 0 ? `${porciones} p.` : null,
    ].filter(Boolean).join(' · ')

    return (
        <Link
            href={`/recetas/${id}`}
            className={`coach-recipe-card group relative flex flex-col overflow-hidden ${className}`}
        >
            <div className="coach-recipe-card__media relative min-h-0 overflow-hidden">
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

                {imagen_url && !imgLoaded && (
                    <div className="absolute inset-0 skeleton" />
                )}

                {categoria && (
                    <span
                        className="coach-recipe-card__eyebrow absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate"
                        style={{ color: '#FFFFFF' }}
                    >
                        {categoria}
                    </span>
                )}
            </div>

            <div className="coach-recipe-card__body shrink-0">
                <h3 className="coach-recipe-card__title line-clamp-2">{nombre}</h3>

                {kcal !== null && kcal !== undefined && kcal > 0 && (
                    <div className="coach-recipe-card__kcal">
                        <span className="coach-recipe-card__kcal-num">{Math.round(kcal)}</span>
                        <span className="coach-recipe-card__label">kcal / ración</span>
                    </div>
                )}

                {hasMacros && (
                    <div className="coach-recipe-card__macros">
                        {([['P', proteinas], ['C', carbohidratos], ['G', grasas]] as const).map(([letra, valor], i) => (
                            <span key={letra} data-dom={i === dom ? 'true' : undefined}>
                                {letra} <b>{Math.round(valor)}g</b>
                            </span>
                        ))}
                    </div>
                )}

                {(aptaPara.length > 0 || contiene.length > 0) && (
                    <dl className="coach-recipe-card__apt">
                        {aptaPara.length > 0 && (
                            <div>
                                <dt>Apta</dt>
                                <dd><i style={{ background: 'rgb(34,197,94)' }} aria-hidden />{aptaPara.map(t => <span key={t}>{t}</span>)}</dd>
                            </div>
                        )}
                        {contiene.length > 0 && (
                            <div>
                                <dt>Contiene</dt>
                                <dd><i style={{ background: 'rgb(239,68,68)' }} aria-hidden />{contiene.map(t => <span key={t}>{t}</span>)}</dd>
                            </div>
                        )}
                    </dl>
                )}

                {(meta || recipe_intelligence_score) && (
                    <div className="coach-recipe-card__foot">
                        <span>{meta}</span>
                        {recipe_intelligence_score ? <span>IQ {recipe_intelligence_score}</span> : null}
                    </div>
                )}
            </div>
        </Link>
    )
}
