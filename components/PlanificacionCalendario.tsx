'use client'

import { useState, useMemo } from 'react'
import {
    ChevronLeft, ChevronRight, UtensilsCrossed, Dumbbell,
    CalendarClock, CalendarCheck, AlertCircle
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Props {
    clienteId: string
    fechaRevision: string | null
    dietas: { id: string; nombre: string; activo: boolean; created_at: string }[]
    entrenos: { id: string; nombre: string; activo: boolean; duracion_semanas: number; created_at: string }[]
    onUpdateRevision: (fecha: string | null) => void
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function PlanificacionCalendario({ clienteId, fechaRevision, dietas, entrenos, onUpdateRevision }: Props) {
    const { addToast } = useToast()
    const hoy = new Date()
    const [mesActual, setMesActual] = useState(hoy.getMonth())
    const [anioActual, setAnioActual] = useState(hoy.getFullYear())
    const [editandoFecha, setEditandoFecha] = useState(false)
    const [nuevaFecha, setNuevaFecha] = useState(fechaRevision || '')

    // Navegación
    function mesAnterior() {
        if (mesActual === 0) {
            setMesActual(11)
            setAnioActual(prev => prev - 1)
        } else {
            setMesActual(prev => prev - 1)
        }
    }

    function mesSiguiente() {
        if (mesActual === 11) {
            setMesActual(0)
            setAnioActual(prev => prev + 1)
        } else {
            setMesActual(prev => prev + 1)
        }
    }

    function irAHoy() {
        setMesActual(hoy.getMonth())
        setAnioActual(hoy.getFullYear())
    }

    // Calcular días del calendario
    function obtenerDiasMes() {
        const primerDia = new Date(anioActual, mesActual, 1)
        const ultimoDia = new Date(anioActual, mesActual + 1, 0)
        const diasEnMes = ultimoDia.getDate()

        // Ajustar: 0=Dom, 1=Lun... 6=Sáb → queremos Lun=0
        let diaSemanaInicio = primerDia.getDay() - 1
        if (diaSemanaInicio < 0) diaSemanaInicio = 6

        const dias: (number | null)[] = []

        // Días vacíos antes del primer día
        for (let i = 0; i < diaSemanaInicio; i++) {
            dias.push(null)
        }

        // Días del mes
        for (let i = 1; i <= diasEnMes; i++) {
            dias.push(i)
        }

        // Rellenar para completar la última semana
        while (dias.length % 7 !== 0) {
            dias.push(null)
        }

        return dias
    }

    function esHoy(dia: number) {
        return dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear()
    }

    function esFechaRevision(dia: number) {
        if (!fechaRevision) return false
        const rev = new Date(fechaRevision)
        return dia === rev.getDate() && mesActual === rev.getMonth() && anioActual === rev.getFullYear()
    }

    function formatearFecha(dia: number) {
        return `${anioActual}-${String(mesActual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
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
        } catch (error) {
            console.error('Error guardando fecha revisión:', error)
            addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar la fecha' })
        }
    }

    const dietaActiva = useMemo(() => dietas.find(d => d.activo), [dietas])
    const entrenoActivo = useMemo(() => entrenos.find(e => e.activo), [entrenos])
    const dias = obtenerDiasMes()

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* CALENDARIO */}
                <div className="card lg:col-span-2 !p-0 overflow-hidden">
                    {/* Header calendario */}
                    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E2E8F0' }}>
                        <div className="flex items-center gap-3">
                            <button onClick={mesAnterior} className="btn btn-ghost btn-sm !px-2">
                                <ChevronLeft size={18} />
                            </button>
                            <h3 className="font-bold text-gray-900 min-w-[180px] text-center">
                                {MESES[mesActual]} {anioActual}
                            </h3>
                            <button onClick={mesSiguiente} className="btn btn-ghost btn-sm !px-2">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                        <button onClick={irAHoy} className="btn btn-ghost btn-sm text-teal-600">
                            Hoy
                        </button>
                    </div>

                    {/* Grid calendario */}
                    <div className="p-4">
                        <div className="grid grid-cols-7 gap-1">
                            {/* Cabeceras días */}
                            {DIAS_SEMANA.map(d => (
                                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2 uppercase tracking-wider">
                                    {d}
                                </div>
                            ))}

                            {/* Días */}
                            {dias.map((dia, i) => (
                                <div key={i} className="aspect-square p-1">
                                    {dia !== null && (
                                        <div
                                            className={`
                                                w-full h-full rounded-xl flex flex-col items-center justify-center text-sm
                                                transition-all cursor-default relative
                                                ${esHoy(dia) ? 'ring-2 ring-teal-500 ring-offset-1' : ''}
                                                ${esFechaRevision(dia)
                                                    ? 'bg-purple-100 text-purple-700 font-bold'
                                                    : 'hover:bg-gray-50 text-gray-700'
                                                }
                                            `}
                                        >
                                            <span className="text-xs font-medium">{dia}</span>
                                            {esFechaRevision(dia) && (
                                                <CalendarClock size={10} className="text-purple-500 mt-0.5" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-4 px-4 pb-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-teal-500 ring-1 ring-teal-300" />
                            <span>Hoy</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CalendarClock size={12} className="text-purple-500" />
                            <span>Próxima revisión</span>
                        </div>
                    </div>
                </div>

                {/* PANEL LATERAL - Resumen del plan */}
                <div className="space-y-4">
                    {/* Dieta activa */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F0FDFA' }}>
                                <UtensilsCrossed size={16} style={{ color: '#0D9488' }} />
                            </div>
                            <h3 className="font-semibold text-gray-900 text-sm">Plan de dieta</h3>
                        </div>
                        {dietaActiva ? (
                            <div>
                                <p className="text-sm font-medium text-gray-800">{dietaActiva.nombre}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Desde {new Date(dietaActiva.created_at).toLocaleDateString('es-ES')}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <AlertCircle size={12} style={{ color: '#A1A1A6' }} />
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
                            <h3 className="font-semibold text-gray-900 text-sm">Rutina de entrenos</h3>
                        </div>
                        {entrenoActivo ? (
                            <div>
                                <p className="text-sm font-medium text-gray-800">{entrenoActivo.nombre}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {entrenoActivo.duracion_semanas} semanas · Desde {new Date(entrenoActivo.created_at).toLocaleDateString('es-ES')}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <AlertCircle size={12} style={{ color: '#A1A1A6' }} />
                                Sin rutina activa
                            </p>
                        )}
                    </div>

                    {/* Próxima revisión */}
                    <div className="card border-t-2" style={{ borderTopColor: '#7C3AED' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F3E8FF' }}>
                                <CalendarCheck size={16} style={{ color: '#7C3AED' }} />
                            </div>
                            <h3 className="font-semibold text-gray-900 text-sm">Próxima revisión</h3>
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
                                        <p className="text-lg font-bold text-purple-700">
                                            {new Date(fechaRevision).toLocaleDateString('es-ES', {
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
                                        <p className="text-sm text-gray-400 mb-2">No hay fecha programada</p>
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
