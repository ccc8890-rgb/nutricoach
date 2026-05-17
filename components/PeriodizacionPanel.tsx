'use client'

import { useEffect, useState } from 'react'
import { Zap, CheckCircle, AlertCircle, Moon, MessageCircle, TrendingUp, Minus, Loader2 } from 'lucide-react'
import { AccionPeriodizacion, ACCION_LABELS, ACCION_DESCRIPTIONS } from '@/lib/periodizacion/arbol-decision'

interface AccionItem {
    id: string
    accion: AccionPeriodizacion
    created_at: string
    requiere_aprobacion: boolean
    aprobado_por_coach: boolean | null
    aplicado: boolean
    ajuste_macros: {
        kcal_ajustado: number
        carbohidratos_ajustados: number
        grasas_ajustadas: number
        proteinas_ajustadas: number
        descripcion: string
    } | null
    coach_nota: string | null
    input_snapshot: {
        energia: number
        horas_sueno: number
        adherencia: number
        tls_semanal: number
        semanas_en_deficit: number
    }
}

const ACCION_ICONS: Record<AccionPeriodizacion, React.ElementType> = {
    refeed_sugerir: Zap,
    higiene_sueno: Moon,
    mensaje_apoyo: MessageCircle,
    ajuste_calorico_10pct: TrendingUp,
    alerta_coach_solo: AlertCircle,
    sin_accion: Minus,
}

const ACCION_COLORS: Record<AccionPeriodizacion, { bg: string; color: string; border: string }> = {
    refeed_sugerir: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    higiene_sueno: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    mensaje_apoyo: { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    ajuste_calorico_10pct: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
    alerta_coach_solo: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
    sin_accion: { bg: 'var(--bg)', color: 'var(--text-muted)', border: 'var(--border)' },
}

interface PeriodizacionPanelProps {
    clienteId: string
}

export default function PeriodizacionPanel({ clienteId }: PeriodizacionPanelProps) {
    const [acciones, setAcciones] = useState<AccionItem[]>([])
    const [loading, setLoading] = useState(true)
    const [aprobando, setAprobando] = useState<string | null>(null)

    async function cargarAcciones() {
        try {
            const res = await fetch(`/api/clientes/${clienteId}/periodizacion`)
            if (!res.ok) return
            const data = await res.json()
            setAcciones(data.acciones ?? [])
        } catch (err) {
            console.error('Error al cargar periodización:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { cargarAcciones() }, [clienteId])

    async function handleAprobar(accion_id: string, aprobar: boolean, nota?: string) {
        setAprobando(accion_id)
        try {
            await fetch('/api/periodizacion/refeed/aprobar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion_id, aprobar, coach_nota: nota }),
            })
            await cargarAcciones()
        } catch (err) {
            console.error('Error al aprobar:', err)
        } finally {
            setAprobando(null)
        }
    }

    if (loading) {
        return (
            <div className="card p-4 animate-pulse">
                <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--border)' }} />
                <div className="h-16 rounded" style={{ background: 'var(--border)' }} />
            </div>
        )
    }

    const pendientes = acciones.filter(a => a.requiere_aprobacion && a.aprobado_por_coach === null)
    const historial = acciones.filter(a => !(a.requiere_aprobacion && a.aprobado_por_coach === null))

    return (
        <div className="space-y-4">
            {/* Pendientes de aprobación */}
            {pendientes.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: '#FFF7ED' }}>
                        <div className="flex items-center gap-2">
                            <AlertCircle size={15} style={{ color: '#C2410C' }} />
                            <span className="text-sm font-semibold" style={{ color: '#C2410C' }}>
                                {pendientes.length} acción{pendientes.length > 1 ? 'es' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de aprobación
                            </span>
                        </div>
                    </div>

                    {pendientes.map(accion => {
                        const cfg = ACCION_COLORS[accion.accion]
                        const Icon = ACCION_ICONS[accion.accion]
                        return (
                            <div key={accion.id} className="p-4 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                                        <Icon size={14} style={{ color: cfg.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold" style={{ color: cfg.color }}>
                                            {ACCION_LABELS[accion.accion]}
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                            {ACCION_DESCRIPTIONS[accion.accion]}
                                        </p>

                                        {accion.ajuste_macros && (
                                            <div className="mt-2 rounded-lg px-3 py-2 text-xs"
                                                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                                                {accion.ajuste_macros.descripcion}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mt-3">
                                            <button
                                                onClick={() => handleAprobar(accion.id, true)}
                                                disabled={aprobando === accion.id}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                                                style={{ background: '#10B981', color: 'white' }}
                                            >
                                                {aprobando === accion.id
                                                    ? <Loader2 size={12} className="animate-spin" />
                                                    : <CheckCircle size={12} />}
                                                Aprobar
                                            </button>
                                            <button
                                                onClick={() => handleAprobar(accion.id, false)}
                                                disabled={aprobando === accion.id}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                                style={{ background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                                            >
                                                Descartar
                                            </button>
                                        </div>
                                    </div>

                                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                        {new Date(accion.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Historial de acciones */}
            {historial.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            Historial de periodización
                        </span>
                    </div>

                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {historial.slice(0, 8).map(accion => {
                            const cfg = ACCION_COLORS[accion.accion]
                            const Icon = ACCION_ICONS[accion.accion]
                            return (
                                <div key={accion.id} className="px-4 py-3 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ background: cfg.bg }}>
                                        <Icon size={13} style={{ color: cfg.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                                            {ACCION_LABELS[accion.accion]}
                                        </p>
                                        {accion.input_snapshot && (
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                Energía {accion.input_snapshot.energia}/5 · Adherencia {accion.input_snapshot.adherencia}% · TLS {accion.input_snapshot.tls_semanal} pts
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {accion.aprobado_por_coach === true && accion.accion !== 'sin_accion' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                                style={{ background: '#DCFCE7', color: '#15803D' }}>
                                                Aprobado
                                            </span>
                                        )}
                                        {accion.aprobado_por_coach === false && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                                                Descartado
                                            </span>
                                        )}
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(accion.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {acciones.length === 0 && (
                <div className="card p-6 text-center">
                    <Zap size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Las acciones de periodización aparecerán aquí tras el primer check-in
                    </p>
                </div>
            )}
        </div>
    )
}
