'use client'

import { useState, useMemo, useEffect } from 'react'
import {
    ChevronLeft, ChevronRight, UtensilsCrossed, Dumbbell,
    CalendarClock, CalendarCheck, AlertCircle, Scale, ClipboardCheck
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

interface SesionCalendario {
    nombre: string
    dia_semana: string
}

interface Props {
    clienteId: string
    fechaRevision: string | null
    dietas: { id: string; nombre: string; activo: boolean; created_at: string }[]
    entrenos: { id: string; nombre: string; activo: boolean; duracion_semanas: number; created_at: string }[]
    onUpdateRevision: (fecha: string | null) => void
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const DIA_A_INDICE: Record<string, number> = {
    'lunes': 0, 'martes': 1, 'miércoles': 2, 'miercoles': 2,
    'jueves': 3, 'viernes': 4, 'sábado': 5, 'sabado': 5, 'domingo': 6,
}

const SESION_COLORS = [
    '#0D9488', // teal
    '#7C3AED', // violet
    '#EA580C', // orange
    '#0EA5E9', // sky
    '#D97706', // amber
    '#DC2626', // red
    '#16A34A', // green
]

export default function PlanificacionCalendario({ clienteId, fechaRevision, dietas, entrenos, onUpdateRevision }: Props) {
    const { addToast } = useToast()
    const hoy = new Date()
    const [mesActual, setMesActual] = useState(hoy.getMonth())
    const [anioActual, setAnioActual] = useState(hoy.getFullYear())
    const [editandoFecha, setEditandoFecha] = useState(false)
    const [nuevaFecha, setNuevaFecha] = useState(fechaRevision || '')
    const [sesiones, setSesiones] = useState<SesionCalendario[]>([])
    const [loadingSesiones, setLoadingSesiones] = useState(false)

    const dietaActiva = useMemo(() => dietas.find(d => d.activo), [dietas])
    const entrenoActivo = useMemo(() => entrenos.find(e => e.activo), [entrenos])

    useEffect(() => {
        if (!entrenoActivo) { setSesiones([]); return }
        setLoadingSesiones(true)
        supabase
            .from('sesiones_entrenamiento')
            .select('nombre, dia_semana')
            .eq('plan_id', entrenoActivo.id)
            .not('dia_semana', 'is', null)
            .then(({ data }) => {
                setSesiones((data ?? []) as SesionCalendario[])
                setLoadingSesiones(false)
            })
    }, [entrenoActivo?.id])

    // Mapear nombre de día → índice 0..6
    const sesionesIndexadas = useMemo(() => {
        const map: Record<number, SesionCalendario[]> = {}
        for (const s of sesiones) {
            const idx = DIA_A_INDICE[s.dia_semana?.toLowerCase?.() ?? '']
            if (idx !== undefined) {
                if (!map[idx]) map[idx] = []
                map[idx].push(s)
            }
        }
        return map
    }, [sesiones])

    function mesAnterior() {
        if (mesActual === 0) { setMesActual(11); setAnioActual(prev => prev - 1) }
        else setMesActual(prev => prev - 1)
    }

    function mesSiguiente() {
        if (mesActual === 11) { setMesActual(0); setAnioActual(prev => prev + 1) }
        else setMesActual(prev => prev + 1)
    }

    function irAHoy() { setMesActual(hoy.getMonth()); setAnioActual(hoy.getFullYear()) }

    function obtenerDiasMes() {
        const primerDia = new Date(anioActual, mesActual, 1)
        const ultimoDia = new Date(anioActual, mesActual + 1, 0)
        const diasEnMes = ultimoDia.getDate()
        let diaSemanaInicio = primerDia.getDay() - 1
        if (diaSemanaInicio < 0) diaSemanaInicio = 6
        const dias: (number | null)[] = []
        for (let i = 0; i < diaSemanaInicio; i++) dias.push(null)
        for (let i = 1; i <= diasEnMes; i++) dias.push(i)
        while (dias.length % 7 !== 0) dias.push(null)
        return dias
    }

    function esHoy(dia: number) {
        return dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear()
    }

    function esFechaRevision(dia: number) {
        if (!fechaRevision) return false
        const rev = new Date(fechaRevision + 'T12:00:00')
        return dia === rev.getDate() && mesActual === rev.getMonth() && anioActual === rev.getFullYear()
    }

    // Devuelve el índice de día de semana (0=Lun..6=Dom) para un día del mes
    function diaSemanaDelDia(dia: number): number {
        const d = new Date(anioActual, mesActual, dia)
        // JS: 0=Dom,1=Lun..6=Sáb → convertir a 0=Lun..6=Dom
        return (d.getDay() + 6) % 7
    }

    async function guardarFechaRevision() {
        try {
            const res = await fetch(`/api/clientes/${clienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha_proxima_revision: nuevaFecha || null }),
            })
            if (!res.ok) throw new Error('Error al guardar')
            onUpdateRevision(nuevaFecha || null)
            setEditandoFecha(false)
            addToast({ type: 'success', title: 'Fecha guardada', message: 'Próxima revisión actualizada' })
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar la fecha' })
        }
    }

    const dias = obtenerDiasMes()

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── CALENDARIO ── */}
                <div className="card lg:col-span-2 !p-0 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-3">
                            <button onClick={mesAnterior} className="btn btn-ghost btn-sm !px-2">
                                <ChevronLeft size={18} />
                            </button>
                            <h3 className="font-bold text-[var(--text)] min-w-[180px] text-center">
                                {MESES[mesActual]} {anioActual}
                            </h3>
                            <button onClick={mesSiguiente} className="btn btn-ghost btn-sm !px-2">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        <button onClick={irAHoy} className="btn btn-ghost btn-sm" style={{ color: '#0D9488' }}>
                            Hoy
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="p-4">
                        {/* Cabeceras */}
                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {DIAS_SEMANA.map((d, idx) => {
                                const tieneSesion = !!sesionesIndexadas[idx]?.length
                                return (
                                    <div key={d} className="text-center py-1.5 text-xs font-semibold uppercase tracking-wider relative"
                                        style={{ color: tieneSesion ? '#0D9488' : 'var(--text-muted)' }}>
                                        {d}
                                        {tieneSesion && (
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#0D9488' }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Días */}
                        <div className="grid grid-cols-7 gap-1">
                            {dias.map((dia, i) => {
                                if (dia === null) return <div key={i} className="aspect-square" />
                                const diaSemanaIdx = diaSemanaDelDia(dia)
                                const sesionDelDia = sesionesIndexadas[diaSemanaIdx] ?? []
                                const tieneEntreno = sesionDelDia.length > 0
                                const tieneRevision = esFechaRevision(dia)
                                const esHoyFlag = esHoy(dia)
                                const tieneDieta = !!dietaActiva
                                return (
                                    <div key={i} className="aspect-square p-0.5">
                                        <div className={`
                                            w-full h-full rounded-xl flex flex-col items-center justify-center gap-0.5
                                            text-sm transition-all cursor-default relative
                                            ${esHoyFlag ? 'ring-2 ring-teal-500 ring-offset-1 font-bold' : ''}
                                            ${tieneRevision ? 'bg-purple-100 dark:bg-purple-900/30' :
                                              tieneEntreno ? 'bg-teal-50 dark:bg-teal-900/20' :
                                              tieneDieta ? 'bg-gray-50 dark:bg-white/5' : ''}
                                        `}>
                                            <span className="text-xs font-medium leading-none" style={{
                                                color: tieneRevision ? '#7C3AED' : esHoyFlag ? '#0D9488' : 'var(--text-secondary)'
                                            }}>{dia}</span>

                                            {/* Dots de actividad */}
                                            <div className="flex gap-0.5 flex-wrap justify-center max-w-[28px]">
                                                {tieneEntreno && sesionDelDia.slice(0, 3).map((s, si) => (
                                                    <div key={si}
                                                        title={s.nombre}
                                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                        style={{ background: SESION_COLORS[si % SESION_COLORS.length] }}
                                                    />
                                                ))}
                                                {tieneDieta && !tieneEntreno && (
                                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(100,100,100,0.3)' }} />
                                                )}
                                                {tieneRevision && (
                                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#7C3AED' }} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-4 px-4 pb-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-teal-500" />
                            <span>Hoy</span>
                        </div>
                        {sesiones.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full" style={{ background: SESION_COLORS[0] }} />
                                <span>Entrenamiento</span>
                            </div>
                        )}
                        {dietaActiva && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-gray-300" />
                                <span>Dieta activa</span>
                            </div>
                        )}
                        {fechaRevision && (
                            <div className="flex items-center gap-1.5">
                                <CalendarClock size={12} className="text-purple-500" />
                                <span>Revisión</span>
                            </div>
                        )}
                        {loadingSesiones && <span className="opacity-50">Cargando sesiones…</span>}
                    </div>

                    {/* Lista sesiones del plan activo */}
                    {sesiones.length > 0 && (
                        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                Sesiones — {entrenoActivo?.nombre}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {sesiones.map((s, si) => (
                                    <span key={si} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg font-medium"
                                        style={{ background: `${SESION_COLORS[si % SESION_COLORS.length]}18`, color: SESION_COLORS[si % SESION_COLORS.length] }}>
                                        <Dumbbell size={10} />
                                        {s.dia_semana} · {s.nombre}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── PANEL LATERAL ── */}
                <div className="space-y-4">
                    {/* Dieta activa */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F0FDFA' }}>
                                <UtensilsCrossed size={16} style={{ color: '#0D9488' }} />
                            </div>
                            <h3 className="font-semibold text-[var(--text)] text-sm">Plan de dieta</h3>
                        </div>
                        {dietaActiva ? (
                            <div>
                                <p className="text-sm font-medium text-[var(--text)]">{dietaActiva.nombre}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    Desde {new Date(dietaActiva.created_at).toLocaleDateString('es-ES')}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                    <span className="text-xs" style={{ color: '#16A34A' }}>Activo todos los días</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                <AlertCircle size={12} />
                                Sin plan activo
                            </p>
                        )}
                    </div>

                    {/* Rutina activa */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F3E8FF' }}>
                                <Dumbbell size={16} style={{ color: '#7C3AED' }} />
                            </div>
                            <h3 className="font-semibold text-[var(--text)] text-sm">Rutina de entrenos</h3>
                        </div>
                        {entrenoActivo ? (
                            <div>
                                <p className="text-sm font-medium text-[var(--text)]">{entrenoActivo.nombre}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {entrenoActivo.duracion_semanas} semanas · Desde {new Date(entrenoActivo.created_at).toLocaleDateString('es-ES')}
                                </p>
                                {sesiones.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <Scale size={11} style={{ color: '#7C3AED' }} />
                                        <span className="text-xs" style={{ color: '#7C3AED' }}>
                                            {sesiones.length} sesión{sesiones.length !== 1 ? 'es' : ''}/semana
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                <AlertCircle size={12} />
                                Sin rutina activa
                            </p>
                        )}
                    </div>

                    {/* Check-in semanal */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(82,183,136,0.1)' }}>
                                <ClipboardCheck size={16} style={{ color: '#52B788' }} />
                            </div>
                            <h3 className="font-semibold text-[var(--text)] text-sm">Check-in semanal</h3>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            El cliente puede hacer check-in desde su portal en cualquier momento.
                            Se recomienda establecer un día fijo (ej. domingo).
                        </p>
                    </div>

                    {/* Próxima revisión */}
                    <div className="card border-t-2" style={{ borderTopColor: '#7C3AED' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F3E8FF' }}>
                                <CalendarCheck size={16} style={{ color: '#7C3AED' }} />
                            </div>
                            <h3 className="font-semibold text-[var(--text)] text-sm">Próxima revisión</h3>
                        </div>

                        {editandoFecha ? (
                            <div className="space-y-3">
                                <input
                                    type="date"
                                    value={nuevaFecha}
                                    onChange={e => setNuevaFecha(e.target.value)}
                                    className="input text-sm"
                                />
                                <div className="flex gap-2">
                                    <button onClick={guardarFechaRevision} className="btn btn-primary btn-sm flex-1">
                                        Guardar
                                    </button>
                                    <button
                                        onClick={() => { setEditandoFecha(false); setNuevaFecha(fechaRevision || '') }}
                                        className="btn btn-ghost btn-sm"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                                {nuevaFecha && (
                                    <button
                                        onClick={async () => {
                                            setNuevaFecha('')
                                            const res = await fetch(`/api/clientes/${clienteId}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ fecha_proxima_revision: null }),
                                            })
                                            if (res.ok) {
                                                onUpdateRevision(null)
                                                addToast({ type: 'info', title: 'Revisión eliminada' })
                                            }
                                        }}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Eliminar fecha de revisión
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div>
                                {fechaRevision ? (
                                    <div>
                                        <p className="text-lg font-bold" style={{ color: '#7C3AED' }}>
                                            {new Date(fechaRevision + 'T12:00:00').toLocaleDateString('es-ES', {
                                                day: 'numeric', month: 'long', year: 'numeric'
                                            })}
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => { setEditandoFecha(true); setNuevaFecha(fechaRevision) }}
                                                className="btn btn-ghost btn-sm text-xs">
                                                Cambiar fecha
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const res = await fetch(`/api/clientes/${clienteId}`, {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ fecha_proxima_revision: null }),
                                                    })
                                                    if (res.ok) {
                                                        onUpdateRevision(null)
                                                        addToast({ type: 'info', title: 'Revisión eliminada' })
                                                    }
                                                }}
                                                className="btn btn-ghost btn-sm text-xs text-red-500">
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>No hay fecha programada</p>
                                        <button onClick={() => { setEditandoFecha(true); setNuevaFecha('') }}
                                            className="btn btn-primary btn-sm w-full">
                                            <CalendarCheck size={14} /> Programar revisión
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
