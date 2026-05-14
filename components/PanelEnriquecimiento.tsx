'use client'

import { useState, useEffect, useRef } from 'react'
import {
    Sparkles, Loader2, Check, AlertCircle, Database,
    RefreshCw, ChevronDown, ChevronUp, Brain, Nut, StopCircle,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { AlimentoPendienteEnriquecer } from '@/types'

interface StatsEnriquecimiento {
    total_pendientes: number
    total_completados: number
    total_errores: number
    total_alimentos_en_db: number
    supermercados_con_precios: number
    productos_con_precio: number
}

interface ResultadoEjecucion {
    total_pendientes: number
    procesados: number
    actualizados: number
    errores: string[]
    duracion_ms: number
}

interface ProgresoEnriquecimiento {
    tipo: 'progreso'
    procesados: number
    total: number
    actualizados: number
    errores: number
    porcentaje: number
}

export default function PanelEnriquecimiento() {
    const { addToast } = useToast()
    const [stats, setStats] = useState<StatsEnriquecimiento | null>(null)
    const [pendientes, setPendientes] = useState<AlimentoPendienteEnriquecer[]>([])
    const [cargando, setCargando] = useState(true)
    const [enriqueciendo, setEnriqueciendo] = useState(false)
    const [expandido, setExpandido] = useState(false)
    const [limite, setLimite] = useState(50)
    const [resultado, setResultado] = useState<ResultadoEjecucion | null>(null)
    const [progreso, setProgreso] = useState<ProgresoEnriquecimiento | null>(null)

    const abortRef = useRef<AbortController | null>(null)
    const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Auto-refresh cada 30s cuando hay pendientes
    useEffect(() => {
        if (stats && stats.total_pendientes > 0 && !enriqueciendo) {
            autoRefreshRef.current = setInterval(() => {
                cargarStats()
            }, 30000)
        }

        return () => {
            if (autoRefreshRef.current) {
                clearInterval(autoRefreshRef.current)
                autoRefreshRef.current = null
            }
        }
    }, [stats?.total_pendientes, enriqueciendo])

    useEffect(() => {
        cargarStats()
    }, [])

    async function cargarStats() {
        setCargando(true)
        try {
            const res = await fetch('/api/precios/enriquecer?accion=stats')
            if (!res.ok) throw new Error('Error al cargar estadísticas')
            const data = await res.json()
            setStats(data)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            addToast({ type: 'error', title: 'Error', message: msg })
        } finally {
            setCargando(false)
        }
    }

    async function cargarPendientes() {
        try {
            const res = await fetch(`/api/precios/enriquecer?accion=pendientes&limite=${limite}`)
            if (!res.ok) throw new Error('Error al cargar pendientes')
            const data = await res.json()
            setPendientes(data)
            setExpandido(true)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            addToast({ type: 'error', title: 'Error', message: msg })
        }
    }

    async function ejecutarEnriquecimiento() {
        setEnriqueciendo(true)
        setResultado(null)
        setProgreso(null)

        const abortController = new AbortController()
        abortRef.current = abortController

        try {
            const res = await fetch('/api/precios/enriquecer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limite, stream: true }),
                signal: abortController.signal,
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al enriquecer')
            }

            // ── Leer SSE stream ──
            const reader = res.body?.getReader()
            if (!reader) throw new Error('No se pudo obtener el stream de datos')

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || '' // guardar resto incompleto

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (data.tipo === 'progreso') {
                                setProgreso(data)
                            } else if (data.tipo === 'completado') {
                                const { tipo, ...resto } = data
                                setResultado(resto as ResultadoEjecucion)
                                addToast({
                                    type: resto.errores?.length > 0 ? 'warning' : 'success',
                                    title: 'Enriquecimiento completado',
                                    message: `${resto.actualizados}/${resto.total_pendientes} alimentos actualizados · ${resto.errores?.length ?? 0} errores`,
                                })
                                // Recargar stats
                                await cargarStats()
                                if (pendientes.length > 0) await cargarPendientes()
                            } else if (data.tipo === 'error') {
                                throw new Error(data.error)
                            }
                        } catch (parseErr) {
                            // Ignorar líneas malformadas
                            if (parseErr instanceof Error && parseErr.message.startsWith('Error al enriquecer')) {
                                throw parseErr
                            }
                        }
                    }
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                addToast({
                    type: 'info',
                    title: 'Cancelado',
                    message: 'Enriquecimiento cancelado por el usuario',
                })
                // Recargar stats para reflejar cambios parciales
                await cargarStats()
            } else {
                const msg = err instanceof Error ? err.message : String(err)
                addToast({ type: 'error', title: 'Error en enriquecimiento', message: msg })
            }
        } finally {
            setEnriqueciendo(false)
            setProgreso(null)
            abortRef.current = null
        }
    }

    function cancelarEnriquecimiento() {
        abortRef.current?.abort()
    }

    function formatearMs(ms: number): string {
        if (ms < 1000) return `${ms} ms`
        if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
        return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                        <Brain size={20} className="inline mr-2" />
                        Enriquecimiento Nutricional por IA
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Rellena macros y categoriza alimentos automáticamente con DeepSeek
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Límite:
                        </label>
                        <select
                            value={limite}
                            onChange={e => setLimite(Number(e.target.value))}
                            className="text-sm border rounded px-2 py-1"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                        </select>
                    </div>

                    {enriqueciendo ? (
                        <button
                            onClick={cancelarEnriquecimiento}
                            className="btn-danger flex items-center gap-2 px-4 py-2"
                        >
                            <StopCircle size={16} />
                            Cancelar
                        </button>
                    ) : (
                        <button
                            onClick={ejecutarEnriquecimiento}
                            disabled={enriqueciendo || (stats?.total_pendientes ?? 0) === 0}
                            className="btn-primary flex items-center gap-2 px-4 py-2"
                        >
                            {enriqueciendo ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Sparkles size={16} />
                            )}
                            Enriquecer con IA
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de progreso en vivo (SSE) */}
            {enriqueciendo && progreso && (
                <div className="card p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Enriqueciendo...
                        </span>
                        <span className="text-xs font-medium text-blue-600">
                            {progreso.porcentaje}%
                        </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5 mb-3">
                        <div
                            className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${progreso.porcentaje}%` }}
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                            <span className="font-medium text-blue-700 dark:text-blue-300">{progreso.procesados}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>procesados</span>
                        </div>
                        <div>
                            <span className="font-medium text-blue-700 dark:text-blue-300">{progreso.total}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>total</span>
                        </div>
                        <div>
                            <span className="font-medium text-green-600">{progreso.actualizados}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>actualizados</span>
                        </div>
                        <div>
                            <span className="font-medium text-red-500">{progreso.errores}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>errores</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats cards */}
            {cargando ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card p-4 animate-pulse">
                            <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
                            <div className="h-3 bg-gray-200 rounded w-20" />
                        </div>
                    ))}
                </div>
            ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{stats.total_alimentos_en_db}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total alimentos</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-orange-500">{stats.total_pendientes}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pendientes de IA</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{stats.total_completados}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Completados</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-red-500">{stats.total_errores}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Errores</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{stats.supermercados_con_precios}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Supermercados activos</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{stats.productos_con_precio}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Productos con precio</p>
                    </div>
                </div>
            ) : null}

            {/* Resultado de ejecución */}
            {resultado && !enriqueciendo && (
                <div className="card p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Check size={18} className="text-green-600" />
                        <span className="font-semibold text-green-700 dark:text-green-300">
                            Enriquecimiento completado
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                            <span className="text-green-600 font-medium">{resultado.total_pendientes}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>pendientes</span>
                        </div>
                        <div>
                            <span className="text-blue-600 font-medium">{resultado.procesados}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>procesados</span>
                        </div>
                        <div>
                            <span className="text-green-600 font-medium">{resultado.actualizados}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>actualizados</span>
                        </div>
                        <div>
                            <span className="text-orange-500 font-medium">{formatearMs(resultado.duracion_ms)}</span>
                            {' '}<span style={{ color: 'var(--text-muted)' }}>duración</span>
                        </div>
                    </div>
                    {resultado.errores.length > 0 && (
                        <div className="mt-2 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                            <p className="text-xs text-red-600 font-medium mb-1">Errores ({resultado.errores.length}):</p>
                            <ul className="text-xs space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {resultado.errores.slice(0, 5).map((e, i) => (
                                    <li key={i} className="ml-4 list-disc">{e}</li>
                                ))}
                                {resultado.errores.length > 5 && (
                                    <li className="ml-4 text-red-400">... y {resultado.errores.length - 5} más</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Botón ver pendientes */}
            <div className="flex items-center gap-3">
                <button
                    onClick={cargarPendientes}
                    className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-sm"
                >
                    <Database size={14} />
                    Ver alimentos pendientes
                </button>
                <button
                    onClick={cargarStats}
                    className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-sm"
                    title="Actualizar estadísticas"
                >
                    <RefreshCw size={14} />
                    Actualizar
                </button>
                {pendientes.length > 0 && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {pendientes.length} alimentos cargados
                    </span>
                )}
            </div>

            {/* Lista de pendientes */}
            {expandido && pendientes.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Alimentos pendientes de enriquecer
                    </p>
                    <div className="max-h-96 overflow-y-auto space-y-1">
                        {pendientes.map((a) => (
                            <div
                                key={a.id}
                                className="card flex items-center justify-between p-3"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Nut size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                            {a.nombre}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {a.categoria || 'Sin categoría'}
                                            {a.supermercados ? ` · ${a.supermercados}` : ''}
                                            {a.num_precios > 0 ? ` · ${a.num_precios} precio(s)` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    {a.estado_enriquecimiento === 'completado' && (
                                        <span className="text-xs text-green-600 flex items-center gap-1">
                                            <Check size={12} /> OK
                                        </span>
                                    )}
                                    {a.estado_enriquecimiento === 'error' && (
                                        <span className="text-xs text-red-500 flex items-center gap-1" title={a.error_ia ?? ''}>
                                            <AlertCircle size={12} /> Error
                                        </span>
                                    )}
                                    {(!a.estado_enriquecimiento || a.estado_enriquecimiento === 'pendiente') && (
                                        <span className="text-xs text-orange-500">Pendiente</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Estado vacío */}
            {!cargando && stats && stats.total_pendientes === 0 && (
                <div className="text-center py-12">
                    <Check size={48} className="mx-auto mb-3 text-green-400" />
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                        ¡Todos los alimentos tienen macros!
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        No hay alimentos pendientes de enriquecer. Cuando añadas nuevos productos,
                        aparecerán aquí para procesarlos con IA.
                    </p>
                </div>
            )}

            {/* Info sobre costes */}
            <div className="card p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10">
                <div className="flex items-start gap-3">
                    <Sparkles size={20} className="text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            ¿Cómo funciona?
                        </p>
                        <ul className="text-xs mt-2 space-y-1" style={{ color: 'var(--text-secondary)' }}>
                            <li>1️⃣ Los alimentos se envían en lotes de 25 a DeepSeek vía Vercel AI SDK</li>
                            <li>2️⃣ La IA asigna macros (kcal, proteinas, carbohidratos, grasas) por 100g</li>
                            <li>3️⃣ Clasifica cada alimento en la categoría nutricional más precisa</li>
                            <li>4️⃣ Se actualizan automáticamente en la base de datos</li>
                            <li>5️⃣ Usa estos datos para calcular escandallo de recetas y costes por cliente</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
