'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import {
    DndContext,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Barbell, CaretDown, CheckCircle, PersonSimpleRun, SpinnerGap } from '@phosphor-icons/react'
import { useToast } from '@/components/ui/Toast'
import ListaEjerciciosExpandible, { type EjercicioDetalle } from './ExpandableExercises'
import PasosSesion, { extrasDeRespuesta, type ExtrasSesion } from './PasosSesion'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_ABREV: Record<string, string> = { Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J', Viernes: 'V', Sábado: 'S', Domingo: 'D' }
const SEMANA_ENTRENO_KEY = '/api/entrenos/semana-completa'
const DIA_HOY = DIAS[(new Date().getDay() + 6) % 7]

interface SesionKanban {
    id: string
    nombre: string
    dia_semana: string
    tipo_sesion: 'hibrido' | 'carrera' | 'mixto'
    ejercicios_count: number
    completada: boolean
}

interface SemanaEntrenoCache {
    sesiones?: Array<SesionKanban & { esHoy?: boolean }>
    [key: string]: unknown
}

function actualizarDiaEnCache(datos: SemanaEntrenoCache | undefined, sesionId: string, diaSemana: string) {
    if (!datos?.sesiones) return datos
    return {
        ...datos,
        sesiones: datos.sesiones.map(sesion => sesion.id === sesionId
            ? { ...sesion, dia_semana: diaSemana, esHoy: diaSemana === DIA_HOY }
            : sesion),
    }
}

function iconoTipo(tipo: SesionKanban['tipo_sesion'], size = 14) {
    return tipo === 'carrera' ? <PersonSimpleRun size={size} /> : <Barbell size={size} />
}

function SesionCard({ sesion, seleccionada, moviendo, onSeleccionar, onAbrirMover }: {
    sesion: SesionKanban
    seleccionada: boolean
    moviendo: boolean
    onSeleccionar: () => void
    onAbrirMover: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sesion.id })
    const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 10 } : undefined

    return (
        <div ref={setNodeRef} style={style}
            className={`training-week-session ${seleccionada ? 'is-selected' : ''}`}
        >
            <button
                type="button"
                onClick={onSeleccionar}
                className="training-week-session__main"
                style={{ boxShadow: isDragging ? '0 12px 30px rgba(0,0,0,0.32)' : 'none', opacity: isDragging ? 0.66 : 1 }}
            >
                <span className="training-week-session__type">
                    {sesion.completada ? <CheckCircle size={14} /> : iconoTipo(sesion.tipo_sesion, 14)}
                    {sesion.tipo_sesion === 'carrera' ? 'Carrera' : sesion.tipo_sesion === 'mixto' ? 'Mixto' : 'Fuerza'}
                </span>
                <strong>{sesion.nombre}</strong>
                <span className="training-week-session__meta">{sesion.ejercicios_count} ejercicios</span>
                <CaretDown size={14} className={seleccionada ? 'rotate-180' : ''} />
            </button>
            <button
                type="button"
                className="training-week-session__move"
                onClick={(event) => { event.stopPropagation(); onAbrirMover() }}
                {...listeners}
                {...attributes}
            >
                {moviendo ? 'Cancelar' : 'Mover'}
            </button>
        </div>
    )
}

function DiaColumna({ dia, sesiones, seleccionadaId, moverId, detalles, extras, onSeleccionar, onAbrirMover, onMover }: {
    dia: string
    sesiones: SesionKanban[]
    seleccionadaId: string | null
    moverId: string | null
    detalles: Record<string, EjercicioDetalle[] | 'cargando'>
    extras: Record<string, ExtrasSesion | null>
    onSeleccionar: (id: string) => void
    onAbrirMover: (id: string) => void
    onMover: (dia: string) => void
}) {
    const { setNodeRef, isOver } = useDroppable({ id: dia })
    return (
        <div
            ref={setNodeRef}
            className={`training-week-day ${isOver ? 'is-over' : ''}`}
            style={{
                background: isOver ? 'var(--editorial-field)' : 'transparent',
            }}
        >
            <div className="training-week-day__label"><span>{DIAS_ABREV[dia]}</span><small>{dia.slice(0, 3)}</small></div>
            <div className="training-week-day__content">
                {sesiones.length === 0 ? <p className="training-week-rest">Descanso</p> : sesiones.map(s => (
                    <SesionCard
                        key={s.id}
                        sesion={s}
                        seleccionada={seleccionadaId === s.id}
                        moviendo={moverId === s.id}
                        onSeleccionar={() => onSeleccionar(s.id)}
                        onAbrirMover={() => onAbrirMover(s.id)}
                    />
                ))}
                {moverId && sesiones.some(s => s.id === moverId) && (
                    <div className="training-week-move-picker" aria-label="Mover entrenamiento a otro día">
                        {DIAS.map(destino => <button key={destino} type="button" disabled={destino === dia} onClick={() => onMover(destino)}>{DIAS_ABREV[destino]}</button>)}
                    </div>
                )}
                {seleccionadaId && sesiones.some(s => s.id === seleccionadaId) && (
                    <div className="training-week-detail">
                        <p>{sesiones.find(s => s.id === seleccionadaId)?.nombre ?? 'Sesión'}</p>
                        {detalles[seleccionadaId] === 'cargando' ? (
                            <div className="flex justify-center py-6"><SpinnerGap size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                        ) : (
                            <>
                                {extras[seleccionadaId] && <PasosSesion sesionId={seleccionadaId} {...extras[seleccionadaId]!} />}
                                <ListaEjerciciosExpandible ejercicios={(detalles[seleccionadaId] as EjercicioDetalle[]) ?? []} />
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function EntrenoKanban({ sesiones }: { sesiones: SesionKanban[] }) {
    const [sesionesLocal, setSesionesLocal] = useState(sesiones)
    const [moviendo, setMoviendo] = useState(false)
    const [moverId, setMoverId] = useState<string | null>(null)
    const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
    const [detalles, setDetalles] = useState<Record<string, EjercicioDetalle[] | 'cargando'>>({})
    const [extras, setExtras] = useState<Record<string, ExtrasSesion | null>>({})
    const { addToast } = useToast()
    const { mutate } = useSWRConfig()
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    async function toggleSeleccion(sesionId: string) {
        if (seleccionadaId === sesionId) {
            setSeleccionadaId(null)
            return
        }
        setSeleccionadaId(sesionId)
        if (detalles[sesionId] && detalles[sesionId] !== 'cargando') return
        setDetalles(prev => ({ ...prev, [sesionId]: 'cargando' }))
        try {
            const res = await fetch(`/api/cliente/sesion/${sesionId}`)
            const data = await res.json()
            setDetalles(prev => ({ ...prev, [sesionId]: data.sesion?.ejercicios ?? [] }))
            setExtras(prev => ({ ...prev, [sesionId]: extrasDeRespuesta(data.sesion) }))
        } catch {
            setDetalles(prev => ({ ...prev, [sesionId]: [] }))
        }
    }

    async function moverSesion(sesionId: string, nuevoDia: string) {
        const sesion = sesionesLocal.find(s => s.id === sesionId)
        if (!sesion || sesion.dia_semana === nuevoDia) return

        const anterior = sesion.dia_semana
        setSesionesLocal(prev => prev.map(s => s.id === sesion.id ? { ...s, dia_semana: nuevoDia } : s))
        await mutate<SemanaEntrenoCache>(
            SEMANA_ENTRENO_KEY,
            datos => actualizarDiaEnCache(datos, sesion.id, nuevoDia),
            { revalidate: false },
        )
        setMoviendo(true)
        try {
            const res = await fetch('/api/cliente/entrenos/mover-dia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sesion_id: sesion.id, dia_semana: nuevoDia }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok) throw new Error(data?.error || 'No se pudo mover la sesión')
            addToast({ type: 'success', title: `"${sesion.nombre}" movida a ${nuevoDia}` })
            setMoverId(null)
            void mutate(SEMANA_ENTRENO_KEY)
        } catch (err) {
            setSesionesLocal(prev => prev.map(s => s.id === sesion.id ? { ...s, dia_semana: anterior } : s))
            await mutate<SemanaEntrenoCache>(
                SEMANA_ENTRENO_KEY,
                datos => actualizarDiaEnCache(datos, sesion.id, anterior),
                { revalidate: false },
            )
            addToast({ type: 'error', title: (err as Error).message })
        } finally {
            setMoviendo(false)
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over) return
        await moverSesion(String(active.id), String(over.id))
    }

    return (
        <div>
            <div className="training-week-intro">
                <span>Agenda semanal</span>
                <p>Toca una sesión para desplegarla. Usa <strong>Mover</strong> o arrástrala a otro día.</p>
                {moviendo && <small><SpinnerGap size={11} className="animate-spin" /> Guardando cambio…</small>}
            </div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="training-week-agenda">
                    {DIAS.map(dia => (
                        <DiaColumna
                            key={dia}
                            dia={dia}
                            sesiones={sesionesLocal.filter(s => s.dia_semana === dia)}
                            seleccionadaId={seleccionadaId}
                            moverId={moverId}
                            detalles={detalles}
                            extras={extras}
                            onSeleccionar={toggleSeleccion}
                            onAbrirMover={(id) => setMoverId(current => current === id ? null : id)}
                            onMover={(nuevoDia) => moverId && moverSesion(moverId, nuevoDia)}
                        />
                    ))}
                </div>
            </DndContext>
        </div>
    )
}
