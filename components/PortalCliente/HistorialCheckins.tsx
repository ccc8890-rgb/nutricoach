'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    ClipboardCheck,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Calendar,
    TrendingUp,
    TrendingDown,
    Minus,
    Flame,
    MessageSquareText,
    X,
} from 'lucide-react'

interface CheckIn {
    id: string
    fecha: string
    peso?: number
    adherencia?: number
    energia?: number
    sueno?: number
    notas?: string | null
    nota_coach?: string | null
    mensaje_coach_ia?: string | null
    created_at: string
}

interface HistorialResponse {
    checkins: CheckIn[]
    total: number
    page: number
    limit: number
    totalPages: number
}

interface HistorialCheckinsProps {
    codigo: string
}

const EMOTICONOS_ADHERENCIA = ['😞', '😐', '🙂', '😊', '🔥']
const EMOTICONOS_ENERGIA = ['🪫', '😴', '🙂', '⚡', '🔥']
const EMOTICONOS_SUENO = ['😫', '😐', '🙂', '😴', '💤']

function getAdherenciaColor(valor: number): string {
    if (valor >= 8) return 'text-green-600 bg-green-50 border-green-200'
    if (valor >= 5) return 'text-[#8E8E93] bg-[#F2F2F4] border-[#D1D1D6]'
    return 'text-red-600 bg-red-50 border-red-200'
}

function getAdherenciaBarColor(valor: number): string {
    if (valor >= 8) return 'bg-green-500'
    if (valor >= 5) return 'bg-[#A1A1A6]'
    return 'bg-red-500'
}

function getEmoticono(valor: number, lista: string[]): string {
    return lista[Math.min(Math.max(valor - 1, 0), lista.length - 1)]
}

function formatearFecha(fechaStr: string): string {
    const d = new Date(fechaStr)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const diff = Math.floor((hoy.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Ayer'
    if (diff < 7) return `Hace ${diff} días`

    return d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
}

function formatearFechaCorta(fechaStr: string): string {
    return new Date(fechaStr).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

export default function HistorialCheckins({ codigo }: HistorialCheckinsProps) {
    const [data, setData] = useState<HistorialResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [error, setError] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [filtroNotas, setFiltroNotas] = useState(false)
    const [ordenAscendente, setOrdenAscendente] = useState(false)

    const limit = 15

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(
                `/api/cliente/${codigo}/checkins?page=${page}&limit=${limit}`
            )
            if (!res.ok) {
                const err = await res.json()
                setError(err.error || 'Error al cargar')
                return
            }
            const json = await res.json()
            setData(json)
        } catch {
            setError('Error de conexión')
        } finally {
            setLoading(false)
        }
    }, [codigo, page])

    useEffect(() => {
        load()
    }, [load])

    // Filtrar y ordenar
    let checkinsVisibles = data?.checkins ?? []
    if (filtroNotas) {
        checkinsVisibles = checkinsVisibles.filter(c => c.notas)
    }
    if (ordenAscendente) {
        checkinsVisibles = [...checkinsVisibles].reverse()
    }

    // Stats
    const total = data?.total ?? 0
    const mediaAdherencia = checkinsVisibles.length > 0
        ? (checkinsVisibles.filter(c => c.adherencia).reduce((s, c) => s + (c.adherencia ?? 0), 0) /
            Math.max(checkinsVisibles.filter(c => c.adherencia).length, 1))
        : 0
    const mediaEnergia = checkinsVisibles.length > 0
        ? (checkinsVisibles.filter(c => c.energia).reduce((s, c) => s + (c.energia ?? 0), 0) /
            Math.max(checkinsVisibles.filter(c => c.energia).length, 1))
        : 0
    const mediaSueno = checkinsVisibles.length > 0
        ? (checkinsVisibles.filter(c => c.sueno).reduce((s, c) => s + (c.sueno ?? 0), 0) /
            Math.max(checkinsVisibles.filter(c => c.sueno).length, 1))
        : 0

    const tendenciaAdherencia = mediaAdherencia >= 7 ? 'up' : mediaAdherencia >= 4 ? 'stable' : 'down'

    function cambiarPagina(nueva: number) {
        setPage(nueva)
        setExpandedId(null)
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ClipboardCheck size={18} style={{ color: '#0D9488' }} />
                        <h2 className="font-semibold text-gray-900">📋 Historial completo de check-ins</h2>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                        {total} {total === 1 ? 'registro' : 'registros'}
                    </span>
                </div>

                {/* Stats rápidas */}
                {total > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="text-center p-2.5 rounded-lg bg-gray-50">
                            <p className="text-lg font-bold text-gray-900">{mediaAdherencia.toFixed(1)}</p>
                            <p className="text-[10px] text-gray-500">Adherencia</p>
                            <div className="flex justify-center mt-0.5">
                                {tendenciaAdherencia === 'up' ? <TrendingUp size={10} className="text-green-500" /> :
                                    tendenciaAdherencia === 'down' ? <TrendingDown size={10} className="text-red-500" /> :
                                        <Minus size={10} style={{ color: '#A1A1A6' }} />}
                            </div>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-gray-50">
                            <p className="text-lg font-bold text-gray-900">{mediaEnergia.toFixed(1)}</p>
                            <p className="text-[10px] text-gray-500">Energía</p>
                            <span className="text-xs">{getEmoticono(Math.round(mediaEnergia), EMOTICONOS_ENERGIA)}</span>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-gray-50">
                            <p className="text-lg font-bold text-gray-900">{mediaSueno.toFixed(1)}</p>
                            <p className="text-[10px] text-gray-500">Sueño</p>
                            <span className="text-xs">{getEmoticono(Math.round(mediaSueno), EMOTICONOS_SUENO)}</span>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-[#F2F2F4]">
                            <Flame size={16} className="mx-auto" style={{ color: '#A1A1A6' }} />
                            <p className="text-lg font-bold text-gray-900">{total}</p>
                            <p className="text-[10px] text-gray-500">Total</p>
                        </div>
                    </div>
                )}

                {/* Filtros */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => { setFiltroNotas(!filtroNotas); setPage(1) }}
                        className={`btn btn-xs ${filtroNotas ? 'btn-primary' : 'btn-ghost'}`}
                    >
                        <MessageSquareText size={12} />
                        Solo con notas
                    </button>
                    <button
                        onClick={() => setOrdenAscendente(!ordenAscendente)}
                        className="btn btn-xs btn-ghost"
                    >
                        <Calendar size={12} />
                        {ordenAscendente ? 'Más antiguos' : 'Más recientes'}
                    </button>
                    {(filtroNotas || ordenAscendente) && (
                        <button
                            onClick={() => { setFiltroNotas(false); setOrdenAscendente(false); setPage(1) }}
                            className="btn btn-xs btn-ghost text-red-500"
                        >
                            <X size={12} />
                            Limpiar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Estado de carga */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={24} className="animate-spin" style={{ color: '#0D9488' }} />
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="card text-center py-8">
                    <p className="text-sm text-red-500">{error}</p>
                </div>
            )}

            {/* Sin check-ins */}
            {!loading && !error && total === 0 && (
                <div className="card text-center py-12">
                    <ClipboardCheck size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">Aún no has realizado ningún check-in</p>
                    <p className="text-xs text-gray-400 mt-1">Completa tu primer check-in en la pestaña anterior</p>
                </div>
            )}

            {/* Lista de check-ins */}
            {!loading && !error && checkinsVisibles.length > 0 && (
                <>
                    <div className="space-y-2">
                        {checkinsVisibles.map((c) => {
                            const expandida = expandedId === c.id
                            const adherenciaColor = getAdherenciaColor(c.adherencia ?? 0)
                            const tieneNotas = !!c.notas

                            return (
                                <div key={c.id} className="card !p-0 overflow-hidden">
                                    {/* Fila principal */}
                                    <button
                                        onClick={() => setExpandedId(expandida ? null : c.id)}
                                        className="w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        {/* Indicador de fecha */}
                                        <div className="flex-shrink-0 w-12 text-center">
                                            <p className="text-xs font-bold text-gray-800">
                                                {new Date(c.fecha).getDate()}
                                            </p>
                                            <p className="text-[9px] text-gray-400 uppercase">
                                                {new Date(c.fecha).toLocaleDateString('es-ES', { month: 'short' })}
                                            </p>
                                        </div>

                                        {/* Indicador de adherencia (barrita de color) */}
                                        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${getAdherenciaBarColor(c.adherencia ?? 0)}`} />

                                        {/* Métricas */}
                                        <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className="text-xs text-gray-400">Peso</p>
                                                <p className="text-sm font-semibold text-gray-800">
                                                    {c.peso ? `${c.peso.toFixed(1)}` : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Adh.</p>
                                                <p className={`text-sm font-semibold ${adherenciaColor.split(' ')[0]}`}>
                                                    {c.adherencia ? `${c.adherencia}/10` : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Energía</p>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className={`text-sm font-semibold ${(c.energia ?? 0) >= 7 ? 'text-[#A1A1A6]' : (c.energia ?? 0) >= 4 ? 'text-[#8E8E93]' : 'text-gray-400'}`}>
                                                        {c.energia ? `${c.energia}` : '—'}
                                                    </span>
                                                    {c.energia && (
                                                        <span className="text-xs">{getEmoticono(c.energia, EMOTICONOS_ENERGIA)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Indicadores */}
                                        <div className="flex-shrink-0 flex items-center gap-1">
                                            {c.nota_coach && (
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#DBEAFE' }}>
                                                    <MessageSquareText size={10} style={{ color: '#2563EB' }} />
                                                </div>
                                            )}
                                            {tieneNotas && !c.nota_coach && (
                                                <MessageSquareText size={14} className="text-gray-300" />
                                            )}
                                        </div>

                                        {/* Badge "Hoy" / "Ayer" */}
                                        <div className="flex-shrink-0">
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full
                                                ${formatearFecha(c.fecha) === 'Hoy' ? 'bg-green-100 text-green-700' :
                                                    formatearFecha(c.fecha) === 'Ayer' ? 'bg-[#E5E5EA] text-[#636366]' :
                                                        'bg-gray-100 text-gray-500'}`}>
                                                {formatearFecha(c.fecha) === 'Hoy' ? 'Hoy' :
                                                    formatearFecha(c.fecha) === 'Ayer' ? 'Ayer' :
                                                        formatearFechaCorta(c.fecha)}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Expandido: detalles completos */}
                                    {expandida && (
                                        <div className="px-3.5 pb-3.5 pt-0 border-t border-gray-100">
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                <div className={`p-3 rounded-lg border ${getAdherenciaColor(c.adherencia ?? 0)}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-gray-500">Adherencia</span>
                                                        <span className="text-lg">{getEmoticono(c.adherencia ?? 0, EMOTICONOS_ADHERENCIA)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${getAdherenciaBarColor(c.adherencia ?? 0)}`}
                                                                style={{ width: `${((c.adherencia ?? 0) / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold">{c.adherencia}/10</span>
                                                    </div>
                                                </div>

                                                <div className="p-3 rounded-lg border border-[#D1D1D6] bg-[#F2F2F4]/30">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-gray-500">Energía</span>
                                                        <span className="text-lg">{getEmoticono(c.energia ?? 0, EMOTICONOS_ENERGIA)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all"
                                                                style={{ background: '#A1A1A6', width: `${((c.energia ?? 0) / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold">{c.energia}/10</span>
                                                    </div>
                                                </div>

                                                <div className="p-3 rounded-lg border border-violet-200 bg-violet-50/30">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-gray-500">Sueño</span>
                                                        <span className="text-lg">{getEmoticono(c.sueno ?? 0, EMOTICONOS_SUENO)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-violet-500 transition-all"
                                                                style={{ width: `${((c.sueno ?? 0) / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold">{c.sueno}/10</span>
                                                    </div>
                                                </div>

                                                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-gray-500">Peso</span>
                                                    </div>
                                                    <p className="text-lg font-bold text-gray-800">
                                                        {c.peso ? `${c.peso.toFixed(1)} kg` : '—'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Notas del cliente */}
                                            {tieneNotas && (
                                                <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <MessageSquareText size={12} className="text-gray-400" />
                                                        <span className="text-xs font-medium text-gray-500">Tus notas</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.notas}</p>
                                                </div>
                                            )}

                                            {/* Mensaje IA automático (solo si NO hay nota del coach) */}
                                            {c.mensaje_coach_ia && !c.nota_coach && (
                                                <div className="mt-3 p-3 rounded-xl border" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <span className="text-xs">🤖</span>
                                                        <span className="text-xs font-semibold" style={{ color: '#15803D' }}>Análisis automático</span>
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#14532D' }}>{c.mensaje_coach_ia}</p>
                                                </div>
                                            )}

                                            {/* Nota del coach */}
                                            {c.nota_coach && (
                                                <div className="mt-3 p-3 rounded-xl border" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <MessageSquareText size={12} style={{ color: '#2563EB' }} />
                                                        <span className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>Respuesta de tu coach</span>
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#1E3A5F' }}>{c.nota_coach}</p>
                                                </div>
                                            )}

                                            <p className="text-[10px] text-gray-400 mt-2 text-right">
                                                Registrado: {new Date(c.created_at).toLocaleString('es-ES')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Paginación */}
                    {data && data.totalPages > 1 && (
                        <div className="flex items-center justify-between card">
                            <button
                                onClick={() => cambiarPagina(page - 1)}
                                disabled={page <= 1}
                                className="btn btn-ghost btn-sm disabled:opacity-30"
                            >
                                <ChevronLeft size={14} />
                                Anterior
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(data.totalPages, 5) }, (_, i) => {
                                    let pageNum: number
                                    if (data.totalPages <= 5) {
                                        pageNum = i + 1
                                    } else if (page <= 3) {
                                        pageNum = i + 1
                                    } else if (page >= data.totalPages - 2) {
                                        pageNum = data.totalPages - 4 + i
                                    } else {
                                        pageNum = page - 2 + i
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => cambiarPagina(pageNum)}
                                            className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === pageNum
                                                ? 'bg-teal-500 text-white'
                                                : 'text-gray-500 hover:bg-gray-100'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={() => cambiarPagina(page + 1)}
                                disabled={page >= (data.totalPages)}
                                className="btn btn-ghost btn-sm disabled:opacity-30"
                            >
                                Siguiente
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}

                    {/* Info de página */}
                    {data && (
                        <p className="text-center text-[10px] text-gray-400">
                            Mostrando {checkinsVisibles.length} de {total} check-ins · Página {page} de {data.totalPages}
                        </p>
                    )}
                </>
            )}
        </div>
    )
}
