'use client'

import { useState } from 'react'
import Image from 'next/image'
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
import { CalendarBlank, DotsSixVertical, ForkKnife, SpinnerGap } from '@phosphor-icons/react'
import { useToast } from '@/components/ui/Toast'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// Franjas que Carlos pidió que fueran explícitas para poder intercambiar
// un plato de una franja a otra (p.ej. usar una cena como comida) — no
// solo mover entre días. Cualquier comida cuyo nombre no encaje en estas
// 4 (p.ej. "Snack", "Media mañana") se agrupa aparte en "Otras" para no
// perderla, pero solo estas 4 son destino de arrastre.
const FRANJAS = ['Desayuno', 'Comida', 'Merienda', 'Cena'] as const
type Franja = typeof FRANJAS[number] | 'Otras'

function franjaDe(nombre: string): Franja {
    return (FRANJAS as readonly string[]).includes(nombre) ? (nombre as Franja) : 'Otras'
}

interface ComidaKanban {
    id: string
    nombre: string
    dia_semana?: string | null
    receta?: { nombre: string; imagen_url: string | null; kcal: number } | null
    alimentos?: { cantidad_gramos: number; alimento?: { calorias: number } | null }[]
}

// kcal reales del plato (ingredientes ya escalados), no las de la receta base
function kcalDe(c: ComidaKanban): number {
    if (c.alimentos && c.alimentos.length > 0) {
        return Math.round(c.alimentos.reduce((t, a) => t + ((a.alimento?.calorias ?? 0) * (a.cantidad_gramos ?? 0)) / 100, 0))
    }
    return 0
}
const totalDia = (cs: ComidaKanban[]) => cs.reduce((t, c) => t + kcalDe(c), 0)
interface DietaKanbanProps {
    comidas: ComidaKanban[]
    codigo: string
    kcalObjetivo?: number | null
    onMaterializado: () => void
}

function ComidaCard({
    comida,
    moverAbierto,
    onAbrirMover,
    onMover,
}: {
    comida: ComidaKanban
    moverAbierto: boolean
    onAbrirMover: () => void
    onMover: (dia: string, franja: Franja) => void
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: comida.id })
    const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 10, opacity: 0.62 } : undefined
    const nombreMostrado = comida.receta?.nombre ?? comida.nombre
    const franjaActual = franjaDe(comida.nombre)
    const diaActual = comida.dia_semana || DIAS[0]

    return (
        <div ref={setNodeRef} style={style} className={`diet-week-meal ${isDragging ? 'is-dragging' : ''}`} title={nombreMostrado}>
            <div className="diet-week-meal__main">
                <div className="diet-week-meal__thumb">
                    {comida.receta?.imagen_url ? (
                        <Image src={comida.receta.imagen_url} alt={nombreMostrado} width={48} height={48} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <ForkKnife size={16} weight="regular" />
                        </div>
                    )}
                </div>
                <div className="diet-week-meal__copy">
                    <small>{comida.nombre}</small>
                    <strong>{nombreMostrado}</strong>
                    {kcalDe(comida) > 0 && <span>{kcalDe(comida)} kcal</span>}
                </div>
                <button
                    type="button"
                    className="diet-week-meal__move"
                    onClick={onAbrirMover}
                    aria-expanded={moverAbierto}
                    aria-label={`Mover ${nombreMostrado}`}
                    {...listeners}
                    {...attributes}
                >
                    <DotsSixVertical size={17} weight="bold" />
                    <span>Mover</span>
                </button>
            </div>
            {moverAbierto && (
                <div className="diet-week-move-panel">
                    <div>
                        <span>Día</span>
                        <div className="diet-week-move-panel__options">
                            {DIAS.map(dia => (
                                <button key={dia} type="button" className={dia === diaActual ? 'is-current' : ''} onClick={() => onMover(dia, franjaActual)}>
                                    {dia.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span>Franja</span>
                        <div className="diet-week-move-panel__options is-slots">
                            {FRANJAS.map(franja => (
                                <button key={franja} type="button" className={franja === franjaActual ? 'is-current' : ''} onClick={() => onMover(diaActual, franja)}>
                                    {franja}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function FranjaLane({ dia, franja, comidas, droppable, moverId, onAbrirMover, onMover }: {
    dia: string
    franja: Franja
    comidas: ComidaKanban[]
    droppable: boolean
    moverId: string | null
    onAbrirMover: (id: string) => void
    onMover: (id: string, dia: string, franja: Franja) => void
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `${dia}|${franja}`, disabled: !droppable })
    return (
        <div ref={setNodeRef} className={`diet-week-slot ${isOver ? 'is-over' : ''}`}>
            <p>{franja}</p>
            <div className="diet-week-slot__content">
                {comidas.length === 0 ? (
                    <span className="diet-week-slot__empty">Sin plato</span>
                ) : comidas.map(c => (
                    <ComidaCard
                        key={c.id}
                        comida={c}
                        moverAbierto={moverId === c.id}
                        onAbrirMover={() => onAbrirMover(c.id)}
                        onMover={(nuevoDia, nuevaFranja) => onMover(c.id, nuevoDia, nuevaFranja)}
                    />
                ))}
            </div>
        </div>
    )
}

function DiaSeccion({ dia, indice, comidas, moverId, onAbrirMover, onMover }: {
    dia: string
    indice: number
    comidas: ComidaKanban[]
    moverId: string | null
    onAbrirMover: (id: string) => void
    onMover: (id: string, dia: string, franja: Franja) => void
}) {
    const kcalDia = totalDia(comidas)
    const otras = comidas.filter(c => franjaDe(c.nombre) === 'Otras')
    return (
        <section className="diet-week-day">
            <header className="diet-week-day__head">
                <span>{String(indice + 1).padStart(2, '0')}</span>
                <h3>{dia}</h3>
                <samp>{kcalDia > 0 ? `${kcalDia} KCAL` : 'SIN PLAN'}</samp>
            </header>
            <div className="diet-week-day__slots">
                {FRANJAS.map(franja => (
                    <FranjaLane
                        key={franja}
                        dia={dia}
                        franja={franja}
                        comidas={comidas.filter(c => franjaDe(c.nombre) === franja)}
                        droppable
                        moverId={moverId}
                        onAbrirMover={onAbrirMover}
                        onMover={onMover}
                    />
                ))}
                {otras.length > 0 && (
                    <FranjaLane
                        dia={dia}
                        franja="Otras"
                        comidas={otras}
                        droppable={false}
                        moverId={moverId}
                        onAbrirMover={onAbrirMover}
                        onMover={onMover}
                    />
                )}
            </div>
        </section>
    )
}

export default function DietaKanban({ comidas, codigo, kcalObjetivo = null, onMaterializado }: DietaKanbanProps) {
    const [moviendo, setMoviendo] = useState(false)
    const [materializando, setMaterializando] = useState(false)
    const [comidasLocal, setComidasLocal] = useState(comidas)
    const [moverId, setMoverId] = useState<string | null>(null)
    const { addToast } = useToast()
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    const hayRecurrentes = comidas.some(c => !c.dia_semana)

    async function materializar() {
        setMaterializando(true)
        try {
            const res = await fetch(`/api/cliente/${codigo}/comidas/materializar`, { method: 'POST' })
            const data = await res.json().catch(() => null)
            if (!res.ok) throw new Error(data?.error || 'Error al activar por día')
            addToast({ type: 'success', title: 'Comidas activadas por día', message: 'Ya puedes arrastrarlas entre días.' })
            onMaterializado()
        } catch (err) {
            addToast({ type: 'error', title: 'No se pudo activar por día', message: (err as Error).message })
        } finally {
            setMaterializando(false)
        }
    }

    async function moverComida(comidaId: string, nuevoDia: string, nuevaFranja: Franja) {
        const comida = comidasLocal.find(c => c.id === comidaId)
        if (!comida) return

        const diaAnterior = comida.dia_semana
        const nombreAnterior = comida.nombre
        const franjaActual = franjaDe(comida.nombre)
        if (comida.dia_semana === nuevoDia && franjaActual === nuevaFranja) return

        // Al reencasillar (franja distinta) se renombra la comida a la
        // franja destino; al solo mover de día el nombre no cambia.
        const nombreNuevo = franjaActual === nuevaFranja ? comida.nombre : nuevaFranja

        setComidasLocal(prev => prev.map(c => c.id === comida.id ? { ...c, dia_semana: nuevoDia, nombre: nombreNuevo } : c))
        setMoviendo(true)
        try {
            const res = await fetch(`/api/cliente/${codigo}/comidas/mover-dia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comida_id: comida.id, dia_semana: nuevoDia, nombre: nombreNuevo !== nombreAnterior ? nombreNuevo : undefined }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok) throw new Error(data?.error || 'No se pudo mover la comida')
            const titulo = nombreNuevo !== nombreAnterior ? `Movida a ${nuevaFranja} · ${nuevoDia}` : `Movida a ${nuevoDia}`
            // Aviso si el día destino queda lejos del objetivo (el plato conserva sus cantidades)
            const kcalDestino = totalDia(comidasLocal.filter(c => c.dia_semana === nuevoDia && c.id !== comida.id)) + kcalDe(comida)
            const desvio = kcalObjetivo && kcalDestino > 0 ? (kcalDestino - kcalObjetivo) / kcalObjetivo : 0
            if (Math.abs(desvio) > 0.2) {
                addToast({ type: 'warning', title: titulo, message: `${nuevoDia} queda en ${kcalDestino} kcal (${desvio > 0 ? '+' : ''}${Math.round(desvio * 100)}% sobre el objetivo de ${Math.round(kcalObjetivo!)}).` })
            } else {
                addToast({ type: 'success', title: titulo })
            }
        } catch (err) {
            setComidasLocal(prev => prev.map(c => c.id === comida.id ? { ...c, dia_semana: diaAnterior, nombre: nombreAnterior } : c))
            addToast({ type: 'error', title: (err as Error).message })
        } finally {
            setMoviendo(false)
            setMoverId(null)
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over) return
        const [nuevoDia, nuevaFranja] = String(over.id).split('|')
        await moverComida(String(active.id), nuevoDia, nuevaFranja as Franja)
    }

    if (hayRecurrentes) {
        return (
            <section className="diet-week-activation">
                <div className="diet-week-activation__mark"><CalendarBlank size={20} weight="regular" /></div>
                <div>
                    <span>Semana editable</span>
                    <h3>Tus comidas se repiten igual cada día</h3>
                    <p>Actívalas por día para organizar una semana distinta y mover cada plato de forma independiente.</p>
                </div>
                <button
                    type="button"
                    onClick={materializar}
                    disabled={materializando}
                    className="diet-week-activation__button"
                >
                    {materializando ? <SpinnerGap size={16} className="animate-spin" /> : null}
                    {materializando ? 'Activando…' : 'Activar por día'}
                </button>
            </section>
        )
    }

    return (
        <div className="diet-week-view">
            <div className="diet-week-intro">
                <div>
                    <span>Agenda semanal</span>
                    <p>Revisa todos los platos y usa <strong>Mover</strong> para cambiar su día o franja.</p>
                </div>
                {moviendo && <small><SpinnerGap size={12} className="animate-spin" /> Guardando cambio…</small>}
            </div>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="diet-week-agenda">
                    {DIAS.map((dia, indice) => (
                        <DiaSeccion
                            key={dia}
                            dia={dia}
                            indice={indice}
                            comidas={comidasLocal.filter(c => c.dia_semana === dia)}
                            moverId={moverId}
                            onAbrirMover={(id) => setMoverId(current => current === id ? null : id)}
                            onMover={moverComida}
                        />
                    ))}
                </div>
            </DndContext>
        </div>
    )
}
