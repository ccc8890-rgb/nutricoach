'use client'

import { useMemo } from 'react'
import { TrendingDown, TrendingUp, Flame, Target, Activity, Moon, Zap, CalendarCheck } from 'lucide-react'

interface CheckIn {
    id: string
    fecha: string
    peso?: number
    adherencia?: number
    energia?: number
    sueno?: number
}

interface SeguimientoPeso {
    id: string
    fecha: string
    peso?: number
}

interface ProgresoChartsProps {
    checkins: CheckIn[]
    peso: SeguimientoPeso[]
    pesoInicial?: number
    objetivo?: string
}

/* ── Helper: calcular racha de check-ins consecutivos ── */
function calcularRacha(checkins: CheckIn[]): number {
    if (checkins.length === 0) return 0
    const sorted = [...checkins]
        .map(c => new Date(c.fecha))
        .sort((a, b) => b.getTime() - a.getTime())

    let racha = 1
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const diffHoy = Math.floor((hoy.getTime() - sorted[0].getTime()) / (1000 * 60 * 60 * 24))
    if (diffHoy > 2) return 0 // Si el último check-in fue hace más de 2 días, racha rota

    for (let i = 1; i < sorted.length; i++) {
        const diff = Math.floor((sorted[i - 1].getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24))
        if (diff === 1) racha++
        else break
    }
    return racha
}

/* ── Helper: formatear fecha ── */
function fmtFecha(date: Date): string {
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/* ── Línea de evolución de peso (SVG mejorado) ── */
function PesoChart({ data, pesoInicial }: { data: SeguimientoPeso[]; pesoInicial?: number }) {
    if (data.length < 2) {
        return (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                Necesitas al menos 2 registros de peso para ver la evolución
            </div>
        )
    }

    const sorted = [...data].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    const pesos = sorted.map(d => d.peso ?? 0).filter(p => p > 0)
    if (pesos.length < 2) return null

    const min = Math.min(...pesos) - 1
    const max = Math.max(...pesos) + 1
    const range = max - min || 1
    const W = 100
    const H = 40

    const points = pesos.map((p, i) => {
        const x = (i / (pesos.length - 1)) * W
        const y = H - ((p - min) / range) * H
        return `${x},${y}`
    }).join(' ')

    // Área bajo la curva
    const areaPoints = pesos.map((p, i) => {
        const x = (i / (pesos.length - 1)) * W
        const y = H - ((p - min) / range) * H
        return `${x},${y}`
    }).join(' ') + ` ${W},${H} 0,${H}`

    const ultimo = pesos[pesos.length - 1]
    const primero = pesos[0]
    const diff = ultimo - primero
    const diffColor = diff <= 0 ? '#10B981' : '#EF4444'

    // Progreso hacia el objetivo (si hay peso inicial)
    const progresoObjetivo = pesoInicial && pesoInicial !== ultimo
        ? ((pesoInicial - ultimo) / pesoInicial * 100).toFixed(1)
        : null

    return (
        <div>
            <div className="flex items-baseline gap-3 mb-2">
                <span className="text-2xl font-bold" style={{ color: diffColor }}>{ultimo.toFixed(1)} kg</span>
                <span className="text-sm flex items-center gap-1" style={{ color: diffColor }}>
                    {diff <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                    {Math.abs(diff).toFixed(1)} kg
                </span>
                {progresoObjetivo && (
                    <span className="text-xs text-gray-400 ml-auto">
                        {diff <= 0 ? '↓' : '↑'} {Math.abs(parseFloat(progresoObjetivo))}%
                    </span>
                )}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
                {/* Área */}
                <polygon
                    points={areaPoints}
                    fill={diffColor}
                    opacity="0.08"
                />
                {/* Línea de fondo */}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
                {/* Línea principal */}
                <polyline
                    points={points}
                    fill="none"
                    stroke={diffColor}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                />
                {/* Puntos */}
                {pesos.map((p, i) => {
                    const cx = (i / (pesos.length - 1)) * W
                    const cy = H - ((p - min) / range) * H
                    const esUltimo = i === pesos.length - 1
                    return (
                        <g key={i}>
                            <circle
                                cx={cx} cy={cy} r={esUltimo ? 2.2 : 1.5}
                                fill={esUltimo ? diffColor : 'white'}
                                stroke={diffColor}
                                strokeWidth="1.5"
                            />
                        </g>
                    )
                })}
            </svg>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{fmtFecha(new Date(sorted[0].fecha))}</span>
                <span>{fmtFecha(new Date(sorted[sorted.length - 1].fecha))}</span>
            </div>
        </div>
    )
}

/* ── Barras de adherencia (SVG) ── */
function AdherenciaChart({ data }: { data: CheckIn[] }) {
    const conAdherencia = data.filter(d => d.adherencia).slice(0, 7)
    if (conAdherencia.length === 0) {
        return (
            <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                Completa check-ins para ver tu adherencia
            </div>
        )
    }

    const BARS = conAdherencia.length
    const W = 100
    const H = 40

    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
                {conAdherencia.map((c, i) => {
                    const barW = (W / BARS) * 0.7
                    const gap = (W / BARS) * 0.3
                    const x = (i / BARS) * W + gap / 2
                    const h = ((c.adherencia ?? 5) / 10) * H
                    const color = (c.adherencia ?? 5) >= 7 ? '#10B981' : (c.adherencia ?? 5) >= 4 ? '#A1A1A6' : '#EF4444'
                    return (
                        <rect
                            key={c.id}
                            x={x}
                            y={H - h}
                            width={barW}
                            height={h}
                            rx="2"
                            fill={color}
                            opacity="0.8"
                        >
                            <title>{c.adherencia}/10 — {new Date(c.fecha).toLocaleDateString('es-ES')}</title>
                        </rect>
                    )
                })}
            </svg>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Últimos {BARS} registros</span>
                <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Buena
                    <span className="w-2 h-2 rounded-full" style={{ background: '#A1A1A6' }} inline-block /> Media
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Baja
                </span>
            </div>
        </div>
    )
}

/* ── Línea de energía y sueño (SVG) ── */
function EnergiaSuenoChart({ data }: { data: CheckIn[] }) {
    const conDatos = data.filter(d => d.energia || d.sueno).slice(0, 7)
    if (conDatos.length < 2) {
        return (
            <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                Más check-ins para ver la evolución de energía y sueño
            </div>
        )
    }

    const sorted = [...conDatos].reverse()
    const W = 100
    const H = 40

    function puntos(vals: number[]): string {
        return vals.map((v, i) => {
            const x = (i / Math.max(vals.length - 1, 1)) * W
            const y = H - (v / 10) * H
            return `${x},${y}`
        }).join(' ')
    }

    const energia = sorted.map(c => c.energia ?? 0)
    const sueno = sorted.map(c => c.sueno ?? 0)

    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
                {/* Línea de energía */}
                <polyline points={puntos(energia)} fill="none" stroke="#A1A1A6" strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
                {energia.map((v, i) => (
                    <circle key={`e${i}`} cx={(i / Math.max(energia.length - 1, 1)) * W}
                        cy={H - (v / 10) * H} r="1.5" fill="white" stroke="#A1A1A6" strokeWidth="1.2" />
                ))}
                {/* Línea de sueño */}
                <polyline points={puntos(sueno)} fill="none" stroke="#8B5CF6" strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" strokeDasharray="2 1.5" />
                {sueno.map((v, i) => (
                    <circle key={`s${i}`} cx={(i / Math.max(sueno.length - 1, 1)) * W}
                        cy={H - (v / 10) * H} r="1.5" fill="white" stroke="#8B5CF6" strokeWidth="1.2" />
                ))}
            </svg>
            <div className="flex gap-4 mt-1 text-[10px]">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 rounded inline-block" style={{ background: '#A1A1A6' }} />
                    <span className="text-gray-400">Energía</span>
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 rounded bg-violet-500 inline-block border-dashed" />
                    <span className="text-gray-400">Sueño</span>
                </span>
            </div>
        </div>
    )
}

/* ── Resumen de métricas ── */
function MetricasResumen({ checkins, racha }: { checkins: CheckIn[]; racha: number }) {
    const adherenciaMedia = checkins.filter(c => c.adherencia).length > 0
        ? (checkins.filter(c => c.adherencia).reduce((a, c) => a + (c.adherencia ?? 0), 0) /
            checkins.filter(c => c.adherencia).length).toFixed(1)
        : '—'

    const energiaMedia = checkins.filter(c => c.energia).length > 0
        ? (checkins.filter(c => c.energia).reduce((a, c) => a + (c.energia ?? 0), 0) /
            checkins.filter(c => c.energia).length).toFixed(1)
        : '—'

    const suenoMedia = checkins.filter(c => c.sueno).length > 0
        ? (checkins.filter(c => c.sueno).reduce((a, c) => a + (c.sueno ?? 0), 0) /
            checkins.filter(c => c.sueno).length).toFixed(1)
        : '—'

    return (
        <div className="grid grid-cols-4 gap-2">
            <div className="macro-pill macro-pill-protein !p-3 !gap-0.5">
                <span className="text-lg font-bold text-gray-900">{adherenciaMedia}</span>
                <span className="text-[10px] text-gray-500">Adherencia</span>
            </div>
            <div className="macro-pill macro-pill-carbs !p-3 !gap-0.5">
                <span className="text-lg font-bold text-gray-900">{energiaMedia}</span>
                <span className="text-[10px] text-gray-500">Energía</span>
            </div>
            <div className="macro-pill macro-pill-fat !p-3 !gap-0.5">
                <span className="text-lg font-bold text-gray-900">{suenoMedia}</span>
                <span className="text-[10px] text-gray-500">Sueño</span>
            </div>
            <div className="macro-pill !p-3 !gap-0.5" style={{ borderColor: '#A1A1A6', background: 'var(--accent-bg)' }}>
                <div className="flex items-center gap-1">
                    <Flame size={16} style={{ color: '#A1A1A6' }} />
                    <span className="text-lg font-bold text-gray-900">{racha}</span>
                </div>
                <span className="text-[10px] text-gray-500">Racha</span>
            </div>
        </div>
    )
}

/* ── Timeline de check-ins recientes ── */
function TimelineCheckins({ checkins }: { checkins: CheckIn[] }) {
    const recientes = checkins.slice(0, 5)
    if (recientes.length === 0) return null

    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Últimos check-ins</p>
            <div className="space-y-1.5">
                {recientes.map(c => {
                    const fecha = new Date(c.fecha)
                    const hoy = new Date()
                    hoy.setHours(0, 0, 0, 0)
                    const diffDias = Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24))
                    const label = diffDias === 0 ? 'Hoy' : diffDias === 1 ? 'Ayer' : fmtFecha(fecha)

                    return (
                        <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${diffDias <= 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className="text-xs text-gray-500">{label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px]">
                                {c.peso && <span className="font-medium text-gray-700">{c.peso} kg</span>}
                                <span className={`${(c.adherencia ?? 0) >= 7 ? 'text-green-600' : (c.adherencia ?? 0) >= 4 ? 'text-[#8E8E93]' : 'text-red-500'}`}>
                                    {c.adherencia ? `${c.adherencia}/10` : '—'}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/* ── Componente principal ── */
export default function ProgresoCharts({ checkins, peso, pesoInicial, objetivo }: ProgresoChartsProps) {
    const racha = useMemo(() => calcularRacha(checkins), [checkins])

    return (
        <div className="space-y-4">
            {/* Métricas rápidas con racha */}
            <MetricasResumen checkins={checkins} racha={racha} />

            {/* Evolución del peso */}
            <div className="card">
                <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} style={{ color: '#0D9488' }} />
                    <h3 className="font-semibold text-gray-900 text-sm">📉 Evolución del peso</h3>
                    {objetivo && (
                        <span className="badge text-[10px] ml-auto" style={{ background: '#F0FDFA', color: '#0D9488' }}>
                            🎯 {objetivo.replace('_', ' ')}
                        </span>
                    )}
                </div>
                <PesoChart data={peso} pesoInicial={pesoInicial} />
            </div>

            {/* Adherencia semanal */}
            <div className="card">
                <div className="flex items-center gap-2 mb-3">
                    <Target size={16} style={{ color: '#0D9488' }} />
                    <h3 className="font-semibold text-gray-900 text-sm">📊 Adherencia semanal</h3>
                </div>
                <AdherenciaChart data={checkins} />
            </div>

            {/* Energía y Sueño */}
            <div className="card">
                <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} style={{ color: '#A1A1A6' }} />
                    <h3 className="font-semibold text-gray-900 text-sm">⚡ Energía y sueño</h3>
                </div>
                <EnergiaSuenoChart data={checkins} />
            </div>

            {/* Totales */}
            <div className="card">
                <div className="flex items-center gap-2 mb-3">
                    <CalendarCheck size={16} style={{ color: '#0D9488' }} />
                    <h3 className="font-semibold text-gray-900 text-sm">📋 Historial de check-ins</h3>
                    <span className="text-xs text-gray-400 ml-auto">{checkins.length} totales</span>
                </div>
                <TimelineCheckins checkins={checkins} />
            </div>
        </div>
    )
}
