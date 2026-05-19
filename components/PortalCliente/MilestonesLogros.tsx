'use client'

import { useState, useEffect } from 'react'

type Logro = {
    id: string
    icono: string
    titulo: string
    descripcion: string
    progreso: number
    actual: number
    meta: number
    conseguido: boolean
    categoria: 'peso' | 'checkin' | 'constancia' | 'plan'
}

const CATEGORIAS: Record<string, { label: string; color: string; bg: string }> = {
    peso: { label: 'Peso', color: '#0D9488', bg: '#F0FDFA' },
    checkin: { label: 'Check-in', color: '#7C3AED', bg: '#F5F3FF' },
    plan: { label: 'Plan', color: '#2563EB', bg: '#EFF6FF' },
}

export default function MilestonesLogros({ codigo }: { codigo: string }) {
    const [logros, setLogros] = useState<Logro[]>([])
    const [loading, setLoading] = useState(true)
    const [filtro, setFiltro] = useState<string | null>(null)

    useEffect(() => {
        fetch(`/api/cliente/${codigo}/logros`)
            .then(r => r.json())
            .then(({ logros }) => setLogros(logros ?? []))
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [codigo])

    if (loading) return null

    const conseguidos = logros.filter(l => l.conseguido).length
    const total = logros.length
    const porcentajeGlobal = total > 0 ? Math.round((conseguidos / total) * 100) : 0

    const visibles = filtro
        ? logros.filter(l => l.categoria === filtro)
        : logros

    return (
        <div className="card">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">🎯 Mis logros</h2>
                <span className="text-xs text-gray-400 font-medium">
                    {conseguidos}/{total}
                </span>
            </div>

            {/* Barra de progreso global */}
            <div className="mb-5">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span>Progreso global</span>
                    <span className="font-semibold text-gray-700">{porcentajeGlobal}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${porcentajeGlobal}%`,
                            background: 'linear-gradient(90deg, #0D9488, #7C3AED)',
                        }}
                    />
                </div>
            </div>

            {/* Filtros de categoría */}
            <div className="flex gap-2 mb-4 flex-wrap">
                <button
                    onClick={() => setFiltro(null)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${filtro === null
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                >
                    Todos
                </button>
                {Object.entries(CATEGORIAS).map(([key, cat]) => (
                    <button
                        key={key}
                        onClick={() => setFiltro(key)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${filtro === key
                                ? 'text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        style={filtro === key ? { background: cat.color } : undefined}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Grid de logros */}
            {visibles.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay logros disponibles</p>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {visibles.map(l => {
                        const cat = CATEGORIAS[l.categoria]
                        return (
                            <div
                                key={l.id}
                                className={`rounded-xl p-3.5 transition-all ${l.conseguido
                                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                                        : 'bg-gray-50 border border-gray-100'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icono */}
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${l.conseguido ? 'bg-green-100' : 'bg-white border border-gray-200'
                                            }`}
                                    >
                                        {l.conseguido ? '🏆' : l.icono}
                                    </div>

                                    {/* Contenido */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className={`font-semibold text-sm ${l.conseguido ? 'text-green-700' : 'text-gray-800'}`}>
                                                {l.titulo}
                                            </p>
                                            {l.conseguido && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                                                    ✓
                                                </span>
                                            )}
                                            <span
                                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto"
                                                style={{ background: cat.bg, color: cat.color }}
                                            >
                                                {cat.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mb-2 line-clamp-1">
                                            {l.descripcion}
                                        </p>

                                        {/* Barra de progreso individual */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                                    style={{
                                                        width: `${Math.min(100, l.progreso)}%`,
                                                        background: l.conseguido
                                                            ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                                                            : cat.color,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-500 flex-shrink-0">
                                                {l.conseguido
                                                    ? `${l.meta}/${l.meta}`
                                                    : `${Math.min(l.meta, Math.floor(l.actual))}/${l.meta}`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
