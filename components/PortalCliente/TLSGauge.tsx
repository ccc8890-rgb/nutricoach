'use client'

import { useEffect, useState } from 'react'
import { Activity, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'

interface SesionReciente {
    fecha: string
    tipo_actividad: string
    duracion_min: number
    rpe: number
    tls_diario: number
    notas: string | null
}

interface TLSData {
    tls_semana_actual: number
    num_sesiones: number
    tls_promedio_4sem: number
    umbral: number
    porcentaje_umbral: number
    semaforo: 'bajo' | 'normal' | 'alto' | 'muy_alto'
    sesiones_recientes: SesionReciente[] | null
}

const TIPO_LABELS: Record<string, string> = {
    running: 'Running',
    gym: 'Gym',
    hyrox: 'Hyrox',
    crossfit: 'CrossFit',
    ciclismo: 'Ciclismo',
    natacion: 'Natación',
    trail: 'Trail',
    yoga: 'Yoga',
    otro: 'Otro',
}

const SEMAFORO_CONFIG = {
    bajo: { label: 'Carga baja', bg: '#ECFDF5', color: '#059669', bar: '#10B981' },
    normal: { label: 'Carga óptima', bg: '#EFF6FF', color: '#2563EB', bar: '#3B82F6' },
    alto: { label: 'Carga alta', bg: '#FFFBEB', color: '#D97706', bar: '#F59E0B' },
    muy_alto: { label: 'Sobreentrenamiento', bg: '#FEF2F2', color: '#DC2626', bar: '#EF4444' },
}

interface TLSGaugeProps {
    codigo: string
    onRegistrar: () => void
}

export default function TLSGauge({ codigo, onRegistrar }: TLSGaugeProps) {
    const [data, setData] = useState<TLSData | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandido, setExpandido] = useState(false)

    useEffect(() => {
        fetch(`/api/cliente/${codigo}/registrar-entreno`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [codigo])

    if (loading) {
        return (
            <div className="card p-4 animate-pulse">
                <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--border)' }} />
                <div className="h-24 rounded" style={{ background: 'var(--border)' }} />
            </div>
        )
    }

    if (!data || data.tls_semana_actual === undefined) {
        return (
            <div className="card p-4 text-center">
                <Activity size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Registra tu primer entreno para ver tu carga de entrenamiento
                </p>
                <button
                    onClick={onRegistrar}
                    className="btn-primary mt-3 text-sm px-4 py-2"
                >
                    + Registrar entreno
                </button>
            </div>
        )
    }

    const cfg = SEMAFORO_CONFIG[data.semaforo]
    const pct = Math.min(data.porcentaje_umbral, 130)
    const tendencia = data.tls_semana_actual > data.tls_promedio_4sem * 1.1
        ? 'up'
        : data.tls_semana_actual < data.tls_promedio_4sem * 0.9
            ? 'down'
            : 'stable'

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={16} style={{ color: cfg.color }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        Carga de entrenamiento
                    </span>
                </div>
                <button
                    onClick={onRegistrar}
                    className="text-xs font-medium px-3 py-1 rounded-full"
                    style={{ background: cfg.bg, color: cfg.color }}
                >
                    + Registrar
                </button>
            </div>

            {/* TLS principal */}
            <div className="px-4 pb-3" style={{ background: cfg.bg }}>
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold" style={{ color: cfg.color }}>
                        {data.tls_semana_actual}
                    </span>
                    <span className="text-sm mb-1" style={{ color: cfg.color }}>pts esta semana</span>

                    {/* Tendencia */}
                    <div className="ml-auto flex items-center gap-1">
                        {tendencia === 'up' && <TrendingUp size={14} style={{ color: cfg.color }} />}
                        {tendencia === 'down' && <TrendingDown size={14} style={{ color: 'var(--text-muted)' }} />}
                        {tendencia === 'stable' && <Minus size={14} style={{ color: 'var(--text-muted)' }} />}
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Media 4 sem: {data.tls_promedio_4sem}
                        </span>
                    </div>
                </div>

                {/* Barra de progreso */}
                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                    <div
                        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: cfg.bar }}
                    />
                    {/* Marcador de umbral (100%) */}
                    <div
                        className="absolute top-0 h-full w-px"
                        style={{ left: `${100 / 1.3}%`, background: 'rgba(0,0,0,0.25)' }}
                    />
                </div>

                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Umbral: {data.umbral} pts · {data.num_sesiones} sesión{data.num_sesiones !== 1 ? 'es' : ''}
                    </span>
                </div>
            </div>

            {/* Sesiones recientes (expandibles) */}
            {data.sesiones_recientes && data.sesiones_recientes.length > 0 && (
                <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                        onClick={() => setExpandido(e => !e)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <span>Últimas sesiones</span>
                        {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {expandido && (
                        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                            {data.sesiones_recientes.map((s, i) => (
                                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                                                {TIPO_LABELS[s.tipo_actividad] ?? s.tipo_actividad}
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {new Date(s.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {s.duracion_min} min · RPE {s.rpe}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold flex-shrink-0" style={{ color: cfg.color }}>
                                        {s.tls_diario} pts
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
