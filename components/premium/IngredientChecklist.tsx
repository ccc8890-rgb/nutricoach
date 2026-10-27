'use client'

import Link from 'next/link'
import { FaseTitulo } from './FaseTitulo'

interface IngredientItem {
    id: string
    nombre: string
    cantidad: string
    /** Fase de la receta (bizcocho, salsa…); sin ella, lista única */
    grupo?: string | null
    /** «Al gusto»: sin cantidad ni kcal, en gris */
    opcional?: boolean
    /** Elaboración enlazada (masa, salsa…): el nombre abre su ficha */
    href?: string
    /** Cantidad estimada por el sistema (el vídeo no la daba): solo se marca en la ficha del coach */
    estimada?: boolean
    kcal?: number
    proteinas?: number
    carbohidratos?: number
    grasas?: number
}

interface IngredientChecklistProps {
    ingredientes: IngredientItem[]
    className?: string
    /** El que lo usa ya pone su propio título (pestaña) */
    sinCabecera?: boolean
}

/**
 * IngredientList — Lista de ingredientes tipo recetario (sin checkeables)
 * Muestra nombre, cantidad y kcal como metadata secundaria
 */
export function IngredientChecklist({ ingredientes, className = '', sinCabecera = false }: IngredientChecklistProps) {
    // Fases en el orden en que aparecen; sin fases (o solo una) la lista queda como siempre
    const fases: { nombre: string | null; items: IngredientItem[] }[] = []
    for (const ing of ingredientes) {
        const nombre = ing.grupo?.trim() || null
        const fase = fases.find(f => f.nombre === nombre)
        if (fase) fase.items.push(ing); else fases.push({ nombre, items: [ing] })
    }
    const conFases = fases.filter(f => f.nombre).length >= 2 || (fases.length >= 2 && fases.some(f => f.nombre))
    return (
        <div className={className}>
            {/* Header */}
            {!sinCabecera && <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                    Ingredientes
                </h2>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {ingredientes.length} {ingredientes.length === 1 ? 'ingrediente' : 'ingredientes'}
                </span>
            </div>}

            {/* Lista de ingredientes */}
            {fases.map((fase, i) => (
            <div key={fase.nombre ?? `f${i}`} className={i > 0 ? 'mt-4' : ''}>
            {conFases && <FaseTitulo nombre={fase.nombre ?? 'Otros'} className="px-3 pb-2" />}
            <ul className="mx-auto w-full max-w-xl">
                {fase.items.map((ing) => (
                    <li key={ing.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-baseline gap-x-4 px-1 py-2.5">
                        {/* Cantidad a la izquierda, alineada como en un libro de recetas */}
                        <span className={`text-right tabular-nums ${ing.opcional ? 'text-sm' : 'text-base font-semibold'}`} style={{ color: ing.opcional ? 'var(--text-muted)' : 'var(--text)' }}>
                            {ing.estimada && <span title="Cantidad estimada por el sistema: el vídeo no la daba" style={{ color: 'var(--warning)' }}>≈ </span>}{ing.opcional ? 'al gusto' : ing.cantidad}
                        </span>
                        <span className="text-lg font-medium leading-snug" style={{ color: ing.opcional ? 'var(--text-muted)' : 'var(--text)' }}>
                            {ing.nombre}{ing.opcional && <span className="ml-2 text-sm font-normal">(opcional)</span>}
                            {ing.href && (
                                <Link href={ing.href} prefetch={false} className="ml-2 align-middle text-[11px] font-normal uppercase tracking-[0.14em] underline decoration-dotted underline-offset-4" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                                    ver preparación
                                </Link>
                            )}
                        </span>
                        {!ing.opcional && ing.kcal !== undefined && (
                            <span className="text-sm tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                {Math.round(ing.kcal)} kcal
                            </span>
                        )}
                    </li>
                ))}
            </ul>
            </div>
            ))}

            {ingredientes.some(i => i.estimada) && (
                <p className="mx-auto mt-3 w-full max-w-xl px-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--warning)' }}>≈</span> cantidad estimada por el sistema (el vídeo no la daba): revísala.
                </p>
            )}

            {ingredientes.length === 0 && (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    No hay ingredientes registrados
                </p>
            )}
        </div>
    )
}
