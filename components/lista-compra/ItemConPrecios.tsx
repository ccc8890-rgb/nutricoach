// components/lista-compra/ItemConPrecios.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Check } from 'lucide-react'
import type { IngredienteSemanal, PrecioOpcion } from '@/types'

const CATEGORIA_EMOJIS: Record<string, string> = {
    'Verduras': '🥦', 'Hortalizas': '🥬', 'Frutas': '🍎', 'Carnes': '🥩',
    'Pescados': '🐟', 'Mariscos': '🦐', 'Huevos': '🥚', 'Lácteos': '🥛',
    'Lacteos': '🥛', 'Legumbres': '🫘', 'Cereales': '🌾', 'Tubérculos': '🥔',
    'Frutos secos': '🥜', 'Semillas': '🌰', 'Aceites': '🫒', 'Grasas': '🫒',
    'Especias': '🌶️', 'Condimentos': '🧂', 'Salsas': '🥫', 'Bebidas': '🧃',
    'Suplementos': '💊', 'Congelados': '❄️', 'Conservas': '🥫',
    'Pan': '🍞', 'Pastas': '🍝', 'Arroces': '🍚', 'Otros': '📦',
}

function formatGramos(g: number): string {
    return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`
}

interface ItemConPreciosProps {
    ingrediente: IngredienteSemanal
    onSeleccionar: (alimentoId: string, opcion: PrecioOpcion) => void
    guardando?: boolean
}

export default function ItemConPrecios({ ingrediente, onSeleccionar, guardando }: ItemConPreciosProps) {
    const [expandido, setExpandido] = useState(false)
    const emoji = CATEGORIA_EMOJIS[ingrediente.categoria] ?? '📦'
    const tienePrecios = ingrediente.precios.length > 0
    const seleccion = ingrediente.seleccion
    const precioActivo = seleccion
        ? ingrediente.precios.find(p => p.supermercado_id === seleccion.supermercado_id)
        : ingrediente.precios[0] // más barato por defecto

    return (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            {/* Fila principal */}
            <button
                onClick={() => tienePrecios && setExpandido(v => !v)}
                disabled={!tienePrecios}
                className="w-full flex items-center justify-between p-3 text-left transition-colors"
                style={{ cursor: tienePrecios ? 'pointer' : 'default' }}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{ingrediente.alimento_nombre}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--muted-foreground)' }}>
                                {formatGramos(ingrediente.cantidad_gramos_total)}
                            </span>
                        </div>
                        {precioActivo ? (
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs font-medium" style={{ color: '#16a34a' }}>
                                    {precioActivo.supermercado_nombre}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                    {precioActivo.precio_por_kg.toFixed(2)} €/kg · {precioActivo.coste_euros.toFixed(2)} €
                                </span>
                                {seleccion && (
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f0fdf4', color: '#15803d' }}>
                                        ✓ elegido
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                                Sin precio disponible
                            </span>
                        )}
                    </div>
                </div>
                {tienePrecios && (
                    expandido
                        ? <ChevronUp className="w-4 h-4 shrink-0 opacity-40" />
                        : <ChevronDown className="w-4 h-4 shrink-0 opacity-40" />
                )}
            </button>

            {/* Panel de precios expandido */}
            {expandido && (
                <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="pt-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                        Elige dónde comprarlo
                    </p>
                    {ingrediente.precios.map(precio => {
                        const estaSeleccionado = seleccion?.supermercado_id === precio.supermercado_id
                        return (
                            <button
                                key={precio.supermercado_id}
                                onClick={() => onSeleccionar(ingrediente.alimento_id, precio)}
                                disabled={guardando}
                                className="w-full flex items-center justify-between py-2 px-3 rounded-lg transition-colors text-left"
                                style={{
                                    background: estaSeleccionado ? '#f0fdf4' : 'var(--surface)',
                                    border: `1px solid ${estaSeleccionado ? '#86efac' : 'transparent'}`,
                                    opacity: guardando ? 0.6 : 1,
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ background: precio.supermercado_color || '#9ca3af' }}
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium">{precio.supermercado_nombre}</span>
                                            {precio.es_mas_barato && (
                                                <span className="text-xs px-1 py-0.5 rounded" style={{ background: '#dcfce7', color: '#15803d' }}>
                                                    más barato
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                            {precio.precio_por_kg.toFixed(2)} €/kg
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-sm font-bold">{precio.coste_euros.toFixed(2)} €</span>
                                    {precio.url_producto && (
                                        <a
                                            href={precio.url_producto}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <ExternalLink className="w-3 h-3 opacity-30 hover:opacity-80" />
                                        </a>
                                    )}
                                    {estaSeleccionado && <Check className="w-4 h-4" style={{ color: '#16a34a' }} />}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
