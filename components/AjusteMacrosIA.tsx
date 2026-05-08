'use client'

import { useState } from 'react'
import { Brain, Loader2, Check, X, RefreshCw, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import type { SugerenciaMacros } from '@/lib/deepseek'

interface Props {
    clienteId: string
    /** Callback cuando se aplican los macros para refrescar la UI padre */
    onApplied?: () => void
}

export default function AjusteMacrosIA({ clienteId, onApplied }: Props) {
    const { addToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [aplicando, setAplicando] = useState(false)
    const [sugerencia, setSugerencia] = useState<SugerenciaMacros | null>(null)
    const [planActual, setPlanActual] = useState<{ kcal: number; proteinas: number; carbohidratos: number; grasas: number } | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleRecalcular() {
        setLoading(true)
        setError(null)
        setSugerencia(null)

        try {
            const res = await fetch(`/api/clientes/${clienteId}/recalcular-macros`, {
                method: 'POST',
            })
            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || 'Error al recalcular macros')
            }

            setSugerencia(json.sugerencia)
            setPlanActual(json.planActual)
            addToast({
                type: 'success',
                title: 'Recálculo completado',
                message: 'DeepSeek ha analizado la evolución del cliente',
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido'
            setError(msg)
            addToast({ type: 'error', title: 'Error', message: msg })
        } finally {
            setLoading(false)
        }
    }

    async function handleAplicar() {
        if (!sugerencia) return
        setAplicando(true)

        try {
            // Aplicar los nuevos macros al plan activo
            const { error: err } = await supabase
                .from('planes_nutricion')
                .update({
                    kcal_objetivo: sugerencia.kcal,
                    proteinas_objetivo: sugerencia.proteinas,
                    carbohidratos_objetivo: sugerencia.carbohidratos,
                    grasas_objetivo: sugerencia.grasas,
                })
                .eq('cliente_id', clienteId)
                .eq('activo', true)

            if (err) throw new Error(err.message)

            addToast({
                type: 'success',
                title: 'Macros actualizados',
                message: 'Los nuevos macros se han aplicado al plan activo',
            })
            setSugerencia(null)
            onApplied?.()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al aplicar macros'
            addToast({ type: 'error', title: 'Error', message: msg })
        } finally {
            setAplicando(false)
        }
    }

    function handleRechazar() {
        setSugerencia(null)
        setError(null)
        addToast({ type: 'info', title: 'Descartado', message: 'La sugerencia ha sido descartada' })
    }

    function diffColor(actual: number | undefined, nuevo: number, label: string): string {
        if (!actual || actual === 0) return 'text-gray-800 dark:text-gray-200'
        const diff = nuevo - actual
        if (Math.abs(diff) < 5) return 'text-gray-800 dark:text-gray-200'
        // Para kcal, incremento es positivo si baja peso; para macros depende
        if (label === 'kcal') {
            return diff > 0 ? 'text-amber-600' : 'text-green-600'
        }
        return diff > 0 ? 'text-green-600' : 'text-amber-600'
    }

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Brain size={20} className="text-purple-600" />
                    <h2 className="font-semibold text-gray-800 dark:text-gray-200">Ajuste IA de Macros</h2>
                </div>
                {!loading && !sugerencia && (
                    <button
                        onClick={handleRecalcular}
                        disabled={loading}
                        className="btn-secondary text-sm flex items-center gap-1.5"
                    >
                        <RefreshCw size={14} />
                        Recalcular con IA
                    </button>
                )}
            </div>

            {/* Estado de carga */}
            {loading && (
                <div className="flex flex-col items-center py-8 text-center">
                    <Loader2 size={32} className="animate-spin text-purple-500 mb-3" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Analizando evolución del cliente...</p>
                    <p className="text-xs text-gray-400 mt-1">DeepSeek está calculando los macros óptimos</p>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="p-4 rounded-lg text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <p className="font-medium text-red-800 mb-1">Error al recalcular</p>
                    <p className="text-red-600 text-xs">{error}</p>
                    <button
                        onClick={handleRecalcular}
                        className="mt-3 text-xs text-red-700 underline hover:no-underline"
                    >
                        Intentar de nuevo
                    </button>
                </div>
            )}

            {/* Sugerencia de macros */}
            {sugerencia && !loading && (
                <div className="space-y-4">
                    {/* Comparativa actual vs sugerido */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Calorías', key: 'kcal' as const, unit: 'kcal' },
                            { label: 'Proteínas', key: 'proteinas' as const, unit: 'g' },
                            { label: 'Carbohidratos', key: 'carbohidratos' as const, unit: 'g' },
                            { label: 'Grasas', key: 'grasas' as const, unit: 'g' },
                        ].map(({ label, key, unit }) => {
                            const actual = planActual?.[key]
                            const nuevo = sugerencia[key]
                            return (
                                <div key={key} className="p-3 rounded-lg border" style={{ borderColor: '#E2E8F0', background: '#FAFAFA' }}>
                                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                                    <div className="flex items-center gap-1.5">
                                        {actual ? (
                                            <>
                                                <span className="text-sm text-gray-400 line-through">{actual}</span>
                                                <ArrowRight size={12} className="text-gray-300" />
                                            </>
                                        ) : null}
                                        <span className={`text-lg font-bold ${diffColor(actual, nuevo, label)}`}>
                                            {nuevo}
                                            <span className="text-sm font-normal text-gray-400 ml-0.5">{unit}</span>
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Razonamiento */}
                    <div className="p-3 rounded-lg text-sm" style={{ background: '#F5F3FF', border: '1px solid #EDE9FE' }}>
                        <p className="font-medium text-purple-800 text-xs mb-1">🔍 Razonamiento de IA</p>
                        <p className="text-purple-700 text-sm">{sugerencia.razonamiento}</p>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleAplicar}
                            disabled={aplicando}
                            className="btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                            {aplicando ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Check size={16} />
                            )}
                            {aplicando ? 'Aplicando...' : 'Aplicar nuevos macros'}
                        </button>
                        <button
                            onClick={handleRechazar}
                            disabled={aplicando}
                            className="btn-secondary flex items-center gap-2 px-4"
                        >
                            <X size={16} />
                            Descartar
                        </button>
                    </div>
                </div>
            )}

            {/* Estado vacío */}
            {!loading && !sugerencia && !error && (
                <p className="text-sm text-gray-400 text-center py-4">
                    Haz clic en "Recalcular con IA" para analizar la evolución del cliente y obtener una sugerencia de macros ajustada a su progreso.
                </p>
            )}
        </div>
    )
}
