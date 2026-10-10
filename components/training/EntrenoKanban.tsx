'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import {
    DndContext,
    PointerSensor,
    pointerWithin,
    rectIntersection,
    type CollisionDetection,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Barbell, CaretDown, CheckCircle, PersonSimpleRun, SpinnerGap } from '@phosphor-icons/react'
import { useToast } from '@/components/ui/Toast'
import { emitPortalFeedback } from '@/lib/cliente/portal-feedback'
import ListaEjerciciosExpandible, { type EjercicioDetalle } from './ExpandableExercises'
import PasosSesion, { extrasDeRespuesta, type ExtrasSesion } from './PasosSesion'
import { etiquetaTipoSesion, tituloSesionSinModalidad } from '@/lib/training/session-type-presentation'

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

function SesionCard({ sesion, orden, seleccionada, moviendo, onSeleccionar, onAbrirMover }: {
    sesion: SesionKanban
    /** "1/2" cuando el día tiene más de una sesión */
    orden?: string
    seleccionada: boolean
    moviendo: boolean
    onSeleccionar: () => void
    onAbrirMover: () => void
}) {
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: sesion.id })
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: sesion.id })
    const setNodeRef = (el: HTMLDivElement | null) => { setDragRef(el); setDropRef(el) }
    const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 10 } : undefined

    return (
        <div ref={setNodeRef} style={style}
            className={`training-week-session ${seleccionada ? 'is-selected' : ''} ${isOver && !isDragging ? 'is-drop-target' : ''}`}
        >
            <button
                type="button"
                onClick={onSeleccionar}
                className="training-week-session__main"
                style={{ boxShadow: isDragging ? '0 12px 30px rgba(0,0,0,0.32)' : 'none', opacity: isDragging ? 0.66 : 1 }}
            >
                <span className="training-week-session__type">
                    {sesion.completada ? <CheckCircle size={14} /> : iconoTipo(sesion.tipo_sesion, 14)}
                    {etiquetaTipoSesion(sesion.tipo_sesion)}{orden ? ` · ${orden}` : ''}
                </span>
                <strong>{tituloSesionSinModalidad(sesion.nombre, sesion.tipo_sesion)}</strong>
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
            <div className="training-week-day__label"><span>{DIAS_ABREV[dia]}</span><small>{dia.slice(0, 3)}</small>{sesiones.length > 1 && <em className="training-week-day__count">×{sesiones.length}</em>}</div>
            <div className="training-week-day__content">
                {sesiones.length === 0 ? <p className="training-week-rest">Descanso</p> : sesiones.map((s, i) => (
                    <SesionCard
                        key={s.id}
                        sesion={s}
                        orden={sesiones.length > 1 ? `${i + 1}/${sesiones.length}` : undefined}
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
                        <p>{(() => {
                            const sesion = sesiones.find(s => s.id === seleccionadaId)
                            return sesion ? tituloSesionSinModalidad(sesion.nombre, sesion.tipo_sesion) : 'Sesión'
                        })()}</p>
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

// Prefiere la sesión bajo el puntero (reordenar) sobre la columna del día (mover).
const colision: CollisionDetection = (args) => {
    const bajoPuntero = pointerWithin(args)
    const impactos = bajoPuntero.length > 0 ? bajoPuntero : rectIntersection(args)
    const sesiones = impactos.filter(i => !DIAS.includes(String(i.id)) && i.id !== args.active.id)
    return sesiones.length > 0 ? sesiones : impactos.filter(i => i.id !== args.active.id)
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
            emitPortalFeedback(addToast, { type: 'success', title: `"${tituloSesionSinModalidad(sesion.nombre, sesion.tipo_sesion)}" movida a ${nuevoDia}` })
            setMoverId(null)
            void mutate(SEMANA_ENTRENO_KEY)
        } catch (err) {
            setSesionesLocal(prev => prev.map(s => s.id === sesion.id ? { ...s, dia_semana: anterior } : s))
            await mutate<SemanaEntrenoCache>(
                SEMANA_ENTRENO_KEY,
                datos => actualizarDiaEnCache(datos, sesion.id, anterior),
                { revalidate: false },
            )
            emitPortalFeedback(addToast, { type: 'error', title: (err as Error).message })
        } finally {
            setMoviendo(false)
        }
    }

    async function ordenarSesion(sesionId: string, destinoId: string) {
        const delDia = sesionesLocal.filter(s => s.dia_semana === sesionesLocal.find(x => x.id === sesionId)?.dia_semana)
        const desde = delDia.findIndex(s => s.id === sesionId)
        const hasta = delDia.findIndex(s => s.id === destinoId)
        if (desde < 0 || hasta < 0 || desde === hasta) return

        const anterior = sesionesLocal
        // Hacia abajo queda detrás de la otra; hacia arriba, delante: la otra se desplaza.
        const sinMovida = sesionesLocal.filter(s => s.id !== sesionId)
        const movida = sesionesLocal.find(s => s.id === sesionId)!
        const indiceDestino = sinMovida.findIndex(s => s.id === destinoId)
        const nuevo = [...sinMovida]
        nuevo.splice(desde < hasta ? indiceDestino + 1 : indiceDestino, 0, movida)
        setSesionesLocal(nuevo)
        setMoviendo(true)
        try {
            const res = await fetch('/api/cliente/entrenos/ordenar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sesion_id: sesionId, destino_id: destinoId }),
            })
            if (!res.ok) throw new Error('No se pudo cambiar el orden')
            void mutate(SEMANA_ENTRENO_KEY)
        } catch (err) {
            setSesionesLocal(anterior)
            emitPortalFeedback(addToast, { type: 'error', title: (err as Error).message })
        } finally {
            setMoviendo(false)
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const activaId = String(active.id)
        const destino = String(over.id)
        if (DIAS.includes(destino)) return moverSesion(activaId, destino)

        // Soltada sobre otra sesión: mismo día = reordenar; otro día = mover a ese día.
        const origen = sesionesLocal.find(s => s.id === activaId)
        const objetivo = sesionesLocal.find(s => s.id === destino)
        if (!origen || !objetivo) return
        if (origen.dia_semana === objetivo.dia_semana) return ordenarSesion(activaId, destino)
        return moverSesion(activaId, objetivo.dia_semana)
    }

    return (
        <div>
            <div className="training-week-intro">
                <span>Agenda semanal</span>
                <p>Toca una sesión para desplegarla. Arrastra con <strong>Mover</strong>: a otro día para cambiarla de día, o sobre otra sesión del mismo día para reordenarlas. También puedes tocar <strong>Mover</strong> y elegir día.</p>
                {moviendo && <small><SpinnerGap size={11} className="animate-spin" /> Guardando cambio…</small>}
            </div>
            <DndContext sensors={sensors} collisionDetection={colision} onDragEnd={handleDragEnd}>
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
