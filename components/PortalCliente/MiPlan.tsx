'use client'

import { useState, useRef } from 'react'
import { UtensilsCrossed, ChevronDown, ChevronUp, Download, Printer, Dumbbell, Loader2 } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Macros } from '@/types'
import { useToast } from '@/components/ui/Toast'
import ListaCompra from '@/components/ListaCompra'

interface AlimentoEnComida {
    id: string
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

interface PlanData {
    id: string
    nombre: string
    descripcion?: string
    comidas?: Comida[]
    created_at: string
}

interface SesionEjercicio {
    id: string
    ejercicio?: { nombre: string; grupo_muscular?: string }
    series?: number
    repeticiones?: string
    descanso_segundos?: number
    peso_sugerido?: string
    notas?: string
    orden: number
}

interface Sesion {
    id: string
    nombre: string
    dia_semana?: string
    ejercicios?: SesionEjercicio[]
}

interface EntrenoData {
    id: string
    nombre: string
    descripcion?: string
    duracion_semanas?: number
    sesiones?: Sesion[]
}

interface MiPlanProps {
    codigo: string
    plan: PlanData
    entreno: EntrenoData | null
}

export default function MiPlan({ codigo, plan, entreno }: MiPlanProps) {
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>(
        Object.fromEntries((plan.comidas ?? []).map(c => [c.id, true]))
    )
    const [descargando, setDescargando] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)
    const { addToast } = useToast()

    function calcMacrosComida(alimentos: AlimentoEnComida[]): Macros {
        return sumarMacros((alimentos ?? []).map(a =>
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

    function handleDescargarPDF() {
        window.print()
    }

    const totalDia = sumarMacros(
        (plan.comidas ?? []).map(c => calcMacrosComida(c.alimentos ?? []))
    )

    return (
        <div className="space-y-4 print-area">
            {/* Resumen macros del día */}
            <div className="card !p-5" style={{ borderTop: '3px solid #0D9488' }}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total del día</p>
                <p className="text-3xl font-bold text-gray-900">
                    {totalDia.calorias.toFixed(0)}{' '}
                    <span className="text-lg font-normal text-gray-400">kcal</span>
                </p>
                <div className="flex gap-4 mt-3">
                    <div className="macro-pill macro-pill-protein">
                        <span className="text-lg font-bold" style={{ color: '#DC2626' }}>{totalDia.proteinas.toFixed(0)}g</span>
                        <span className="text-xs text-gray-500">Proteínas</span>
                    </div>
                    <div className="macro-pill macro-pill-carbs">
                        <span className="text-lg font-bold" style={{ color: '#D97706' }}>{totalDia.carbohidratos.toFixed(0)}g</span>
                        <span className="text-xs text-gray-500">Carbohidratos</span>
                    </div>
                    <div className="macro-pill macro-pill-fat">
                        <span className="text-lg font-bold" style={{ color: '#7C3AED' }}>{totalDia.grasas.toFixed(0)}g</span>
                        <span className="text-xs text-gray-500">Grasas</span>
                    </div>
                </div>
            </div>

            {/* ─── Lista de la Compra ─── */}
            <ListaCompra comidas={plan.comidas ?? []} nombrePlan={plan.nombre} />

            {/* Comidas */}
            <div className="space-y-3">
                {(plan.comidas ?? []).map(comida => {
                    const alimentos = comida.alimentos ?? []
                    const macros = calcMacrosComida(alimentos)
                    const expanded = expandidas[comida.id]

                    return (
                        <div key={comida.id} className="card overflow-hidden !p-0">
                            <button
                                onClick={() => setExpandidas(prev => ({ ...prev, [comida.id]: !prev[comida.id] }))}
                                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F0FDFA' }}>
                                        <UtensilsCrossed size={18} style={{ color: '#0D9488' }} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-900">{comida.nombre}</p>
                                        <p className="text-xs text-gray-400">
                                            {macros.calorias.toFixed(0)} kcal
                                            {comida.hora_sugerida && ` · ${comida.hora_sugerida.slice(0, 5)}`}
                                        </p>
                                    </div>
                                </div>
                                {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                            </button>

                            {expanded && alimentos.length > 0 && (
                                <div className="border-t px-5 py-3 space-y-2" style={{ borderColor: '#F1F5F9' }}>
                                    {alimentos.map(af => {
                                        const m = calcularMacrosPorCantidad(
                                            af.alimento?.calorias ?? 0,
                                            af.alimento?.proteinas ?? 0,
                                            af.alimento?.carbohidratos ?? 0,
                                            af.alimento?.grasas ?? 0,
                                            af.alimento?.fibra ?? 0,
                                            af.cantidad_gramos
                                        )
                                        return (
                                            <div key={af.id} className="flex items-center justify-between py-1.5">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{af.alimento?.nombre}</p>
                                                    <p className="text-xs text-gray-400">{af.cantidad_gramos}g</p>
                                                </div>
                                                <div className="text-right text-xs text-gray-500">
                                                    <p className="font-semibold text-gray-700">{m.calorias.toFixed(0)} kcal</p>
                                                    <p>P:{m.proteinas.toFixed(1)} C:{m.carbohidratos.toFixed(1)} G:{m.grasas.toFixed(1)}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div className="pt-2 border-t text-right text-sm font-medium text-gray-700" style={{ borderColor: '#F1F5F9' }}>
                                        Total: {macros.calorias.toFixed(0)} kcal · P:{macros.proteinas.toFixed(1)}g · C:{macros.carbohidratos.toFixed(1)}g · G:{macros.grasas.toFixed(1)}g
                                    </div>
                                </div>
                            )}

                            {expanded && alimentos.length === 0 && (
                                <div className="border-t px-5 py-4 text-center text-sm text-gray-400" style={{ borderColor: '#F1F5F9' }}>
                                    Sin alimentos asignados
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Plan de entrenamiento si existe */}
            {entreno && (
                <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                        <Dumbbell size={18} style={{ color: '#0D9488' }} />
                        <h3 className="font-semibold text-gray-900">{entreno.nombre}</h3>
                    </div>
                    {entreno.descripcion && <p className="text-sm text-gray-500 mb-2">{entreno.descripcion}</p>}
                    {entreno.duracion_semanas && <p className="text-xs text-gray-400 mb-3">{entreno.duracion_semanas} semanas</p>}

                    <div className="space-y-2">
                        {(entreno.sesiones ?? []).map(sesion => (
                            <div key={sesion.id} className="p-3 rounded-lg" style={{ background: '#F8FAFC' }}>
                                <p className="font-medium text-sm text-gray-800">{sesion.nombre}</p>
                                {sesion.dia_semana && <p className="text-xs text-gray-400">{sesion.dia_semana}</p>}
                                {sesion.ejercicios && sesion.ejercicios.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {sesion.ejercicios.sort((a, b) => a.orden - b.orden).map(ej => (
                                            <span key={ej.id} className="badge badge-gray text-[11px]">
                                                {ej.ejercicio?.nombre}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Botón Imprimir / Guardar PDF */}
            <button
                onClick={handleDescargarPDF}
                className="btn btn-primary btn-lg w-full no-print"
            >
                <Printer size={18} />
                Imprimir / Guardar PDF
            </button>
        </div>
    )
}
