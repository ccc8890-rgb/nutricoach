'use client'

import { Scale } from 'lucide-react'
import { FaseTitulo } from './FaseTitulo'

interface IngredientItem {
    id: string
    nombre: string
    cantidad: string
    /** Fase de la receta (bizcocho, salsa…); sin ella, lista única */
    grupo?: string | null
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
            <ul className="space-y-1">
                {fase.items.map((ing) => (
                    <li key={ing.id}>
                        <div
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-[var(--surface-hover)]"
                        >
                            {/* Nombre + cantidad */}
                            <div className="flex-1 min-w-0 flex items-baseline gap-2">
                                <span
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--text)' }}
                                >
                                    {ing.nombre}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {ing.cantidad}
                                </span>
                            </div>

                            {/* Macros mini */}
                            {ing.kcal !== undefined && (
                                <span className="text-[11px] font-medium tabular-nums flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                    <Scale size={10} />
                                    {Math.round(ing.kcal)} kcal
                                </span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            </div>
            ))}

            {ingredientes.length === 0 && (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    No hay ingredientes registrados
                </p>
            )}
        </div>
    )
}
