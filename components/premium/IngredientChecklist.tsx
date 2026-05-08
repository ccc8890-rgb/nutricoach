'use client'

import { Scale } from 'lucide-react'

interface IngredientItem {
    id: string
    nombre: string
    cantidad: string
    kcal?: number
    proteinas?: number
    carbohidratos?: number
    grasas?: number
}

interface IngredientChecklistProps {
    ingredientes: IngredientItem[]
    className?: string
}

/**
 * IngredientList — Lista de ingredientes tipo recetario (sin checkeables)
 * Muestra nombre, cantidad y kcal como metadata secundaria
 */
export function IngredientChecklist({ ingredientes, className = '' }: IngredientChecklistProps) {
    return (
        <div className={className}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                    Ingredientes
                </h2>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {ingredientes.length} {ingredientes.length === 1 ? 'ingrediente' : 'ingredientes'}
                </span>
            </div>

            {/* Lista de ingredientes */}
            <ul className="space-y-1">
                {ingredientes.map((ing) => (
                    <li key={ing.id}>
                        <div
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-[var(--surface-hover)]"
                        >
                            {/* Bullet decorativo */}
                            <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: 'var(--accent)' }}
                            />

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

            {ingredientes.length === 0 && (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    No hay ingredientes registrados
                </p>
            )}
        </div>
    )
}
