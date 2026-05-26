'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
    dia_semana?: string | null
    hora_sugerida?: string
    receta?: {
        id: string
        nombre: string
        imagen_url: string | null
        kcal: number
        proteinas: number
        carbohidratos: number
        grasas: number
        tiempo_prep_min: number | null
    } | null
    alimentos?: AlimentoEnComida[]
}

interface PlanSemanalProps {
    comidas: Comida[]
    clienteId?: string
    codigo?: string
    targets?: {
        kcal?: number | null
        proteinas?: number | null
        carbohidratos?: number | null
        grasas?: number | null
    }
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

function normalizarDiaNutricion(dia: string | null | undefined): number {
    if (!dia) return 0
    const d = dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const idx = DIAS.map(x => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).findIndex(k => d.includes(k))
    return idx >= 0 ? idx : 0
}

export default function PlanSemanal({ comidas, targets, codigo }: PlanSemanalProps) {
    const [diaSeleccionado, setDiaSeleccionado] = useState(0)
    const comidasDia = comidas
        .filter(comida => normalizarDiaNutricion(comida.dia_semana) === diaSeleccionado)
        .slice()
        .sort((a, b) => a.orden - b.orden)

    // Macro totales del día seleccionado (suma de recetas asignadas)
    const totalDia = comidasDia.reduce(
        (acc, comida) => {
            const macros = calcMacros(comida.alimentos ?? [])
            return {
                kcal: acc.kcal + macros.calorias,
                proteinas: acc.proteinas + macros.proteinas,
                carbohidratos: acc.carbohidratos + macros.carbohidratos,
                grasas: acc.grasas + macros.grasas,
            }
        },
        { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 }
    )

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
                <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
                                {DIAS[diaSeleccionado]}
                            </p>
                            <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                                {totalDia.kcal.toFixed(0)}{' '}
                                <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>kcal</span>
                            </p>
                        </div>
                        {targets?.kcal ? (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                                {Math.round((totalDia.kcal / targets.kcal) * 100)}%
                            </span>
                        ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs font-medium">
                        <span className="rounded-xl px-2 py-1.5 text-center" style={{ color: '#FF3B30', background: 'var(--bg)' }}>P {totalDia.proteinas.toFixed(0)}g</span>
                        <span className="rounded-xl px-2 py-1.5 text-center" style={{ color: '#FF9500', background: 'var(--bg)' }}>C {totalDia.carbohidratos.toFixed(0)}g</span>
                        <span className="rounded-xl px-2 py-1.5 text-center" style={{ color: '#0A84FF', background: 'var(--bg)' }}>G {totalDia.grasas.toFixed(0)}g</span>
                    </div>
                </div>
            )}

            {/* Comidas del día seleccionado */}
            <div className="space-y-3">
                {comidasDia.length === 0 && (
                    <div className="card !p-5 text-center">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Sin comidas asignadas</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Este día todavía no tiene dieta construida.</p>
                    </div>
                )}
                {comidasDia
                    .map(comida => {
                        const receta = comida.receta
                        const macrosBase = calcMacros(comida.alimentos ?? [])

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
                                                : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>—</div>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text)' }}>
                                                {receta.nombre}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {macrosBase.calorias.toFixed(0)} kcal · {macrosBase.proteinas.toFixed(0)}g P
                                                {receta.tiempo_prep_min ? ` · ${receta.tiempo_prep_min} min` : ''}
                                            </p>
                                        </div>
                                        {codigo && (
                                            <Link
                                                href={`/recetas/${receta.id}?returnTo=/cliente/${codigo}`}
                                                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                                                style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
                                            >
                                                Ver
                                            </Link>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                                        Sin receta asignada. Revisa ingredientes y macros de esta comida.
                                    </p>
                                )}
                            </div>
                        )
                    })}
            </div>
        </div>
    )
}
