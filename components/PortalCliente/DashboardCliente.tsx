'use client'

import { useEffect, useState, useCallback } from 'react'
import { UtensilsCrossed, ClipboardCheck, BarChart3, Loader2, Bell, Flame, MessageSquareText, History } from 'lucide-react'
import MiPlan from './MiPlan'
import CheckInForm from './CheckInForm'
import ProgresoCharts from './ProgresoCharts'
import NotasCoach from './NotasCoach'
import HistorialCheckins from './HistorialCheckins'
import type { PlanNutricion, Cliente, PlanEntrenamiento, CheckIn, SeguimientoPeso, NotaCoach } from '@/types'

interface DashboardData {
    plan: PlanNutricion
    cliente: Pick<Cliente, 'id' | 'peso_inicial' | 'objetivo'> & { nombre?: string; fecha_proxima_revision?: string }
    entreno: PlanEntrenamiento | null
    checkins: CheckIn[]
    peso: SeguimientoPeso[]
    notas: NotaCoach[]
}

interface DashboardClienteProps {
    codigo: string
}

type Tab = 'plan' | 'checkin' | 'progreso' | 'historial'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'plan', label: 'Mi plan', icon: UtensilsCrossed },
    { key: 'checkin', label: 'Check-in', icon: ClipboardCheck },
    { key: 'historial', label: 'Historial', icon: History },
    { key: 'progreso', label: 'Progreso', icon: BarChart3 },
]

/* ── Helper: calcular racha ── */
function calcularRacha(checkins: CheckIn[]): number {
    if (checkins.length === 0) return 0
    const sorted = [...checkins]
        .map(c => new Date(c.fecha))
        .sort((a, b) => b.getTime() - a.getTime())

    let racha = 1
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const diffHoy = Math.floor((hoy.getTime() - sorted[0].getTime()) / (1000 * 60 * 60 * 24))
    if (diffHoy > 2) return 0

    for (let i = 1; i < sorted.length; i++) {
        const diff = Math.floor((sorted[i - 1].getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24))
        if (diff === 1) racha++
        else break
    }
    return racha
}

export default function DashboardCliente({ codigo }: DashboardClienteProps) {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [tab, setTab] = useState<Tab>('plan')
    const [notasNoLeidas, setNotasNoLeidas] = useState(0)
    const [notasVistas, setNotasVistas] = useState<string[]>([])

    const loadData = useCallback(async () => {
        try {
            const res = await fetch(`/api/cliente/${codigo}/dashboard`)
            if (!res.ok) {
                const err = await res.json()
                setError(err.error || 'Error al cargar')
                setLoading(false)
                return
            }
            const json = await res.json()
            setData(json)

            // Detectar notas nuevas (no vistas)
            if (json.notas?.length > 0) {
                const nuevas = json.notas.filter((n: NotaCoach) => !notasVistas.includes(n.id))
                setNotasNoLeidas(nuevas.length)
            }

            setLoading(false)
        } catch {
            setError('Error de conexión')
            setLoading(false)
        }
    }, [codigo, notasVistas])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Marcar notas como leídas al visitar la pestaña de progreso (donde se muestran)
    useEffect(() => {
        if (tab === 'progreso' && data?.notas) {
            const ids = data.notas.map(n => n.id)
            setNotasVistas(prev => {
                const nuevas = ids.filter(id => !prev.includes(id))
                if (nuevas.length > 0) {
                    setNotasNoLeidas(0)
                    return [...prev, ...nuevas]
                }
                return prev
            })
        }
    }, [tab, data?.notas])

    const racha = data ? calcularRacha(data.checkins ?? []) : 0

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <div className="max-w-md w-full mx-4 text-center">
                    <div className="card p-12">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--error-bg)' }}>
                            <span className="text-3xl">😕</span>
                        </div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Plan no disponible</h1>
                        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                            {error || 'Este plan no existe o ha sido desactivado por tu coach'}
                        </p>
                        <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                            Si crees que es un error, contacta con tu coach.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Último check-in para vista previa
    const ultimoCheckin = data.checkins?.[0]
    const diasDesdeUltimoCheckin = ultimoCheckin
        ? Math.floor((new Date().getTime() - new Date(ultimoCheckin.fecha).getTime()) / (1000 * 60 * 60 * 24))
        : null

    return (
        <div className="min-h-screen pb-nav-safe" style={{ background: 'var(--bg)' }}>
            {/* Header con gradiente teal */}
            <div style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)' }}>
                <div className="max-w-2xl mx-auto px-4 pt-safe pb-5 sm:py-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-teal-100 text-xs sm:text-sm font-medium mb-1">
                                {data.cliente?.nombre ? `👋 ¡Hola, ${data.cliente.nombre}!` : '🍽️ Tu plan personalizado'}
                            </p>
                            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{data.plan.nombre}</h1>
                            {data.plan.descripcion && (
                                <p className="text-teal-100 mt-1 text-xs sm:text-sm line-clamp-2">{data.plan.descripcion}</p>
                            )}
                        </div>

                        {/* Indicador de racha y notas no leídas */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {racha > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
                                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                                    <Flame size={12} />
                                    <span>{racha}</span>
                                </div>
                            )}
                            {notasNoLeidas > 0 && (
                                <div className="relative">
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
                                        style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                                        <MessageSquareText size={12} />
                                        <span className="hidden sm:inline">Nuevas</span>
                                    </div>
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                                        {notasNoLeidas}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Badges informativos */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
                        {data.cliente?.fecha_proxima_revision && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium"
                                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                                📅 Revisión: {new Date(data.cliente.fecha_proxima_revision).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </div>
                        )}
                        {ultimoCheckin && diasDesdeUltimoCheckin !== null && (
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium`}
                                style={{ background: diasDesdeUltimoCheckin <= 2 ? 'rgba(34,197,94,0.2)' : 'rgba(161,161,166,0.2)', color: 'white' }}>
                                <ClipboardCheck size={10} className="sm:hidden" />
                                <ClipboardCheck size={12} className="hidden sm:block" />
                                {diasDesdeUltimoCheckin === 0 ? 'Check-in hoy' :
                                    diasDesdeUltimoCheckin === 1 ? 'Ayer' :
                                        `${diasDesdeUltimoCheckin}d sin check-in`}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs — más compactos en mobile */}
            <div className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="max-w-2xl mx-auto flex">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors`}
                            style={{
                                color: tab === key ? 'var(--primary)' : 'var(--text-secondary)',
                                borderBottomColor: tab === key ? 'var(--primary)' : 'transparent',
                            }}
                        >
                            <Icon size={14} className="sm:size-4" />
                            <span className="sm:inline">{label}</span>
                            {key === 'progreso' && notasNoLeidas > 0 && (
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {tab === 'plan' && (
                    <MiPlan
                        codigo={codigo}
                        plan={data.plan}
                        entreno={data.entreno}
                    />
                )}

                {tab === 'checkin' && (
                    <CheckInForm
                        codigo={codigo}
                        onCheckinCreado={loadData}
                        ultimoCheckin={ultimoCheckin}
                    />
                )}

                {tab === 'historial' && (
                    <HistorialCheckins codigo={codigo} />
                )}

                {tab === 'progreso' && (
                    <ProgresoCharts
                        checkins={data.checkins}
                        peso={data.peso}
                        pesoInicial={data.cliente?.peso_inicial}
                        objetivo={data.cliente?.objetivo}
                    />
                )}
            </div>

            {/* Footer con notas del coach */}
            <div className="max-w-2xl mx-auto px-4 pb-8">
                <NotasCoach codigo={codigo} />
                <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
                    Plan creado por Casanova Nutrition ·{' '}
                    {new Date(data.plan.created_at).toLocaleDateString('es-ES')}
                </p>
            </div>
        </div>
    )
}
