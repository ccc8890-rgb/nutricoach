'use client'

import { useEffect, useState, useCallback } from 'react'
import { UtensilsCrossed, ClipboardCheck, BarChart3, Loader2, Flame, MessageSquareText, History, Dumbbell, MessageCircle, Smartphone } from 'lucide-react'
import MiPlan from './MiPlan'
import MensajeCoach from './MensajeCoach'
import CheckInForm from './CheckInForm'
import ProgresoCharts from './ProgresoCharts'
import NotasCoach from './NotasCoach'
import HistorialCheckins from './HistorialCheckins'
import TLSGauge from './TLSGauge'
import RegistrarEntrenoModal from './RegistrarEntrenoModal'
import MicronutrientesPortal from './MicronutrientesPortal'
import ChatPanel from './ChatPanel'
import IntegracionesPanel from './IntegracionesPanel'
import type { PlanNutricion, Cliente, PlanEntrenamiento, CheckIn, SeguimientoPeso, NotaCoach } from '@/types'

interface DashboardData {
    plan: PlanNutricion
    cliente: Pick<Cliente, 'id' | 'peso_inicial' | 'objetivo' | 'onboarding_completado'> & { nombre?: string; fecha_proxima_revision?: string }
    entreno: PlanEntrenamiento | null
    checkins: CheckIn[]
    peso: SeguimientoPeso[]
    notas: NotaCoach[]
}

interface DashboardClienteProps {
    codigo: string
}

type Tab = 'plan' | 'checkin' | 'entreno' | 'progreso' | 'historial' | 'chat' | 'integraciones'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'plan', label: 'Mi plan', icon: UtensilsCrossed },
    { key: 'checkin', label: 'Check-in', icon: ClipboardCheck },
    { key: 'entreno', label: 'Carga', icon: Dumbbell },
    { key: 'historial', label: 'Historial', icon: History },
    { key: 'progreso', label: 'Progreso', icon: BarChart3 },
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'integraciones', label: 'Apps', icon: Smartphone },
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
    const [mostrarRegistrarEntreno, setMostrarRegistrarEntreno] = useState(false)
    const [sesionPendiente, setSesionPendiente] = useState<string | null>(null)
    const [tlsKey, setTlsKey] = useState(0)
    const [mostrarBienvenida, setMostrarBienvenida] = useState(false)

    function cerrarBienvenida() {
        localStorage.setItem(`bienvenida_vista_${codigo}`, '1')
        setMostrarBienvenida(false)
    }

    const loadData = useCallback(async () => {
        try {
            fetch(`/api/cliente/${codigo}/registrar-acceso`, { method: 'POST' }).catch(() => { })

            const res = await fetch(`/api/cliente/${codigo}/dashboard`)
            if (!res.ok) {
                const err = await res.json()
                setError(err.error || 'Error al cargar')
                setLoading(false)
                return
            }
            const json = await res.json()
            setData(json)

            if (!localStorage.getItem(`bienvenida_vista_${codigo}`)) {
                setMostrarBienvenida(true)
            }

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

    // Marcar notas como leídas al visitar historial (donde se muestran las notas del coach)
    useEffect(() => {
        if (tab === 'historial' && data?.notas) {
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

    // Iniciales para avatar
    const iniciales = (data.cliente?.nombre ?? '?').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)
    const nombreCliente = data.cliente?.nombre?.split(' ')[0] ?? 'Campeón'

    return (
        <div className="min-h-screen pb-nav-safe" style={{ background: 'var(--bg)' }}>
            {/* Header premium con avatar */}
            <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
                <div className="max-w-2xl mx-auto px-4 pt-safe pb-4 sm:py-6">
                    <div className="flex items-center gap-4">
                        {/* Avatar con iniciales */}
                        <div
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                            style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)', color: 'white' }}
                        >
                            {iniciales}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="text-white/70 text-xs sm:text-sm font-medium mb-0.5">
                                👋 ¡Hola, {nombreCliente}!
                            </p>
                            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{data.plan.nombre}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                {racha > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(251,146,60,0.25)', color: '#FB923C' }}>
                                        <Flame size={11} />
                                        {racha} días
                                    </span>
                                )}
                                {notasNoLeidas > 0 && (
                                    <button
                                        onClick={() => setTab('historial')}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(239,68,68,0.25)', color: '#FCA5A5' }}
                                    >
                                        <MessageSquareText size={11} />
                                        {notasNoLeidas} nueva{notasNoLeidas > 1 ? 's' : ''}
                                    </button>
                                )}
                                {data.cliente?.fecha_proxima_revision && (
                                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                                        📅 {new Date(data.cliente.fecha_proxima_revision).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Check-in badge */}
                    {ultimoCheckin && diasDesdeUltimoCheckin !== null && (
                        <div className="mt-3">
                            <div
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                                style={{
                                    background: diasDesdeUltimoCheckin <= 2 ? 'rgba(34,197,94,0.15)' : 'rgba(161,161,166,0.15)',
                                    color: diasDesdeUltimoCheckin <= 2 ? '#4ADE80' : '#A1A1A6',
                                }}
                            >
                                <ClipboardCheck size={12} />
                                {diasDesdeUltimoCheckin === 0 ? 'Check-in completado hoy' :
                                    diasDesdeUltimoCheckin === 1 ? 'Último check-in: ayer' :
                                        `${diasDesdeUltimoCheckin}d sin check-in`}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs — estilo pill */}
            <div className="sticky top-0 z-10 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="max-w-2xl mx-auto px-4 py-2 overflow-x-auto no-scrollbar">
                    <div className="flex gap-1.5">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all`}
                                style={{
                                    background: tab === key ? 'var(--primary)' : 'var(--bg)',
                                    color: tab === key ? 'white' : 'var(--text-secondary)',
                                }}
                            >
                                <Icon size={14} />
                                {label}
                                {key === 'historial' && notasNoLeidas > 0 && (
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Banner racha */}
            {racha >= 3 && (
                <div className="max-w-2xl mx-auto px-4 pt-3 no-print">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)', color: 'white' }}>
                        <Flame size={16} />
                        {racha >= 7
                            ? <span>¡Increíble! Llevas <strong>{racha} días</strong> de racha 🔥</span>
                            : <span>¡Llevas <strong>{racha} días</strong> seguidos de check-in!</span>}
                    </div>
                </div>
            )}

            {/* Banner onboarding pendiente */}
            {data.cliente?.onboarding_completado === false && (
                <div className="max-w-2xl mx-auto px-4 pt-4">
                    <a href="/onboarding" className="block rounded-xl p-4 border-l-4 text-sm font-medium"
                        style={{ background: 'var(--warning-bg, #fef3c7)', borderColor: '#f59e0b', color: '#92400e' }}>
                        <span className="font-semibold">Completa tu perfil en 5 minutos</span>
                        <span className="block text-xs mt-0.5 font-normal" style={{ color: '#a16207' }}>
                            Tu coach necesita tus datos para personalizar tu plan. Toca aquí para continuar el onboarding.
                        </span>
                    </a>
                </div>
            )}

            {/* Bienvenida primer acceso */}
            {mostrarBienvenida && data?.cliente && (
                <div className="max-w-2xl mx-auto px-4 pt-4">
                    <div className="rounded-2xl border p-5 mb-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                            ¡Hola, {data.cliente.nombre?.split(' ')[0] ?? 'campeón'}! 👋
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Tu plan personalizado está listo.</p>
                        <ul className="space-y-2.5 mb-4 mt-3">
                            {[
                                { icon: '🍽️', titulo: 'Mi plan', desc: 'Tu dieta de hoy con ingredientes y recetas' },
                                { icon: '💪', titulo: 'Carga', desc: 'Tu entrenamiento de la semana' },
                                { icon: '📊', titulo: 'Check-in', desc: 'Reporta tu peso y estado cada semana' },
                            ].map(item => (
                                <li key={item.titulo} className="flex items-start gap-3">
                                    <span className="text-lg leading-tight">{item.icon}</span>
                                    <div>
                                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.titulo}</span>
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}> — {item.desc}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <button onClick={cerrarBienvenida} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>
                            Empezar →
                        </button>
                    </div>
                </div>
            )}

            {/* Contenido */}
            <div className="max-w-2xl mx-auto p-4 space-y-4">
                <MensajeCoach codigo={codigo} />

                {tab === 'plan' && (
                    <MiPlan
                        codigo={codigo}
                        plan={data.plan}
                        entreno={data.entreno}
                        registros_comidas={(data as any).registros_comidas}
                        onMarcarSesionHecha={(nombre) => {
                            setSesionPendiente(nombre)
                            setMostrarRegistrarEntreno(true)
                        }}
                    />
                )}

                {tab === 'checkin' && (
                    <CheckInForm
                        codigo={codigo}
                        onCheckinCreado={loadData}
                        ultimoCheckin={ultimoCheckin}
                    />
                )}

                {tab === 'entreno' && (
                    <TLSGauge
                        key={tlsKey}
                        codigo={codigo}
                        onRegistrar={() => setMostrarRegistrarEntreno(true)}
                    />
                )}

                {tab === 'historial' && (
                    <HistorialCheckins codigo={codigo} />
                )}

                {tab === 'progreso' && (
                    <div className="space-y-4">
                        <ProgresoCharts
                            checkins={data.checkins}
                            peso={data.peso}
                            pesoInicial={data.cliente?.peso_inicial}
                            objetivo={data.cliente?.objetivo}
                        />
                        <MicronutrientesPortal codigo={codigo} />
                    </div>
                )}

                {tab === 'chat' && (
                    <div className="card !p-0 overflow-hidden">
                        <ChatPanel codigo={codigo} pollingInterval={10000} />
                    </div>
                )}

                {tab === 'integraciones' && (
                    <IntegracionesPanel codigo={codigo} clienteId={data.cliente.id} />
                )}
            </div>

            {mostrarRegistrarEntreno && (
                <RegistrarEntrenoModal
                    codigo={codigo}
                    sesionNombre={sesionPendiente ?? undefined}
                    tipoPreset="gym"
                    onClose={() => { setMostrarRegistrarEntreno(false); setSesionPendiente(null) }}
                    onGuardado={() => {
                        setTlsKey(k => k + 1)
                        setSesionPendiente(null)
                        setTab('entreno')
                    }}
                />
            )}

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
