'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Loader2, RefreshCw } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'

const DIAS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

interface AlimentoEnComida {
    id: string
    alimento_id?: string
    cantidad_gramos: number
    alimento?: {
        nombre: string
        calorias: number
        proteinas: number
        carbohidratos: number
        grasas: number
        fibra: number
    }
}

interface Comida {
    id: string
    nombre: string
    orden: number
    hora_sugerida?: string
    alimentos?: AlimentoEnComida[]
}

interface RecetaSlot {
    id: string
    nombre: string
    imagen_url: string | null
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
    tiempo_prep_min: number | null
}

interface PlanSemanalProps {
    comidas: Comida[]
    clienteId?: string
}

function calcMacros(alimentos: AlimentoEnComida[]) {
    return sumarMacros(alimentos.map(a =>
        calcularMacrosPorCantidad(
            a.alimento?.calorias ?? 0,
            a.alimento?.proteinas ?? 0,
            a.alimento?.carbohidratos ?? 0,
            a.alimento?.grasas ?? 0,
            a.alimento?.fibra ?? 0,
            a.cantidad_gramos
        )
    ))
}

function inferirTipoPlato(nombre: string): string | null {
    const n = nombre.toLowerCase()
    if (n.includes('desayuno')) return 'Desayuno'
    if (n.includes('comida') || n.includes('mediodía') || n.includes('almuerzo principal')) return 'Comida'
    if (n.includes('merienda') || n.includes('post') || n.includes('snack')) return 'Merienda'
    if (n.includes('cena')) return 'Cena'
    if (n.includes('almuerzo')) return 'Almuerzo'
    return null
}

export default function PlanSemanal({ comidas, clienteId }: PlanSemanalProps) {
    const [diaSeleccionado, setDiaSeleccionado] = useState(0)
    // pool: comida.id → lista de recetas disponibles para esa franja
    const [pool, setPool] = useState<Record<string, RecetaSlot[]>>({})
    // semana: [diaIdx][comida.id] = RecetaSlot seleccionada para ese día
    const [semana, setSemana] = useState<Record<string, RecetaSlot | null>[]>(
        Array(7).fill(null).map(() => ({}))
    )
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (comidas.length === 0) return

        async function cargarSugerencias() {
            setLoading(true)
            const newPool: Record<string, RecetaSlot[]> = {}

            await Promise.all(comidas.map(async (comida) => {
                const macros = calcMacros(comida.alimentos ?? [])
                if (macros.calorias <= 0) {
                    newPool[comida.id] = []
                    return
                }
                const tipo = inferirTipoPlato(comida.nombre)
                const params = new URLSearchParams({
                    kcal: String(Math.round(macros.calorias)),
                    proteinas: String(Math.round(macros.proteinas)),
                    limite: '7',
                    ...(clienteId ? { cliente_id: clienteId } : {}),
                    ...(tipo ? { tipo_plato: tipo } : {}),
                })
                try {
                    const res = await fetch(`/api/recetas/sugeridas?${params}`)
                    const { recetas } = await res.json() as { recetas: RecetaSlot[] }
                    newPool[comida.id] = recetas ?? []
                } catch {
                    newPool[comida.id] = []
                }
            }))

            setPool(newPool)

            // Distribuir una receta diferente por día (rotación circular por el pool)
            const newSemana: Record<string, RecetaSlot | null>[] = Array(7).fill(null).map(() => ({}))
            for (const comida of comidas) {
                const recetas = newPool[comida.id] ?? []
                for (let d = 0; d < 7; d++) {
                    newSemana[d][comida.id] = recetas.length > 0
                        ? recetas[d % recetas.length]
                        : null
                }
            }
            setSemana(newSemana)
            setLoading(false)
        }

        cargarSugerencias()
    }, [comidas, clienteId])

    function swapReceta(diaIdx: number, comidaId: string) {
        const recetas = pool[comidaId] ?? []
        if (recetas.length <= 1) return
        const actual = semana[diaIdx][comidaId]
        const actualIdx = recetas.findIndex(r => r.id === actual?.id)
        const nextIdx = (actualIdx + 1) % recetas.length
        setSemana(prev => {
            const next = [...prev]
            next[diaIdx] = { ...next[diaIdx], [comidaId]: recetas[nextIdx] }
            return next
        })
    }

    // Macro totales del día seleccionado (suma de recetas asignadas)
    const totalDia = comidas.reduce(
        (acc, comida) => {
            const r = semana[diaSeleccionado]?.[comida.id]
            if (!r) return acc
            return {
                kcal: acc.kcal + r.kcal,
                proteinas: acc.proteinas + r.proteinas,
                carbohidratos: acc.carbohidratos + r.carbohidratos,
                grasas: acc.grasas + r.grasas,
            }
        },
        { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Generando semana…</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Selector de día */}
            <div className="grid grid-cols-7 gap-1">
                {DIAS_SHORT.map((label, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => setDiaSeleccionado(i)}
                        className="flex items-center justify-center py-2 rounded-xl text-[10px] font-semibold transition-all"
                        style={{
                            background: diaSeleccionado === i ? 'var(--primary)' : 'var(--bg)',
                            color: diaSeleccionado === i ? 'white' : 'var(--text)',
                            border: `1px solid ${diaSeleccionado === i ? 'var(--primary)' : 'var(--border)'}`,
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Resumen macros del día */}
            {totalDia.kcal > 0 && (
                <div className="card !p-4" style={{ borderTop: '3px solid var(--primary)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
                        {DIAS[diaSeleccionado]}
                    </p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                        {totalDia.kcal.toFixed(0)}{' '}
                        <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>kcal</span>
                    </p>
                    <div className="flex gap-4 mt-2 text-xs font-medium">
                        <span style={{ color: 'var(--error)' }}>P {totalDia.proteinas.toFixed(0)}g</span>
                        <span style={{ color: 'var(--warning)' }}>C {totalDia.carbohidratos.toFixed(0)}g</span>
                        <span style={{ color: '#7C3AED' }}>G {totalDia.grasas.toFixed(0)}g</span>
                    </div>
                </div>
            )}

            {/* Comidas del día seleccionado */}
            <div className="space-y-3">
                {comidas
                    .slice()
                    .sort((a, b) => a.orden - b.orden)
                    .map(comida => {
                        const receta = semana[diaSeleccionado]?.[comida.id]
                        const macrosBase = calcMacros(comida.alimentos ?? [])
                        const poolSize = (pool[comida.id] ?? []).length

                        return (
                            <div key={comida.id} className="card !p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                        {comida.nombre}
                                        {comida.hora_sugerida && (
                                            <span className="ml-1 font-normal normal-case">· {comida.hora_sugerida.slice(0, 5)}</span>
                                        )}
                                    </p>
                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                        ~{macrosBase.calorias.toFixed(0)} kcal
                                    </span>
                                </div>

                                {receta ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                                            {receta.imagen_url
                                                ? <Image src={receta.imagen_url} alt={receta.nombre} width={64} height={64} className="w-full h-full object-cover" sizes="64px" />
                                                : <div className="w-full h-full flex items-center justify-center text-2xl">🍽</div>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text)' }}>
                                                {receta.nombre}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {receta.kcal} kcal · {receta.proteinas}g P
                                                {receta.tiempo_prep_min ? ` · ${receta.tiempo_prep_min} min` : ''}
                                            </p>
                                        </div>
                                        {poolSize > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => swapReceta(diaSeleccionado, comida.id)}
                                                className="flex-shrink-0 p-2 rounded-lg transition-colors"
                                                title="Cambiar receta"
                                                style={{ color: 'var(--text-muted)' }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.color = 'var(--primary)'
                                                    e.currentTarget.style.backgroundColor = 'var(--primary-bg)'
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.color = 'var(--text-muted)'
                                                    e.currentTarget.style.backgroundColor = 'transparent'
                                                }}
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                                        Sin receta compatible en el recetario
                                    </p>
                                )}
                            </div>
                        )
                    })}
            </div>

            <p className="text-[10px] text-center pb-2" style={{ color: 'var(--text-muted)' }}>
                Toca <RefreshCw size={9} className="inline mb-0.5" /> para cambiar la receta de cualquier franja
            </p>
        </div>
    )
}
