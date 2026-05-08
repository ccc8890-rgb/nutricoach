'use client'

import { useState } from 'react'
import { FileText, Loader2, Sparkles, AlertTriangle, Smile, Meh, RefreshCw, CalendarDays, TrendingUp, Heart, Lightbulb } from 'lucide-react'
import type { InformeSemanal } from '@/lib/deepseek'
import { useToast } from '@/components/ui/Toast'

interface Props {
    clienteId: string
}

const ESTADO_ICON: Record<string, { icon: typeof Smile; color: string; bg: string; label: string }> = {
    positivo: { icon: Smile, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', label: 'Positivo' },
    neutro: { icon: Meh, color: 'text-[#8E8E93]', bg: 'bg-[#F2F2F4] dark:bg-[#A1A1A6]/20', label: 'Neutro' },
    atencion: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Requiere atención' },
}

export default function InformeSemanal({ clienteId }: Props) {
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [informe, setInforme] = useState<InformeSemanal | null>(null)
    const [meta, setMeta] = useState<{ cliente?: string; periodo?: string; total_checkins?: number; total_pesos?: number } | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleGenerar() {
        setLoading(true)
        setError(null)
        setInforme(null)

        try {
            const res = await fetch(`/api/clientes/${clienteId}/informe-semanal`, {
                method: 'POST',
            })
            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || 'Error al generar informe')
            }

            setInforme(json.informe)
            setMeta(json.meta)
            addToast({
                type: 'success',
                title: 'Informe generado',
                message: 'DeepSeek ha analizado los datos de la última semana',
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido'
            setError(msg)
            addToast({ type: 'error', title: 'Error', message: msg })
        } finally {
            setLoading(false)
        }
    }

    const estado = informe ? ESTADO_ICON[informe.estado_general] || ESTADO_ICON.neutro : null
    const EstadoIcon = estado?.icon || Meh

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <FileText size={18} className="text-teal-600" />
                    Informe Semanal Automático
                </h2>
                <button
                    className="btn-primary btn-sm flex items-center gap-1.5"
                    onClick={handleGenerar}
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Sparkles size={14} />
                    )}
                    {loading ? 'Generando...' : informe ? 'Regenerar informe' : 'Generar informe'}
                </button>
            </div>

            {/* Meta info */}
            {meta && (
                <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        Periodo: {meta.periodo}
                    </span>
                    <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        {meta.total_pesos} registros de peso
                    </span>
                    <span className="flex items-center gap-1">
                        <Heart size={12} />
                        {meta.total_checkins} check-ins
                    </span>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300">Error al generar informe</p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
                            <button
                                className="mt-2 text-xs text-red-700 dark:text-red-300 underline hover:no-underline flex items-center gap-1"
                                onClick={handleGenerar}
                            >
                                <RefreshCw size={12} /> Reintentar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Estado vacío */}
            {!informe && !loading && !error && (
                <div className="text-center py-8">
                    <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">Aún no has generado ningún informe</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Pulsa "Generar informe" para que DeepSeek analice los datos de la última semana del cliente
                    </p>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
                </div>
            )}

            {/* Contenido del informe */}
            {informe && (
                <div className="space-y-4">
                    {/* Estado general badge */}
                    {estado && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${estado.bg} ${estado.color}`}>
                            <EstadoIcon size={16} />
                            {estado.label}
                        </div>
                    )}

                    {/* Resumen */}
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {informe.resumen}
                        </p>
                    </div>

                    {/* Grid de análisis */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/30">
                            <div className="flex items-center gap-2 mb-1.5">
                                <TrendingUp size={14} className="text-blue-500" />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Peso</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{informe.evolucion_peso}</p>
                        </div>
                        <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/30">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Heart size={14} className="text-green-500" />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Adherencia</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{informe.adherencia}</p>
                        </div>
                        <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/30">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Smile size={14} style={{ color: '#A1A1A6' }} />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Energía</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{informe.energia}</p>
                        </div>
                    </div>

                    {/* Recomendaciones */}
                    <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/30">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb size={16} className="text-teal-600" />
                            <span className="text-sm font-medium text-teal-800 dark:text-teal-300">Recomendaciones</span>
                        </div>
                        <ul className="space-y-2">
                            {informe.recomendaciones.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-teal-700 dark:text-teal-200">
                                    <span className="text-teal-500 mt-0.5 flex-shrink-0">•</span>
                                    {rec}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Botón para copiar resumen al portapapeles */}
                    <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                        <button
                            className="btn-secondary btn-sm flex items-center gap-1.5"
                            onClick={async () => {
                                const textoNota = `📋 Informe semanal\n\n${informe.resumen}\n\n${informe.recomendaciones.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
                                try {
                                    await navigator.clipboard?.writeText(textoNota)
                                    addToast({
                                        type: 'success',
                                        title: 'Copiado al portapapeles',
                                        message: 'Puedes pegarlo en las notas del cliente',
                                    })
                                } catch {
                                    addToast({ type: 'error', title: 'Error', message: 'No se pudo copiar' })
                                }
                            }}
                        >
                            <FileText size={14} />
                            Copiar resumen
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
