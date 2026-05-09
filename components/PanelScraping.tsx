'use client'

import { useState, useEffect } from 'react'
import {
    Bot, Loader2, Check, AlertCircle, ExternalLink,
    RefreshCw, Clock, TrendingUp, ChevronDown, ChevronUp,
    Sparkles, ShoppingCart, Database, WifiOff
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { Supermercado } from '@/types'

interface ScrapingResult {
    supermercado_id: string
    supermercado_nombre: string
    total_procesados: number
    nuevos_productos: number
    actualizados: number
    no_encontrados: number
    errores: string[]
    duracion_ms: number
    fecha_scraping: string
}

export default function PanelScraping() {
    const { addToast } = useToast()
    const [supermercados, setSupermercados] = useState<Supermercado[]>([])
    const [scrapeando, setScrapeando] = useState<string | null>(null)
    const [resultados, setResultados] = useState<ScrapingResult[]>([])
    const [expandido, setExpandido] = useState<string | null>(null)
    const [scrapingTodos, setScrapingTodos] = useState(false)
    const [cargandoSupermercados, setCargandoSupermercados] = useState(true)
    const [errorSupermercados, setErrorSupermercados] = useState<string | null>(null)

    useEffect(() => {
        let cancelado = false
        setCargandoSupermercados(true)
        setErrorSupermercados(null)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

        fetch('/api/precios/supermercados', { signal: controller.signal })
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
                    throw new Error(err.error || err.detalle || `HTTP ${res.status}`)
                }
                return res.json()
            })
            .then(data => {
                if (cancelado) return
                if (!Array.isArray(data)) {
                    throw new Error('Respuesta inesperada del servidor')
                }
                console.log('[PanelScraping] Supermercados cargados:', data.length)
                setSupermercados(data)
                if (data.length === 0) {
                    setErrorSupermercados('No hay supermercados en la base de datos. Ejecuta el SQL de seed en Supabase.')
                }
            })
            .catch(err => {
                if (cancelado) return
                const msg = err instanceof Error ? err.message : String(err)
                console.error('[PanelScraping] Error cargando supermercados:', msg)
                setErrorSupermercados(msg)
                addToast({ type: 'error', title: 'Error al cargar supermercados', message: msg })
            })
            .finally(() => {
                if (!cancelado) setCargandoSupermercados(false)
                clearTimeout(timeout)
            })

        return () => {
            cancelado = true
            controller.abort()
            clearTimeout(timeout)
        }
    }, [])

    async function scrapear(supermercadoId: string, nombre: string) {
        setScrapeando(supermercadoId)
        try {
            const res = await fetch('/api/precios/scrapear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supermercado_id: supermercadoId }),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al scrapear')
            }

            const data: ScrapingResult = await res.json()
            setResultados(prev => [data, ...prev])
            setExpandido(data.supermercado_id)

            addToast({
                type: data.errores.length > 0 ? 'warning' : 'success',
                title: `Scraping: ${nombre}`,
                message: `${data.total_procesados} productos · ${data.nuevos_productos} nuevos · ${data.actualizados} actualizados · ${data.no_encontrados} sin match`,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            addToast({ type: 'error', title: `Error en ${nombre}`, message: msg })
        } finally {
            setScrapeando(null)
        }
    }

    async function scrapearTodos() {
        setScrapingTodos(true)
        try {
            const res = await fetch('/api/precios/scrapear')

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al scrapear todos')
            }

            const data = await res.json()
            setResultados(prev => [...data.resultados, ...prev])

            addToast({
                type: 'success',
                title: 'Scraping completado',
                message: `${data.resultados.length} supermercados procesados`,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            addToast({ type: 'error', title: 'Error', message: msg })
        } finally {
            setScrapingTodos(false)
        }
    }

    function formatearMs(ms: number): string {
        if (ms < 1000) return `${ms} ms`
        return `${(ms / 1000).toFixed(1)} s`
    }

    function getSupermercadoColor(id: string): string {
        return supermercados.find(s => s.id === id)?.color || '#16A34A'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                        <Bot size={20} className="inline mr-2" />
                        Panel de Scraping Automático
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Extrae precios automáticamente de los supermercados usando sus APIs públicas
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={scrapearTodos}
                        disabled={scrapingTodos}
                        className="btn-primary flex items-center gap-2 px-4 py-2"
                    >
                        {scrapingTodos ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <RefreshCw size={16} />
                        )}
                        {scrapingTodos ? 'Scrapeando todos...' : 'Scrapear todos'}
                    </button>
                </div>
            </div>

            {/* Estado de carga */}
            {cargandoSupermercados && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Supermercados disponibles
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="card p-4 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                                    <div className="h-4 bg-gray-200 rounded w-28" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error de carga */}
            {!cargandoSupermercados && errorSupermercados && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                    <Database size={48} className="mx-auto mb-3 text-red-400" />
                    <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                        No se pudieron cargar los supermercados
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mb-4 max-w-md mx-auto">
                        {errorSupermercados}
                    </p>
                    <div className="text-xs text-left bg-red-100 dark:bg-red-900/40 rounded-lg p-4 max-w-lg mx-auto space-y-2">
                        <p className="font-medium text-red-700 dark:text-red-300">Posibles causas:</p>
                        <ul className="list-disc ml-4 space-y-1 text-red-600 dark:text-red-400">
                            <li>El SQL de migración no se ha ejecutado en Supabase</li>
                            <li>La tabla <code>supermercados</code> no existe</li>
                            <li>La clave <code>SUPABASE_SERVICE_ROLE_KEY</code> no está configurada en <code>.env.local</code></li>
                        </ul>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-3 btn-secondary text-xs px-3 py-1.5"
                        >
                            <RefreshCw size={12} className="inline mr-1" /> Reintentar
                        </button>
                    </div>
                </div>
            )}

            {/* Estado de scrapers */}
            {!cargandoSupermercados && !errorSupermercados && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Supermercados disponibles
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {supermercados.map(sm => {
                            const tieneScraper = sm.tiene_scraper === true
                            return (
                                <div
                                    key={sm.id}
                                    className="card flex items-center justify-between p-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: tieneScraper ? '#22C55E' : '#9CA3AF' }}
                                        />
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                                                {sm.nombre}
                                            </p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {tieneScraper ? '🟢 Scraper disponible' : '⚪ Pendiente de implementar'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => scrapear(sm.id, sm.nombre)}
                                        disabled={scrapeando === sm.id || !tieneScraper}
                                        className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-40"
                                        title={!tieneScraper ? 'Scraper no implementado aún' : 'Scrapear ahora'}
                                    >
                                        {scrapeando === sm.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <ShoppingCart size={14} />
                                        )}
                                        {scrapeando === sm.id ? 'Scrapeando...' : 'Scrapear'}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Resultados de scraping */}
            {resultados.length > 0 && (
                <div className="space-y-3">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Historial de scraping
                    </p>
                    {resultados.map((r, idx) => (
                        <div key={`${r.supermercado_id}-${idx}`} className="card overflow-hidden">
                            {/* Header del resultado */}
                            <button
                                onClick={() => setExpandido(expandido === r.supermercado_id ? null : r.supermercado_id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: getSupermercadoColor(r.supermercado_id) }}
                                    />
                                    <div className="text-left">
                                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                                            {r.supermercado_nombre}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(r.fecha_scraping).toLocaleString('es-ES')} · {formatearMs(r.duracion_ms)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Stats rápidas */}
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="flex items-center gap-1 text-green-600">
                                            <Check size={12} /> {r.actualizados}
                                        </span>
                                        <span className="flex items-center gap-1 text-blue-600">
                                            <Sparkles size={12} /> {r.nuevos_productos}
                                        </span>
                                        {r.no_encontrados > 0 && (
                                            <span className="flex items-center gap-1 text-orange-500">
                                                <AlertCircle size={12} /> {r.no_encontrados}
                                            </span>
                                        )}
                                        {r.errores.length > 0 && (
                                            <span className="flex items-center gap-1 text-red-500">
                                                <AlertCircle size={12} /> {r.errores.length}
                                            </span>
                                        )}
                                    </div>
                                    {expandido === r.supermercado_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </button>

                            {/* Detalle expandido */}
                            {expandido === r.supermercado_id && (
                                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                    {/* Métricas */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-green-600">{r.total_procesados}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Procesados</p>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-blue-600">{r.actualizados}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Actualizados</p>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-purple-600">{r.nuevos_productos}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nuevos alimentos</p>
                                        </div>
                                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                                            <p className="text-lg font-bold text-orange-500">{r.no_encontrados}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin match</p>
                                        </div>
                                    </div>

                                    {/* Errores */}
                                    {r.errores.length > 0 && (
                                        <div className="mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                                            <p className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1">
                                                <AlertCircle size={12} /> Errores ({r.errores.length})
                                            </p>
                                            <ul className="text-xs space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                {r.errores.map((err, i) => (
                                                    <li key={i} className="ml-4 list-disc">{err}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                                        Duración: {formatearMs(r.duracion_ms)} · {new Date(r.fecha_scraping).toLocaleString('es-ES')}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Estado vacío */}
            {resultados.length === 0 && (
                <div className="text-center py-12">
                    <Bot size={48} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Sin scraping todavía</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Haz clic en "Scrapear" en cualquier supermercado para empezar a extraer precios automáticamente
                    </p>
                </div>
            )}
        </div>
    )
}
