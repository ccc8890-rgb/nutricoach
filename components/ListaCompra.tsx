'use client'

import { useState } from 'react'
import { ShoppingCart, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { generarListaCompra, type GrupoListaCompra } from '@/lib/utils'

const CATEGORIA_EMOJIS: Record<string, string> = {
    'Verduras': '🥦',
    'Hortalizas': '🥬',
    'Frutas': '🍎',
    'Carnes': '🥩',
    'Pescados': '🐟',
    'Mariscos': '🦐',
    'Huevos': '🥚',
    'Lácteos': '🥛',
    'Lacteos': '🥛',
    'Legumbres': '🫘',
    'Cereales': '🌾',
    'Frutos secos': '🥜',
    'Semillas': '🌰',
    'Aceites': '🫒',
    'Grasas': '🫒',
    'Especias': '🌶️',
    'Condimentos': '🧂',
    'Salsas': '🥫',
    'Bebidas': '🧃',
    'Infusiones': '🍵',
    'Suplementos': '💊',
    'Congelados': '❄️',
    'Conservas': '🥫',
    'Pan': '🍞',
    'Pastas': '🍝',
    'Arroces': '🍚',
    'Otros': '📦',
}

function emojiCategoria(cat: string): string {
    return CATEGORIA_EMOJIS[cat] ?? CATEGORIA_EMOJIS[cat.toLowerCase()] ?? '📦'
}

interface ListaCompraProps {
    comidas: { alimentos?: { alimento?: { id?: string; nombre?: string; categoria?: string }; cantidad_gramos?: number }[] }[]
    /** Opcional: nombre del plan para mostrar en el encabezado */
    nombrePlan?: string
}

export default function ListaCompra({ comidas, nombrePlan }: ListaCompraProps) {
    const [abierto, setAbierto] = useState(false)
    const [copiado, setCopiado] = useState(false)
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})

    function grupos(): GrupoListaCompra[] {
        return generarListaCompra(comidas)
    }

    const toggleCategoria = (cat: string) => {
        setExpandidas(prev => ({ ...prev, [cat]: !prev[cat] }))
    }

    const copiarLista = async () => {
        const gs = grupos()
        const lineas: string[] = [`🛒 LISTA DE LA COMPRA${nombrePlan ? ` — ${nombrePlan}` : ''}`]
        for (const grupo of gs) {
            lineas.push(`\n${emojiCategoria(grupo.categoria)} ${grupo.categoria.toUpperCase()}`)
            for (const item of grupo.items) {
                lineas.push(`  • ${item.nombre} — ${formatearGramos(item.gramos_totales)}`)
            }
        }
        try {
            await navigator.clipboard.writeText(lineas.join('\n'))
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            // fallback silencioso
        }
    }

    const gs = grupos()
    const totalItems = gs.reduce((sum, g) => sum + g.items.length, 0)

    return (
        <div className="card overflow-hidden">
            {/* Header clickable */}
            <button
                onClick={() => setAbierto(!abierto)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                        <ShoppingCart size={20} style={{ color: '#16A34A' }} />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Lista de la compra</p>
                        <p className="text-xs text-gray-400">
                            {totalItems > 0
                                ? `${totalItems} producto${totalItems !== 1 ? 's' : ''} en ${gs.length} categoría${gs.length !== 1 ? 's' : ''}`
                                : 'Sin alimentos en el plan'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {totalItems > 0 && (
                        <span className="badge badge-green text-xs font-semibold">{totalItems}</span>
                    )}
                    {abierto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
            </button>

            {/* Contenido desplegable */}
            {abierto && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                    {gs.length === 0 ? (
                        <div className="p-8 text-center">
                            <ShoppingCart size={40} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                            <p className="text-sm text-gray-400">No hay alimentos en el plan</p>
                            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Añade comidas con alimentos para generar la lista</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {/* Botón copiar */}
                            <button
                                onClick={copiarLista}
                                className="btn-secondary w-full flex items-center justify-center gap-2 py-2.5 text-sm"
                            >
                                {copiado ? (
                                    <>
                                        <Check size={16} className="text-green-600" />
                                        <span className="text-green-600">¡Copiado!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} />
                                        <span>Copiar lista al portapapeles</span>
                                    </>
                                )}
                            </button>

                            {/* Grupos por categoría */}
                            {gs.map(grupo => {
                                const expanded = expandidas[grupo.categoria] !== false // por defecto expandido
                                return (
                                    <div key={grupo.categoria} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => toggleCategoria(grupo.categoria)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                            style={{ background: '#FAFAFA' }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{emojiCategoria(grupo.categoria)}</span>
                                                <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                    {grupo.categoria}
                                                </span>
                                                <span className="badge badge-gray text-[10px] ml-1">{grupo.items.length}</span>
                                            </div>
                                            {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                                        </button>

                                        {expanded && (
                                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                                {grupo.items.map(item => (
                                                    <div key={item.alimento_id} className="flex items-center justify-between px-4 py-2.5">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
                                                                onChange={e => {
                                                                    const label = e.target.closest('label')
                                                                    if (label) label.classList.toggle('line-through')
                                                                    if (label) label.classList.toggle('text-gray-400')
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                                {item.nombre}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-semibold text-green-700 dark:text-green-400 ml-3 flex-shrink-0">
                                                            {formatearGramos(item.gramos_totales)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function formatearGramos(g: number): string {
    if (g >= 1000) {
        return `${(g / 1000).toFixed(1)} kg`
    }
    return `${Math.round(g)} g`
}
