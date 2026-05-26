'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UtensilsCrossed, ClipboardCheck, BarChart3, Loader2, MessageSquareText, Dumbbell, MessageCircle, Smartphone, Calendar, AlertCircle, ShoppingCart, BookOpen } from 'lucide-react'
import MiPlan from './MiPlan'
import CheckInForm from './CheckInForm'
import ProgresoCharts from './ProgresoCharts'
import NotasCoach from './NotasCoach'
import TLSGauge from './TLSGauge'
import RegistrarEntrenoModal from './RegistrarEntrenoModal'
import ChatPanel from './ChatPanel'
import IntegracionesPanel from './IntegracionesPanel'
import ListaCompraPortal from './ListaCompraPortal'
import type { PlanNutricion, Cliente, PlanEntrenamiento, CheckIn, SeguimientoPeso, NotaCoach, RegistroComidaDia } from '@/types'

interface DashboardData {
    plan: PlanNutricion
    cliente: Pick<Cliente, 'id' | 'peso_inicial' | 'objetivo' | 'onboarding_completado'> & { nombre?: string; fecha_proxima_revision?: string }
    entreno: PlanEntrenamiento | null
    checkins: CheckIn[]
    peso: SeguimientoPeso[]
    notas: NotaCoach[]
    registros_comidas?: RegistroComidaDia[]
}

interface DashboardClienteProps {
    codigo: string
}

type Tab = 'plan' | 'entreno' | 'compra' | 'recetas' | 'checkin' | 'progreso' | 'chat' | 'integraciones'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'plan', label: 'Hoy', icon: UtensilsCrossed },
    { key: 'entreno', label: 'Training', icon: Dumbbell },
    { key: 'compra', label: 'Compra', icon: ShoppingCart },
    { key: 'recetas', label: 'Recetas', icon: BookOpen },
    { key: 'checkin', label: 'Check-in', icon: ClipboardCheck },
    { key: 'progreso', label: 'Progreso', icon: BarChart3 },
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'integraciones', label: 'Apps', icon: Smartphone },
]

function normalizarDia(dia: string | null | undefined): number | null {
    if (!dia) return null
    const keys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
    const d = dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const idx = keys.findIndex(k => d.includes(k))
    return idx >= 0 ? idx : null
}

function EntrenoCliente({
    entreno,
    codigo,
    tlsKey,
    onRegistrar,
    onSesion,
}: {
    entreno: PlanEntrenamiento | null
    codigo: string
    tlsKey: number
    onRegistrar: () => void
    onSesion: (nombre: string) => void
}) {
    const hoy = new Date().getDay()
    const hoyIdx = hoy === 0 ? 6 : hoy - 1
    const sesiones = (entreno?.sesiones ?? []) as Array<{
        id: string
        nombre: string
        dia_semana?: string | null
        duracion_min?: number | null
        ejercicios?: Array<{
            id: string
            orden: number
            series?: number | null
            repeticiones?: string | null
            descanso_seg?: number | null
            ejercicio?: { nombre?: string | null; grupo_muscular?: string | null }
        }>
    }>
    const sesionesHoy = sesiones.filter(s => normalizarDia(s.dia_semana) === hoyIdx)
    const visibles = sesionesHoy.length ? sesionesHoy : sesiones

    return (
        <div className="space-y-4">
            <TLSGauge key={tlsKey} codigo={codigo} onRegistrar={onRegistrar} />
            <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Plan de entrenamiento</p>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{entreno?.nombre ?? 'Sin plan activo'}</h2>
                    </div>
                    <button onClick={onRegistrar} className="btn-primary text-xs px-3 py-2">Registrar</button>
                </div>

                {!entreno || sesiones.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tu coach todavía no ha asignado sesiones de entrenamiento.</p>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {sesionesHoy.length ? 'Entrenamiento previsto para hoy' : 'Semana de entrenamiento'}
                        </p>
                        {visibles.map(sesion => (
                            <div key={sesion.id} className="rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {sesion.dia_semana ?? 'Sin día'}{sesion.duracion_min ? ` · ${sesion.duracion_min} min` : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onSesion(sesion.nombre)}
                                        className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
                                        style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
                                    >
                                        Hecho
                                    </button>
                                </div>
                                {(sesion.ejercicios ?? []).length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {(sesion.ejercicios ?? []).slice().sort((a, b) => a.orden - b.orden).map(ej => (
                                            <div key={ej.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--surface)' }}>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre ?? 'Ejercicio'}</p>
                                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{ej.ejercicio?.grupo_muscular ?? 'Trabajo principal'}</p>
                                                </div>
                                                <p className="text-xs font-semibold text-right shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                                    {ej.series ? `${ej.series}x` : ''}{ej.repeticiones ?? 'programado'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

function RecetarioCliente({ plan, codigo }: { plan: PlanNutricion; codigo: string }) {
    const recetas = Array.from(new Map(((plan.comidas ?? []) as Array<{
        nombre: string
        receta_id?: string | null
        receta?: { id: string; nombre: string; imagen_url?: string | null; kcal?: number | null; proteinas?: number | null; tiempo_prep_min?: number | null } | null
    }>).filter(c => c.receta_id && c.receta).map(c => [c.receta_id, { ...c.receta!, comida: c.nombre }])).values())

    return (
        <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Recetario del plan</p>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{recetas.length} recetas disponibles</h2>
            </div>
            {recetas.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Todavía no hay recetas vinculadas a tu plan.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recetas.map(receta => (
                        <Link
                            key={receta.id}
                            href={`/recetas/${receta.id}?returnTo=/cliente/${codigo}`}
                            className="group rounded-2xl border overflow-hidden"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                        >
                            <div className="aspect-[16/9]" style={{ background: 'var(--surface)' }}>
                                {receta.imagen_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={receta.imagen_url} alt={receta.nombre} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                                        <BookOpen size={22} />
                                    </div>
                                )}
                            </div>
                            <div className="p-3">
                                <p className="text-sm font-semibold line-clamp-2 group-hover:underline" style={{ color: 'var(--text)' }}>{receta.nombre}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {Math.round(Number(receta.kcal ?? 0))} kcal · P {Math.round(Number(receta.proteinas ?? 0))}g{receta.tiempo_prep_min ? ` · ${receta.tiempo_prep_min} min` : ''}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    )
}

export default function DashboardCliente({ codigo }: DashboardClienteProps) {
    const searchParams = useSearchParams()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [tab, setTab] = useState<Tab>(() => {
        const connected = searchParams.get('connected')
        if (connected === 'strava' || connected === 'garmin' || connected === 'google_fit') return 'integraciones'
        return 'plan'
    })
    const [notasNoLeidas, setNotasNoLeidas] = useState(0)
    const [notasVistas, setNotasVistas] = useState<string[]>([])
    const [mostrarRegistrarEntreno, setMostrarRegistrarEntreno] = useState(false)
    const [sesionPendiente, setSesionPendiente] = useState<string | null>(null)
    const [tlsKey, setTlsKey] = useState(0)

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

    // Marcar notas como leídas al visitar chat.
    useEffect(() => {
        if (tab === 'chat' && data?.notas) {
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
                            <AlertCircle size={32} style={{ color: 'var(--error)' }} />
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

    const nombreCliente = data.cliente?.nombre?.split(' ')[0] ?? 'Cliente'
    const proximaRevision = data.cliente?.fecha_proxima_revision
        ? new Date(data.cliente.fecha_proxima_revision).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : null

    return (
        <div className="min-h-screen pb-nav-safe" style={{ background: 'var(--bg)' }}>
            <div className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="max-w-3xl mx-auto px-4 pt-safe py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Casanova Nutrition</p>
                            <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--text)' }}>{nombreCliente}</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {proximaRevision && (
                                <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                                    <Calendar size={12} /> {proximaRevision}
                                </span>
                            )}
                            {notasNoLeidas > 0 && (
                                <button
                                    onClick={() => setTab('chat')}
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                                    style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444' }}
                                >
                                    <MessageSquareText size={12} />
                                    {notasNoLeidas}
                                </button>
                            )}
                            {ultimoCheckin && diasDesdeUltimoCheckin !== null && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                                    <ClipboardCheck size={12} />
                                    {diasDesdeUltimoCheckin === 0 ? 'Hoy' : `${diasDesdeUltimoCheckin}d`}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs — estilo pill */}
            <div className="sticky top-0 z-10 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="px-2 py-2" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div style={{ display: 'flex', gap: '6px', width: 'max-content', minWidth: '100%', paddingLeft: '4px', paddingRight: '4px' }}>
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className="flex items-center gap-1.5 rounded-xl font-medium whitespace-nowrap transition-all"
                                style={{
                                    padding: '7px 12px',
                                    fontSize: '12px',
                                    background: tab === key ? 'var(--primary)' : 'var(--bg)',
                                    color: tab === key ? 'white' : 'var(--text-secondary)',
                                }}
                            >
                                <Icon size={14} />
                                {label}
                                {key === 'chat' && notasNoLeidas > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

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

            {/* Contenido */}
            <div className="max-w-3xl mx-auto p-4 space-y-4">

                {tab === 'plan' && (
                    <MiPlan
                        codigo={codigo}
                        plan={data.plan}
                        registros_comidas={data.registros_comidas}
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
                    <EntrenoCliente
                        entreno={data.entreno}
                        codigo={codigo}
                        tlsKey={tlsKey}
                        onRegistrar={() => setMostrarRegistrarEntreno(true)}
                        onSesion={(nombre) => {
                            setSesionPendiente(nombre)
                            setMostrarRegistrarEntreno(true)
                        }}
                    />
                )}

                {tab === 'compra' && (
                    <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                        <div className="mb-4">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Lista de la compra</p>
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Semana actual</h2>
                        </div>
                        <ListaCompraPortal codigo={codigo} />
                    </section>
                )}

                {tab === 'recetas' && (
                    <RecetarioCliente plan={data.plan} codigo={codigo} />
                )}

                {tab === 'progreso' && (
                    <div className="space-y-4">
                        <ProgresoCharts
                            checkins={data.checkins}
                            peso={data.peso}
                            pesoInicial={data.cliente?.peso_inicial}
                            objetivo={data.cliente?.objetivo}
                        />
                    </div>
                )}

                {tab === 'chat' && (
                    <div className="card !p-0 overflow-hidden">
                        <ChatPanel codigo={codigo} pollingInterval={10000} />
                    </div>
                )}

                {tab === 'integraciones' && data.cliente && (
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
