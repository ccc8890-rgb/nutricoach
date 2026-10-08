'use client'

import { useState } from 'react'
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
import { Dumbbell, Footprints, CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import ListaEjerciciosExpandible, { type EjercicioDetalle } from './ExpandableExercises'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_ABREV: Record<string, string> = { Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J', Viernes: 'V', Sábado: 'S', Domingo: 'D' }

interface SesionKanban {
    id: string
    nombre: string
    dia_semana: string
    tipo_sesion: 'hibrido' | 'carrera' | 'mixto'
    ejercicios_count: number
    completada: boolean
}

function iconoTipo(tipo: SesionKanban['tipo_sesion'], size = 14) {
    return tipo === 'carrera' ? <Footprints size={size} /> : <Dumbbell size={size} />
}

function SesionCard({ sesion, seleccionada, onSeleccionar }: { sesion: SesionKanban; seleccionada: boolean; onSeleccionar: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sesion.id })
    const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 10 } : undefined

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}
            className={`training-week-session mb-2 touch-none select-none cursor-grab active:cursor-grabbing overflow-hidden ${seleccionada ? 'is-selected' : ''}`}
        >
            <button
                type="button"
                onClick={onSeleccionar}
                className="w-full flex items-start gap-2 p-2 text-left"
                style={{
                    background: seleccionada ? 'var(--metal-bright)' : 'var(--surface-elevated,var(--border))',
                    color: seleccionada ? 'var(--atelier-carbon)' : 'var(--text)',
                    border: '1px solid var(--editorial-rule)',
                    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                    opacity: isDragging ? 0.6 : 1,
                }}
            >
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: sesion.completada ? 'var(--semantic-active-bg)' : 'var(--bg)' }}
                >
                    {sesion.completada ? <CheckCircle2 size={13} style={{ color: 'var(--semantic-active)' }} /> : iconoTipo(sesion.tipo_sesion, 13)}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium leading-tight" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sesion.ejercicios_count} ej.</p>
                </div>
            </button>
        </div>
    )
}

function DiaColumna({ dia, sesiones, seleccionadaId, onSeleccionar }: {
    dia: string
    sesiones: SesionKanban[]
    seleccionadaId: string | null
    onSeleccionar: (id: string) => void
}) {
    const { setNodeRef, isOver } = useDroppable({ id: dia })
    return (
        <div
            ref={setNodeRef}
            className="training-week-day p-2 min-h-[100px] flex-1 min-w-[120px] transition-colors"
            style={{
                background: isOver ? 'var(--editorial-field)' : 'var(--bg)',
                border: `1px ${isOver ? 'solid' : 'dashed'} var(--editorial-rule)`,
            }}
        >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-0.5" style={{ color: 'var(--text-muted)' }}>
                <span className="sm:hidden">{DIAS_ABREV[dia]}</span>
                <span className="hidden sm:inline">{dia}</span>
            </p>
            {sesiones.length === 0 ? (
                <p className="text-[10px] px-0.5" style={{ color: 'var(--text-disabled)' }}>Descanso</p>
            ) : (
                sesiones.map(s => (
                    <SesionCard
                        key={s.id}
                        sesion={s}
                        seleccionada={seleccionadaId === s.id}
                        onSeleccionar={() => onSeleccionar(s.id)}
                    />
                ))
            )}
        </div>
    )
}

export default function EntrenoKanban({ sesiones }: { sesiones: SesionKanban[] }) {
    const [sesionesLocal, setSesionesLocal] = useState(sesiones)
    const [moviendo, setMoviendo] = useState(false)
    const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
    const [detalles, setDetalles] = useState<Record<string, EjercicioDetalle[] | 'cargando'>>({})
    const { addToast } = useToast()
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
        } catch {
            setDetalles(prev => ({ ...prev, [sesionId]: [] }))
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over) return
        const nuevoDia = String(over.id)
        const sesion = sesionesLocal.find(s => s.id === active.id)
        if (!sesion || sesion.dia_semana === nuevoDia) return

        const anterior = sesion.dia_semana
        setSesionesLocal(prev => prev.map(s => s.id === sesion.id ? { ...s, dia_semana: nuevoDia } : s))
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
        } catch (err) {
            setSesionesLocal(prev => prev.map(s => s.id === sesion.id ? { ...s, dia_semana: anterior } : s))
            addToast({ type: 'error', title: (err as Error).message })
        } finally {
            setMoviendo(false)
        }
    }

    return (
        <div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Toca una sesión para ver sus ejercicios, o arrástrala a otro día para moverla.
                {moviendo && <span className="ml-2 inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Guardando…</span>}
            </p>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {DIAS.map(dia => (
                        <DiaColumna
                            key={dia}
                            dia={dia}
                            sesiones={sesionesLocal.filter(s => s.dia_semana === dia)}
                            seleccionadaId={seleccionadaId}
                            onSeleccionar={toggleSeleccion}
                        />
                    ))}
                </div>
            </DndContext>

            {seleccionadaId && (
                <div className="mt-3 rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: 'var(--text)' }}>
                        {sesionesLocal.find(s => s.id === seleccionadaId)?.nombre ?? 'Sesión'}
                    </p>
                    {detalles[seleccionadaId] === 'cargando' ? (
                        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                    ) : (
                        <ListaEjerciciosExpandible ejercicios={(detalles[seleccionadaId] as EjercicioDetalle[]) ?? []} />
                    )}
                </div>
            )}
        </div>
    )
}
