'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react'
import type { ItemListaCompra } from '@/app/api/cliente/[codigo]/lista-compra/route'

interface ListaCompraPortalProps {
    codigo: string
}

const CATEGORIA_ICONOS: Record<string, string> = {
    'Carnes y aves': '🥩',
    'Pescados y mariscos': '🐟',
    'Lácteos y huevos': '🥛',
    'Frutas': '🍎',
    'Verduras y hortalizas': '🥦',
    'Legumbres': '🫘',
    'Cereales y harinas': '🌾',
    'Aceites y grasas': '🫙',
    'Frutos secos': '🥜',
    'Condimentos y salsas': '🧂',
    'Bebidas': '🥤',
    'Otros': '📦',
}

function formatGramos(g: number): string {
    if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} kg`
    return `${Math.round(g)} g`
}

export default function ListaCompraPortal({ codigo }: ListaCompraPortalProps) {
    const [items, setItems] = useState<ItemListaCompra[]>([])
    const [loading, setLoading] = useState(true)
    const [marcados, setMarcados] = useState<Set<string>>(new Set())
    const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetch(`/api/cliente/${codigo}/lista-compra`)
            .then(r => r.json())
            .then(({ items }) => setItems(items ?? []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [codigo])

    if (loading) return (
        <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: '#0D9488' }} />
        </div>
    )

    if (!items.length) return (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay ingredientes en tu plan.
        </div>
    )

    // Agrupar por categoría
    const porCategoria = items.reduce<Record<string, ItemListaCompra[]>>((acc, item) => {
        const cat = item.categoria
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(item)
        return acc
    }, {})

    const totalItems = items.length
    const totalMarcados = marcados.size

    function toggleMarcado(id: string) {
        setMarcados(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    function toggleCategoria(cat: string) {
        setColapsadas(prev => {
            const next = new Set(prev)
            next.has(cat) ? next.delete(cat) : next.add(cat)
            return next
        })
    }

    return (
        <div className="space-y-2">
            {/* Progreso */}
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>{totalItems} ingredientes · {Object.keys(porCategoria).length} categorías</span>
                {totalMarcados > 0 && (
                    <span className="font-medium" style={{ color: '#0D9488' }}>
                        {totalMarcados}/{totalItems} en el carro
                    </span>
                )}
            </div>
            {totalMarcados > 0 && (
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ background: '#0D9488', width: `${(totalMarcados / totalItems) * 100}%` }}
                    />
                </div>
            )}

            {/* Lista por categoría */}
            {Object.entries(porCategoria).map(([cat, catItems]) => {
                const colapsar = colapsadas.has(cat)
                const icono = CATEGORIA_ICONOS[cat] ?? '📦'
                const todosMarcados = catItems.every(i => marcados.has(i.alimento_id))

                return (
                    <div key={cat} className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                        {/* Cabecera categoría */}
                        <button
                            onClick={() => toggleCategoria(cat)}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors"
                            style={{ background: todosMarcados ? 'var(--bg)' : 'var(--surface)' }}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-base">{icono}</span>
                                <span
                                    className="text-sm font-semibold"
                                    style={{ color: todosMarcados ? 'var(--text-muted)' : 'var(--text)', textDecoration: todosMarcados ? 'line-through' : 'none' }}
                                >
                                    {cat}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                                    {catItems.length}
                                </span>
                            </div>
                            {colapsar ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />}
                        </button>

                        {/* Items */}
                        {!colapsar && (
                            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                {catItems.map(item => {
                                    const checked = marcados.has(item.alimento_id)
                                    return (
                                        <button
                                            key={item.alimento_id}
                                            onClick={() => toggleMarcado(item.alimento_id)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                                            style={{ background: checked ? 'var(--bg)' : 'var(--surface)' }}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-all"
                                                style={{
                                                    borderColor: checked ? '#0D9488' : 'var(--border)',
                                                    background: checked ? '#0D9488' : 'transparent',
                                                }}
                                            >
                                                {checked && <Check size={11} color="white" strokeWidth={3} />}
                                            </div>

                                            {/* Nombre + comidas */}
                                            <div className="flex-1 min-w-0">
                                                <p
                                                    className="text-sm font-medium"
                                                    style={{
                                                        color: checked ? 'var(--text-muted)' : 'var(--text)',
                                                        textDecoration: checked ? 'line-through' : 'none',
                                                    }}
                                                >
                                                    {item.nombre}
                                                </p>
                                                {item.comidas_origen.length > 0 && (
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                        {item.comidas_origen.join(' · ')}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Cantidad */}
                                            <span
                                                className="text-xs font-semibold flex-shrink-0"
                                                style={{ color: checked ? 'var(--text-muted)' : '#0D9488' }}
                                            >
                                                {formatGramos(item.cantidad_gramos)}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Limpiar marcados */}
            {totalMarcados > 0 && (
                <button
                    className="w-full text-xs py-2 rounded-xl border transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    onClick={() => setMarcados(new Set())}
                >
                    Limpiar selección
                </button>
            )}
        </div>
    )
}
