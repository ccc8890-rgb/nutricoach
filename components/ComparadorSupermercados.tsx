'use client'

import { Store, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import type { ComparativaSupermercados } from '@/types'
import { useState } from 'react'

interface Props {
    data: ComparativaSupermercados
    cargando?: boolean
}

function formatearEur(n: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(n)
}

export default function ComparadorSupermercados({ data, cargando }: Props) {
    const [desgloseExpandido, setDesgloseExpandido] = useState(false)

    if (cargando) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-700 rounded" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (!data || data.supermercados.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                <Store className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">No hay datos de precios disponibles</p>
                <p className="text-sm mt-1">Vincula alimentos a precios de supermercado para ver la comparativa.</p>
            </div>
        )
    }

    const { supermercados, ahorro_semanal, ahorro_mensual, ahorro_anual, recomendado, desglose } = data
    const maxPrecio = Math.max(...supermercados.map(s => s.precio_total))
    const mejor = supermercados[0]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                    🛒 Comparativa de precios
                </h2>
            </div>

            {/* Tarjetas de supermercados */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {supermercados.map((sm, idx) => {
                    const pct = maxPrecio > 0 ? (sm.precio_total / maxPrecio) * 100 : 0
                    const esMejor = sm.es_mas_barato
                    const diff = sm.dif_respecto_barato

                    return (
                        <div
                            key={sm.id}
                            className={`
                                relative rounded-xl border-2 p-4 flex flex-col items-center text-center
                                transition-all duration-200 hover:shadow-md
                                ${esMejor
                                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm'
                                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                                }
                            `}
                        >
                            {/* Medalla */}
                            {idx === 0 && (
                                <span className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                                    🥇
                                </span>
                            )}
                            {idx === 1 && (
                                <span className="absolute -top-2.5 -right-2.5 bg-neutral-400 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                                    🥈
                                </span>
                            )}
                            {idx === 2 && (
                                <span className="absolute -top-2.5 -right-2.5 bg-amber-700 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                                    🥉
                                </span>
                            )}

                            {/* Barra de color superior */}
                            <div
                                className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                                style={{ backgroundColor: sm.color || '#6b7280' }}
                            />

                            {/* Nombre */}
                            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mt-1">
                                {sm.nombre}
                            </p>

                            {/* Precio */}
                            <p className={`text-xl font-bold mt-1 ${esMejor ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-800 dark:text-neutral-100'}`}>
                                {formatearEur(sm.precio_total)}
                            </p>

                            {/* Diferencia */}
                            <div className="flex items-center gap-0.5 mt-0.5">
                                {diff === 0 ? (
                                    <Minus className="w-3.5 h-3.5 text-neutral-400" />
                                ) : (
                                    <>
                                        {esMejor ? (
                                            <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                            <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                                        )}
                                    </>
                                )}
                                <span className={`text-xs font-medium ${diff === 0 ? 'text-neutral-400' : esMejor ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {diff === 0 ? 'base' : `${esMejor ? '-' : '+'}${formatearEur(Math.abs(diff))}`}
                                </span>
                            </div>

                            {/* Barra de comparación visual */}
                            <div className="w-full bg-neutral-200 dark:bg-neutral-600 rounded-full h-1.5 mt-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${esMejor ? 'bg-emerald-400' : 'bg-neutral-300 dark:bg-neutral-500'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Resumen de ahorro */}
            {mejor && (
                <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                        <div className="flex items-center gap-2">
                            <Store className="w-5 h-5 text-emerald-600" />
                            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                🏆 Recomendado: <strong className="text-emerald-700 dark:text-emerald-400">{recomendado}</strong>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                            <TrendingDown className="w-4 h-4 text-emerald-500" />
                            <span>Ahorro semanal: <strong className="text-emerald-600 dark:text-emerald-400">{formatearEur(ahorro_semanal)}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                            <TrendingDown className="w-4 h-4 text-emerald-500" />
                            <span>Ahorro mensual: <strong className="text-emerald-600 dark:text-emerald-400">{formatearEur(ahorro_mensual)}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                            <TrendingDown className="w-4 h-4 text-emerald-500" />
                            <span>Ahorro anual: <strong className="text-emerald-600 dark:text-emerald-400">{formatearEur(ahorro_anual)}</strong></span>
                        </div>
                    </div>
                </div>
            )}

            {/* Desglose por alimento */}
            {desglose.length > 0 && (
                <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setDesgloseExpandido(!desgloseExpandido)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                            📋 Desglose por alimento ({desglose.length})
                        </span>
                        {desgloseExpandido ? (
                            <ChevronUp className="w-4 h-4 text-neutral-500" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-500" />
                        )}
                    </button>

                    {desgloseExpandido && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30">
                                        <th className="text-left px-4 py-2 font-medium text-neutral-600 dark:text-neutral-400">
                                            Alimento
                                        </th>
                                        {supermercados.map(sm => (
                                            <th
                                                key={sm.id}
                                                className="text-right px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400"
                                            >
                                                <span
                                                    className="inline-block w-2 h-2 rounded-full mr-1"
                                                    style={{ backgroundColor: sm.color || '#6b7280' }}
                                                />
                                                {sm.nombre}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {desglose.map(item => (
                                        <tr
                                            key={item.alimento_id}
                                            className="border-b border-neutral-100 dark:border-neutral-700/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/20"
                                        >
                                            <td className="px-4 py-2.5 font-medium text-neutral-800 dark:text-neutral-200">
                                                {item.alimento_nombre}
                                            </td>
                                            {supermercados.map(sm => {
                                                const precio = item.precios.find(p => p.supermercado_id === sm.id)
                                                const esMasBarato = item.mas_barato === sm.id
                                                return (
                                                    <td
                                                        key={sm.id}
                                                        className={`text-right px-3 py-2.5 tabular-nums ${esMasBarato
                                                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                                            : 'text-neutral-600 dark:text-neutral-400'
                                                            }`}
                                                    >
                                                        {precio ? (
                                                            <span className={esMasBarato ? 'ring-1 ring-emerald-300 dark:ring-emerald-700 rounded px-1 py-0.5' : ''}>
                                                                {formatearEur(precio.precio)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-neutral-300 dark:text-neutral-600">—</span>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
