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
import { UtensilsCrossed, Loader2, CalendarDays } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_ABREV: Record<string, string> = { Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J', Viernes: 'V', Sábado: 'S', Domingo: 'D' }
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
}

interface DietaKanbanProps {
    comidas: ComidaKanban[]
    codigo: string
    onMaterializado: () => void
}

function ComidaCard({ comida }: { comida: ComidaKanban }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: comida.id })
    const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 10 } : undefined
    const nombreMostrado = comida.receta?.nombre ?? comida.nombre

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}
            className="mb-1.5 touch-none select-none cursor-grab active:cursor-grabbing rounded-lg overflow-hidden"
            title={nombreMostrado}
        >
            <div
                className="flex items-center gap-1.5 p-1.5"
                style={{
                    background: 'var(--surface-elevated,var(--border))',
                    border: '1px solid var(--border-strong,var(--border))',
                    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                    opacity: isDragging ? 0.6 : 1,
                }}
            >
                <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0" style={{ background: 'var(--bg)' }}>
                    {comida.receta?.imagen_url ? (
                        <Image src={comida.receta.imagen_url} alt={nombreMostrado} width={32} height={32} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <UtensilsCrossed size={12} style={{ color: 'var(--text-muted)' }} />
                        </div>
                    )}
                </div>
                <p className="text-[10px] font-medium leading-tight truncate min-w-0 flex-1" style={{ color: 'var(--text)' }}>{nombreMostrado}</p>
            </div>
        </div>
    )
}

function FranjaLane({ dia, franja, comidas, droppable }: { dia: string; franja: Franja; comidas: ComidaKanban[]; droppable: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: `${dia}|${franja}`, disabled: !droppable })
    return (
        <div
            ref={setNodeRef}
            className="rounded-lg p-1.5 min-h-[44px] transition-colors"
            style={{
                background: isOver ? 'var(--semantic-info-bg)' : 'transparent',
                border: `1px dashed ${isOver ? 'var(--semantic-info-border)' : 'var(--border)'}`,
            }}
        >
            <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-disabled)' }}>{franja}</p>
            {comidas.length === 0 ? (
                <p className="text-[9px]" style={{ color: 'var(--text-disabled)' }}>—</p>
            ) : (
                comidas.map(c => <ComidaCard key={c.id} comida={c} />)
            )}
        </div>
    )
}

function DiaColumna({ dia, comidas }: { dia: string; comidas: ComidaKanban[] }) {
    const otras = comidas.filter(c => franjaDe(c.nombre) === 'Otras')
    return (
        <div className="rounded-xl p-1.5 flex-1 min-w-[130px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-0.5" style={{ color: 'var(--text-muted)' }}>
                <span className="sm:hidden">{DIAS_ABREV[dia]}</span>
                <span className="hidden sm:inline">{dia}</span>
            </p>
            <div className="flex flex-col gap-1.5">
                {FRANJAS.map(franja => (
                    <FranjaLane
                        key={franja}
                        dia={dia}
                        franja={franja}
                        comidas={comidas.filter(c => franjaDe(c.nombre) === franja)}
                        droppable
                    />
                ))}
                {otras.length > 0 && (
                    <FranjaLane dia={dia} franja="Otras" comidas={otras} droppable={false} />
                )}
            </div>
        </div>
    )
}

export default function DietaKanban({ comidas, codigo, onMaterializado }: DietaKanbanProps) {
    const [moviendo, setMoviendo] = useState(false)
    const [materializando, setMaterializando] = useState(false)
    const [comidasLocal, setComidasLocal] = useState(comidas)
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

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over) return
        const [nuevoDia, nuevaFranja] = String(over.id).split('|')
        const comida = comidasLocal.find(c => c.id === active.id)
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
            addToast({
                type: 'success',
                title: nombreNuevo !== nombreAnterior ? `Movida a ${nuevaFranja} · ${nuevoDia}` : `Movida a ${nuevoDia}`,
            })
        } catch (err) {
            setComidasLocal(prev => prev.map(c => c.id === comida.id ? { ...c, dia_semana: diaAnterior, nombre: nombreAnterior } : c))
            addToast({ type: 'error', title: (err as Error).message })
        } finally {
            setMoviendo(false)
        }
    }

    if (hayRecurrentes) {
        return (
            <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <CalendarDays size={28} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Tus comidas se repiten igual cada día</p>
                <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
                    Actívalas por día para poder arrastrarlas y organizar una semana distinta cada vez.
                </p>
                <button
                    onClick={materializar}
                    disabled={materializando}
                    className="btn btn-primary rounded-xl px-5"
                >
                    {materializando ? <Loader2 size={16} className="animate-spin" /> : null}
                    {materializando ? 'Activando…' : 'Activar por día'}
                </button>
            </div>
        )
    }

    return (
        <div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Arrastra un plato a otro día o a otra franja (p. ej. una cena a comida) para reorganizarlo.
                {moviendo && <span className="ml-2 inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Guardando…</span>}
            </p>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {DIAS.map(dia => (
                        <DiaColumna key={dia} dia={dia} comidas={comidasLocal.filter(c => c.dia_semana === dia)} />
                    ))}
                </div>
            </DndContext>
        </div>
    )
}
