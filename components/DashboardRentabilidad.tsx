'use client'

import { useState, useEffect } from 'react'
import {
    Store, TrendingDown, TrendingUp,
    Loader2, AlertCircle, CalendarDays, PiggyBank,
} from 'lucide-react'
import type { ComparativaSupermercados, ProyeccionAhorro } from '@/types'
import ComparadorSupermercados from './ComparadorSupermercados'

interface Props {
    clienteId?: string
    planId?: string
}

function formatearEur(n: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(n)
}

type TabComparativa = 'semanal' | 'mensual' | 'anual'

export default function DashboardRentabilidad({ clienteId, planId }: Props) {
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [errorProyeccion, setErrorProyeccion] = useState<string | null>(null)
    const [comparativa, setComparativa] = useState<ComparativaSupermercados | null>(null)
    const [proyeccion, setProyeccion] = useState<ProyeccionAhorro | null>(null)
    const [cargandoProyeccion, setCargandoProyeccion] = useState(false)
    const [tabComparativa, setTabComparativa] = useState<TabComparativa>('semanal')
    // Guardamos UUIDs de supermercados para evitar problemas con nombres/slugs
    const [superBaseId, setSuperBaseId] = useState('')
    const [superAhorroId, setSuperAhorroId] = useState('')

    // Cargar comparativa al montar
    useEffect(() => {
        if (!clienteId && !planId) return
        cargarComparativa()
    }, [clienteId, planId])

    async function cargarComparativa() {
        setCargando(true)
        setError(null)
        setProyeccion(null)
        setErrorProyeccion(null)
        try {
            const res = await fetch('/api/precios/ahorro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clienteId ? { cliente_id: clienteId } : { plan_id: planId }),
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || `Error ${res.status}`)
            }
            const data: ComparativaSupermercados = await res.json()
            setComparativa(data)

            // Inicializar selectores de proyección con UUIDs
            if (data.supermercados.length >= 2) {
                setSuperBaseId(data.supermercados[0].id)
                setSuperAhorroId(data.supermercados[data.supermercados.length - 1].id)
            } else if (data.supermercados.length === 1) {
                setSuperBaseId(data.supermercados[0].id)
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setError(msg)
        } finally {
            setCargando(false)
        }
    }

    async function cargarProyeccion() {
        if (!clienteId || !superBaseId || !superAhorroId) return
        setCargandoProyeccion(true)
        try {
            const params = new URLSearchParams({
                cliente_id: clienteId,
                supermercado_base_id: superBaseId,
                supermercado_ahorro_id: superAhorroId,
            })
            const res = await fetch(`/api/precios/ahorro/proyeccion?${params}`)
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || `Error ${res.status}`)
            }
            const data: ProyeccionAhorro = await res.json()
            setProyeccion(data)
            setErrorProyeccion(null)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setErrorProyeccion(msg)
        } finally {
            setCargandoProyeccion(false)
        }
    }

    // ── Render ────────────────────────────────────────────

    if (!clienteId && !planId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                <Store className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Selecciona un cliente o plan</p>
                <p className="text-sm mt-1">Necesitamos un plan de nutrición para calcular la rentabilidad.</p>
            </div>
        )
    }

    if (cargando) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="ml-3 text-neutral-600 dark:text-neutral-400">Calculando rentabilidad...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-red-500">
                <AlertCircle className="w-12 h-12 mb-3 opacity-60" />
                <p className="text-lg font-medium">Error al cargar datos</p>
                <p className="text-sm mt-1 text-neutral-500">{error}</p>
                <button
                    onClick={cargarComparativa}
                    className="mt-4 px-4 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                    Reintentar
                </button>
            </div>
        )
    }

    if (!comparativa || comparativa.supermercados.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                <Store className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">Sin datos de precios</p>
                <p className="text-sm mt-1">Este plan no tiene alimentos con precios asociados aún.</p>
            </div>
        )
    }

    const { supermercados, ahorro_mensual, ahorro_anual, recomendado } = comparativa
    const mejor = supermercados[0]

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <PiggyBank className="w-6 h-6 text-emerald-600" />
                    <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                        📊 Dashboard de Rentabilidad
                    </h1>
                </div>
                <button
                    onClick={cargarComparativa}
                    className="px-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                    ↻ Actualizar
                </button>
            </div>

            {/* ── Cards de gasto por periodo ─────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <PeriodCard
                    label="Gasto semanal"
                    value={mejor.precio_total}
                    supermercado={mejor.nombre}
                    color={mejor.color}
                    icon={<CalendarDays className="w-5 h-5" />}
                    active={tabComparativa === 'semanal'}
                    onClick={() => setTabComparativa('semanal')}
                />
                <PeriodCard
                    label="Gasto mensual"
                    value={mejor.precio_total * 4.33}
                    supermercado={mejor.nombre}
                    color={mejor.color}
                    icon={<CalendarDays className="w-5 h-5" />}
                    active={tabComparativa === 'mensual'}
                    onClick={() => setTabComparativa('mensual')}
                />
                <PeriodCard
                    label="Gasto anual"
                    value={mejor.precio_total * 52}
                    supermercado={mejor.nombre}
                    color={mejor.color}
                    icon={<CalendarDays className="w-5 h-5" />}
                    active={tabComparativa === 'anual'}
                    onClick={() => setTabComparativa('anual')}
                />
                <PeriodCard
                    label="Ahorro vs más caro"
                    value={(supermercados[supermercados.length - 1]?.precio_total ?? 0) - mejor.precio_total}
                    supermercado={recomendado}
                    color={mejor.color}
                    icon={<TrendingDown className="w-5 h-5" />}
                    esAhorro
                    active={false}
                    onClick={() => { }}
                />
            </div>

            {/* ── Comparador completo ─────────────────── */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 sm:p-6">
                <ComparadorSupermercados data={comparativa} />
            </div>

            {/* ── Proyección de ahorro ────────────────── */}
            {clienteId && supermercados.length >= 2 && (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                            📈 Proyección de ahorro
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Supermercado base</label>
                            <select
                                value={superBaseId}
                                onChange={e => setSuperBaseId(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                            >
                                {supermercados.map(sm => (
                                    <option key={sm.id} value={sm.id}>{sm.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-medium text-neutral-500 mb-1">Comparar con</label>
                            <select
                                value={superAhorroId}
                                onChange={e => setSuperAhorroId(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                            >
                                {supermercados.filter(sm => sm.id !== superBaseId).map(sm => (
                                    <option key={sm.id} value={sm.id}>{sm.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={cargarProyeccion}
                            disabled={cargandoProyeccion}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            {cargandoProyeccion && <Loader2 className="w-4 h-4 animate-spin" />}
                            Calcular ahorro
                        </button>
                    </div>

                    {errorProyeccion && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                            {errorProyeccion}
                        </div>
                    )}

                    {proyeccion && !errorProyeccion && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                            <ProyeccionCard
                                label="Semanal"
                                valor={proyeccion.semanal}
                                periodo="semana"
                                diffPct={proyeccion.diferencia_porcentual}
                                superBase={proyeccion.supermercado_base}
                                superComparado={proyeccion.supermercado_comparado}
                            />
                            <ProyeccionCard
                                label="Mensual"
                                valor={proyeccion.mensual}
                                periodo="mes"
                                diffPct={proyeccion.diferencia_porcentual}
                                superBase={proyeccion.supermercado_base}
                                superComparado={proyeccion.supermercado_comparado}
                            />
                            <ProyeccionCard
                                label="Anual"
                                valor={proyeccion.anual}
                                periodo="año"
                                diffPct={proyeccion.diferencia_porcentual}
                                superBase={proyeccion.supermercado_base}
                                superComparado={proyeccion.supermercado_comparado}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ─── Tabla completa ──────────────────────────── */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        📋 Comparativa completa — todos los supermercados
                    </h3>
                </div>
                <div className="overflow-x-auto p-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                <th className="text-left px-3 py-2 font-medium text-neutral-500">Supermercado</th>
                                <th className="text-right px-3 py-2 font-medium text-neutral-500">
                                    {tabComparativa === 'semanal' ? 'Semanal' : tabComparativa === 'mensual' ? 'Mensual' : 'Anual'}
                                </th>
                                <th className="text-right px-3 py-2 font-medium text-neutral-500">Diff vs más barato</th>
                                <th className="text-right px-3 py-2 font-medium text-neutral-500">Diff %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supermercados.map((sm, idx) => {
                                const multiplicador = tabComparativa === 'semanal' ? 1 : tabComparativa === 'mensual' ? 4.33 : 52
                                const precioPeriodo = sm.precio_total * multiplicador
                                const diffPeriodo = (sm.precio_total - mejor.precio_total) * multiplicador
                                const diffPct = mejor.precio_total > 0
                                    ? ((sm.precio_total - mejor.precio_total) / mejor.precio_total) * 100
                                    : 0

                                return (
                                    <tr
                                        key={sm.id}
                                        className={`border-b border-neutral-100 dark:border-neutral-700/50 ${idx === 0 ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                                            }`}
                                    >
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full inline-block"
                                                    style={{ backgroundColor: sm.color || '#6b7280' }}
                                                />
                                                <span className={`font-medium ${idx === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-800 dark:text-neutral-200'
                                                    }`}>
                                                    {sm.nombre}
                                                    {idx === 0 && <span className="ml-1.5 text-[10px] bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">más barato</span>}
                                                    {idx === supermercados.length - 1 && supermercados.length > 1 && <span className="ml-1.5 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">más caro</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                                            {formatearEur(precioPeriodo)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            {diffPeriodo === 0 ? (
                                                <span className="text-neutral-400">—</span>
                                            ) : (
                                                <span className={diffPeriodo > 0 ? 'text-red-500' : 'text-emerald-600'}>
                                                    {diffPeriodo > 0 ? '+' : ''}{formatearEur(diffPeriodo)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            {diffPct === 0 ? (
                                                <span className="text-neutral-400">—</span>
                                            ) : (
                                                <span className={diffPct > 0 ? 'text-red-500' : 'text-emerald-600'}>
                                                    {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

// ── PeriodCard subcomponente ───────────────────────────

function PeriodCard({
    label, value, supermercado, color, icon, esAhorro, active, onClick,
}: {
    label: string
    value: number
    supermercado: string
    color: string
    icon: React.ReactNode
    esAhorro?: boolean
    active?: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`
                relative rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-md
                ${active
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : esAhorro
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                }
            `}
        >
            <div className="flex items-center gap-2 mb-2">
                <span className={esAhorro ? 'text-blue-600' : active ? 'text-emerald-600' : 'text-neutral-500'}>
                    {icon}
                </span>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${esAhorro ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-800 dark:text-neutral-100'
                }`}>
                {formatearEur(value)}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">
                {esAhorro ? `cambiando a ${supermercado}` : `en ${supermercado}`}
            </p>
            <div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl"
                style={{ backgroundColor: color || '#6b7280' }}
            />
        </button>
    )
}

// ── ProyeccionCard subcomponente ───────────────────────

function ProyeccionCard({
    label, valor, periodo, diffPct, superBase, superComparado,
}: {
    label: string
    valor: number
    periodo: string
    diffPct: number
    superBase: string
    superComparado: string
}) {
    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                Ahorro {label.toLowerCase()}
            </p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                {formatearEur(valor)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {superComparado} vs {superBase} · {diffPct.toFixed(1)}% menos por {periodo}
            </p>
        </div>
    )
}
