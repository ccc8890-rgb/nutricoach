'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
    ChevronLeft, ChevronRight, UtensilsCrossed, Dumbbell,
    CalendarClock, CalendarCheck, AlertCircle, Scale, ClipboardCheck,
    X
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
    const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null)
    const detalleRef = useRef<HTMLDivElement>(null)

    const dietaActiva = useMemo(() => dietas.find(d => d.activo), [dietas])
    const entrenoActivo = useMemo(() => entrenos.find(e => e.activo), [entrenos])

    useEffect(() => {
        if (!entrenoActivo) { setSesiones([]); return }
        const planId = entrenoActivo.id
        let cancelado = false
        setLoadingSesiones(true)

        async function cargarSesiones() {
            try {
                const { data } = await supabase
                    .from('sesiones_entrenamiento')
                    .select('nombre, dia_semana')
                    .eq('plan_id', planId)
                    .not('dia_semana', 'is', null)
                if (cancelado) return
                setSesiones((data ?? []) as SesionCalendario[])
            } catch {
                if (!cancelado) setSesiones([])
            } finally {
                if (!cancelado) setLoadingSesiones(false)
            }
        }

        cargarSesiones()
        return () => { cancelado = true }
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
        setDiaSeleccionado(null)
    }

    function mesSiguiente() {
        if (mesActual === 11) { setMesActual(0); setAnioActual(prev => prev + 1) }
        else setMesActual(prev => prev + 1)
        setDiaSeleccionado(null)
    }

    function irAHoy() { setMesActual(hoy.getMonth()); setAnioActual(hoy.getFullYear()); setDiaSeleccionado(hoy.getDate()) }

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

    function diaSemanaDelDia(dia: number): number {
        const d = new Date(anioActual, mesActual, dia)
        return (d.getDay() + 6) % 7
    }

    function formatearFecha(dia: number): string {
        return new Date(anioActual, mesActual, dia).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
    }

    function handleDiaClick(dia: number) {
        setDiaSeleccionado(prev => prev === dia ? null : dia)
    }

    // Sincronizar nuevaFecha con cambios externos de fechaRevision
    useEffect(() => {
        if (!editandoFecha) {
            setNuevaFecha(fechaRevision || '')
        }
    }, [fechaRevision, editandoFecha])

    // Cerrar detalle al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (detalleRef.current && !detalleRef.current.contains(e.target as Node)) {
                const target = e.target as HTMLElement
                if (target.closest('[data-cal-day]')) return
                setDiaSeleccionado(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function eliminarRevision() {
        try {
            setNuevaFecha('')
            const res = await fetch(`/api/clientes/${clienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha_proxima_revision: null }),
            })
            if (!res.ok) throw new Error('Error al eliminar')
            onUpdateRevision(null)
            addToast({ type: 'info', title: 'Revisión eliminada' })
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'No se pudo eliminar la revisión' })
        }
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

    // Info del día seleccionado
    const infoDiaSeleccionado = useMemo(() => {
        if (diaSeleccionado === null) return null
        const diaSemanaIdx = diaSemanaDelDia(diaSeleccionado)
        const sesionesDelDia = sesionesIndexadas[diaSemanaIdx] ?? []
        const tieneRevision = esFechaRevision(diaSeleccionado)
        const esHoyFlag = esHoy(diaSeleccionado)
        return {
            dia: diaSeleccionado,
            fecha: formatearFecha(diaSeleccionado),
            diaSemana: DIAS_SEMANA[diaSemanaIdx],
            sesiones: sesionesDelDia,
            tieneRevision,
            esHoy: esHoyFlag,
            tieneDieta: !!dietaActiva,
        }
    }, [diaSeleccionado, sesionesIndexadas, fechaRevision, mesActual, anioActual, dietaActiva])

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* ── CALENDARIO ── */}
                <div className="card xl:col-span-2 !p-0 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 sm:p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-1 sm:gap-3">
                            <button onClick={mesAnterior} className="btn btn-ghost btn-sm !px-1.5 sm:!px-2" aria-label="Mes anterior">
                                <ChevronLeft size={18} />
                            </button>
                            <h3 className="font-bold text-[var(--text)] text-xs sm:text-sm md:text-base min-w-[130px] sm:min-w-[180px] text-center">
                                {MESES[mesActual]} {anioActual}
                            </h3>
                            <button onClick={mesSiguiente} className="btn btn-ghost btn-sm !px-1.5 sm:!px-2" aria-label="Mes siguiente">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        <button onClick={irAHoy} className="btn btn-ghost btn-sm text-xs sm:text-sm" style={{ color: '#0D9488' }}>
                            Hoy
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="p-2 sm:p-4">
                        {/* Cabeceras */}
                        <div className="grid grid-cols-7 gap-px sm:gap-1 mb-px sm:mb-1">
                            {DIAS_SEMANA.map((d, idx) => {
                                const tieneSesion = !!sesionesIndexadas[idx]?.length
                                return (
                                    <div key={d} className="text-center py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider relative"
                                        style={{ color: tieneSesion ? '#0D9488' : 'var(--text-muted)' }}>
                                        <span className="hidden sm:inline">{d}</span>
                                        <span className="sm:hidden">{d.charAt(0)}</span>
                                        {tieneSesion && (
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#0D9488' }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Días */}
                        <div className="grid grid-cols-7 gap-px sm:gap-1">
                            {dias.map((dia, i) => {
                                if (dia === null) return <div key={i} className="aspect-square" />
                                const diaSemanaIdx = diaSemanaDelDia(dia)
                                const sesionDelDia = sesionesIndexadas[diaSemanaIdx] ?? []
                                const tieneEntreno = sesionDelDia.length > 0
                                const tieneRevision = esFechaRevision(dia)
                                const esHoyFlag = esHoy(dia)
                                const tieneDieta = !!dietaActiva
                                const estaSeleccionado = diaSeleccionado === dia
                                return (
                                    <div key={i} className="aspect-square p-px sm:p-0.5"
                                        data-cal-day={dia}>
                                        <button
                                            onClick={() => handleDiaClick(dia)}
                                            className={`
                                                w-full h-full rounded-lg sm:rounded-xl flex flex-col items-center justify-center gap-px sm:gap-0.5
                                                text-sm transition-all relative cursor-pointer
                                                ${esHoyFlag ? 'ring-2 ring-teal-500 ring-offset-1 font-bold' : ''}
                                                ${estaSeleccionado ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-50 dark:bg-blue-900/20' : ''}
                                                ${tieneRevision ? 'bg-purple-100 dark:bg-purple-900/30' :
                                                    tieneEntreno ? 'bg-teal-50 dark:bg-teal-900/20' :
                                                        tieneDieta ? 'bg-gray-50 dark:bg-white/5' : 'hover:bg-gray-100 dark:hover:bg-white/10'}
                                                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                                            `}
                                            aria-label={`${dia} de ${MESES[mesActual]} — ${sesionDelDia.length} sesiones${tieneRevision ? ', revisión' : ''}${tieneDieta ? ', dieta activa' : ''}`}
                                        >
                                            <span className="text-[10px] sm:text-xs font-medium leading-none" style={{
                                                color: tieneRevision ? '#7C3AED' : esHoyFlag ? '#0D9488' : 'var(--text-secondary)'
                                            }}>{dia}</span>

                                            {/* Dots de actividad */}
                                            <div className="flex gap-px sm:gap-0.5 flex-wrap justify-center max-w-[20px] sm:max-w-[28px]">
                                                {tieneEntreno && sesionDelDia.slice(0, 3).map((s, si) => (
                                                    <div key={si}
                                                        title={s.nombre}
                                                        className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full flex-shrink-0"
                                                        style={{ background: SESION_COLORS[si % SESION_COLORS.length] }}
                                                    />
                                                ))}
                                                {tieneDieta && !tieneEntreno && (
                                                    <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(100,100,100,0.3)' }} />
                                                )}
                                                {tieneRevision && (
                                                    <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: '#7C3AED' }} />
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 pb-3 sm:pb-4 text-[10px] sm:text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                        <div className="flex items-center gap-1 sm:gap-1.5">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-teal-500" />
                            <span>Hoy</span>
                        </div>
                        {sesiones.length > 0 && (
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ background: SESION_COLORS[0] }} />
                                <span>Entreno</span>
                            </div>
                        )}
                        {dietaActiva && (
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gray-300" />
                                <span>Dieta</span>
                            </div>
                        )}
                        {fechaRevision && (
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <CalendarClock size={10} className="sm:hidden text-purple-500" />
                                <CalendarClock size={12} className="hidden sm:block text-purple-500" />
                                <span>Revisión</span>
                            </div>
                        )}
                        {loadingSesiones && <span className="opacity-50">Cargando…</span>}
                        <span className="text-[9px] sm:text-[10px] opacity-40 ml-auto">
                            Toca un día para ver detalle
                        </span>
                    </div>

                    {/* ── PANEL DE DETALLE DEL DÍA SELECCIONADO ── */}
                    {infoDiaSeleccionado && (
                        <div
                            ref={detalleRef}
                            className="border-t px-3 sm:px-4 py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-sm sm:text-base font-bold text-[var(--text)] capitalize">
                                        {infoDiaSeleccionado.fecha}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {infoDiaSeleccionado.esHoy ? '• Hoy' : ''}
                                        {infoDiaSeleccionado.tieneRevision ? ' • Revisión programada' : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setDiaSeleccionado(null)}
                                    className="btn btn-ghost btn-sm !px-1.5 !py-0.5"
                                    aria-label="Cerrar detalle"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {/* Sesiones de entrenamiento */}
                                {infoDiaSeleccionado.sesiones.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                            <Dumbbell size={12} className="inline mr-1" />
                                            Entrenamiento
                                        </p>
                                        <div className="space-y-1.5">
                                            {infoDiaSeleccionado.sesiones.map((s, si) => (
                                                <div key={si} className="flex items-center gap-2 text-xs sm:text-sm px-2.5 py-1.5 rounded-lg"
                                                    style={{
                                                        background: `${SESION_COLORS[si % SESION_COLORS.length]}12`,
                                                        borderLeft: `3px solid ${SESION_COLORS[si % SESION_COLORS.length]}`
                                                    }}>
                                                    <Dumbbell size={12} style={{ color: SESION_COLORS[si % SESION_COLORS.length] }} />
                                                    <span className="font-medium text-[var(--text)]">{s.nombre}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Dieta activa */}
                                {infoDiaSeleccionado.tieneDieta && (
                                    <div className="flex items-center gap-2 text-xs sm:text-sm px-2.5 py-1.5 rounded-lg"
                                        style={{ background: 'rgba(13,148,136,0.08)', borderLeft: '3px solid #0D9488' }}>
                                        <UtensilsCrossed size={14} style={{ color: '#0D9488' }} />
                                        <span className="font-medium text-[var(--text)]">{dietaActiva?.nombre}</span>
                                    </div>
                                )}

                                {/* Revisión */}
                                {infoDiaSeleccionado.tieneRevision && (
                                    <div className="flex items-center gap-2 text-xs sm:text-sm px-2.5 py-1.5 rounded-lg"
                                        style={{ background: 'rgba(124,58,237,0.08)', borderLeft: '3px solid #7C3AED' }}>
                                        <CalendarCheck size={14} style={{ color: '#7C3AED' }} />
                                        <span className="font-medium text-[var(--text)]">Revisión programada</span>
                                    </div>
                                )}

                                {/* Vacío */}
                                {infoDiaSeleccionado.sesiones.length === 0 && !infoDiaSeleccionado.tieneDieta && !infoDiaSeleccionado.tieneRevision && (
                                    <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                                        No hay nada programado para este día
                                    </p>
                                )}
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
                                        onClick={eliminarRevision}
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
                                                onClick={eliminarRevision}
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
