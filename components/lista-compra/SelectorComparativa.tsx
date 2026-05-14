// components/lista-compra/SelectorComparativa.tsx
'use client'

import { useState, useMemo } from 'react'
import { Store, TrendingDown, TrendingUp, Loader2, Check, Sparkles } from 'lucide-react'
import type { IngredienteSemanal, PrecioOpcion } from '@/types'

function formatearEuro(n: number) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(n)
}

interface Props {
    ingredientes: IngredienteSemanal[]
    onAplicarSupermercado: (supermercadoId: string) => void
    /** Supermercado actualmente más usado (basado en selecciones) */
    supermercadoActual?: string
    /** Indica si se está aplicando una selección masiva */
    aplicando?: boolean
}

interface SuperResumen {
    id: string
    nombre: string
    color: string
    coste: number
    numAlimentos: number
    numSeleccionados: number // cuantos ingredientes ya tienen este super seleccionado
}

export default function SelectorComparativa({
    ingredientes,
    onAplicarSupermercado,
    supermercadoActual,
    aplicando = false,
}: Props) {
    const [expandido, setExpandido] = useState(true)

    // Calcular total por supermercado basado en precio más barato disponible
    const supermercados = useMemo(() => {
        const mapa = new Map<string, SuperResumen>()

        for (const ing of ingredientes) {
            if (ing.precios.length === 0) continue

            for (const p of ing.precios) {
                const existente = mapa.get(p.supermercado_id)
                const coste = (ing.cantidad_gramos_total / 1000) * p.precio_por_kg
                const yaSeleccionado = ing.seleccion?.supermercado_id === p.supermercado_id

                if (existente) {
                    mapa.set(p.supermercado_id, {
                        ...existente,
                        coste: existente.coste + coste,
                        numAlimentos: existente.numAlimentos + (coste > 0 ? 1 : 0),
                        numSeleccionados: existente.numSeleccionados + (yaSeleccionado ? 1 : 0),
                    })
                } else {
                    mapa.set(p.supermercado_id, {
                        id: p.supermercado_id,
                        nombre: p.supermercado_nombre,
                        color: p.supermercado_color || '#6b7280',
                        coste,
                        numAlimentos: coste > 0 ? 1 : 0,
                        numSeleccionados: yaSeleccionado ? 1 : 0,
                    })
                }
            }
        }

        return Array.from(mapa.values())
            .sort((a, b) => a.coste - b.coste)
    }, [ingredientes])

    const masBarato = supermercados[0]
    const masCaro = supermercados[supermercados.length - 1]
    const ahorroPotencial = masCaro
        ? masCaro.coste - (masBarato?.coste ?? 0)
        : 0

    // Calcular alimentos sin precio
    const sinPrecio = ingredientes.filter(i => i.precios.length === 0).length

    if (supermercados.length === 0 && sinPrecio === 0) {
        return null
    }

    return (
        <div className="rounded-xl border overflow-hidden" style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
        }}>
            {/* Header */}
            <button
                onClick={() => setExpandido(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-black/5"
            >
                <div className="flex items-center gap-2">
                    <Store className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        🏆 Comparativa por supermercado
                    </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {expandido ? '▲' : '▼'}
                </span>
            </button>

            {expandido && (
                <div className="px-4 pb-4 space-y-3">
                    {supermercados.length === 0 && sinPrecio > 0 && (
                        <p className="text-xs py-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
                            {sinPrecio} alimento{sinPrecio !== 1 ? 's' : ''} sin precio disponible.
                            Haz scraping o añade precios manualmente.
                        </p>
                    )}

                    {supermercados.length > 0 && (
                        <>
                            {/* Tarjetas de supermercados */}
                            <div className="space-y-1.5">
                                {supermercados.map((sm, idx) => {
                                    const esMejor = idx === 0
                                    const diff = esMejor ? 0 : sm.coste - masBarato.coste
                                    const pct = masBarato.coste > 0
                                        ? ((sm.coste - masBarato.coste) / masBarato.coste) * 100
                                        : 0
                                    const esActual = supermercadoActual === sm.id

                                    return (
                                        <button
                                            key={sm.id}
                                            onClick={() => onAplicarSupermercado(sm.id)}
                                            disabled={aplicando}
                                            className={`
                                                w-full flex items-center justify-between py-2.5 px-3 rounded-xl
                                                transition-all duration-150 text-left
                                                ${esMejor
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800'
                                                    : 'bg-transparent border border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/30'
                                                }
                                                ${aplicando ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}
                                            `}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                {/* Indicador visual */}
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/5"
                                                    style={{ background: sm.color }}
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`text-sm font-medium truncate ${esMejor
                                                            ? 'text-emerald-800 dark:text-emerald-200'
                                                            : ''
                                                            }`}>
                                                            {sm.nombre}
                                                        </span>

                                                        {esMejor && (
                                                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-800/50 px-1.5 py-0.5 rounded-full">
                                                                MÁS BARATO
                                                            </span>
                                                        )}

                                                        {idx === supermercados.length - 1 && supermercados.length > 1 && (
                                                            <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
                                                                MÁS CARO
                                                            </span>
                                                        )}

                                                        {esActual && !esMejor && (
                                                            <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                                                                actual
                                                            </span>
                                                        )}

                                                        {esActual && esMejor && (
                                                            <span className="text-[10px] text-emerald-600 bg-emerald-100 dark:bg-emerald-800/50 px-1.5 py-0.5 rounded-full">
                                                                ✓ actual
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                            {sm.numAlimentos} alimento{sm.numAlimentos !== 1 ? 's' : ''}
                                                        </span>
                                                        {diff > 0 && (
                                                            <span className="text-xs text-red-500 flex items-center gap-0.5">
                                                                <TrendingUp className="w-3 h-3" />
                                                                +{pct.toFixed(1)}%
                                                            </span>
                                                        )}
                                                        {esMejor && masBarato && masCaro && idx !== supermercados.length - 1 && (
                                                            <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                                                                <TrendingDown className="w-3 h-3" />
                                                                ahorro potencial
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <span className={`text-sm font-bold tabular-nums ${esMejor
                                                    ? 'text-emerald-700 dark:text-emerald-300'
                                                    : ''
                                                    }`}>
                                                    {formatearEuro(sm.coste)}
                                                </span>

                                                {esMejor && (
                                                    <Sparkles className="w-4 h-4 text-emerald-500" />
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Resumen de ahorro potencial */}
                            {ahorroPotencial > 0 && masBarato && (
                                <div
                                    className="rounded-xl p-3 flex items-center gap-3"
                                    style={{
                                        background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                                    }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                                        style={{ background: 'rgba(16,185,129,0.2)' }}
                                    >
                                        <TrendingDown className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-emerald-800">
                                            Ahorro potencial: {formatearEuro(ahorroPotencial)}
                                        </p>
                                        <p className="text-xs text-emerald-600 mt-0.5">
                                            Comprando todo en {masBarato.nombre} en lugar de {masCaro?.nombre ?? 'el más caro'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Botón de aplicar */}
                            {masBarato && (
                                <button
                                    onClick={() => onAplicarSupermercado(masBarato.id)}
                                    disabled={aplicando}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150"
                                    style={{
                                        background: 'var(--accent)',
                                        color: '#1C1C1E',
                                        opacity: aplicando ? 0.6 : 1,
                                    }}
                                >
                                    {aplicando ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    {aplicando
                                        ? 'Aplicando selección más barata...'
                                        : `Seleccionar ${masBarato.nombre} para todos los alimentos`
                                    }
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
