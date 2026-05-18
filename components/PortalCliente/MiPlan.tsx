'use client'

import { useState, useRef } from 'react'
import { UtensilsCrossed, ChevronDown, ChevronUp, Download, Dumbbell, Loader2, ArrowLeftRight, Sparkles, BookOpen, CheckCircle2, ShoppingCart } from 'lucide-react'
import RecetaDelDia from './RecetaDelDia'
import ListaCompraPortal from './ListaCompraPortal'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Macros } from '@/types'
import { useToast } from '@/components/ui/Toast'
import AlternativasModal from '@/components/personalizacion/AlternativasModal'
import GenerarComidaModal from '@/components/personalizacion/GenerarComidaModal'

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

interface PlanData {
    id: string
    cliente_id: string
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
    onMarcarSesionHecha?: (sesionNombre: string) => void
}

interface ModalAlternativasState {
    afId: string
    alimentoId: string
    alimentoNombre: string
    gramosOriginal: number
    kcalPor100g: number
    protPor100g: number
}

interface ModalGenerarState {
    tipoComida: string
    macrosObjetivo: { kcal: number; proteinas: number; carbohidratos: number; grasas: number }
}

interface RecetaSugerida {
    id: string
    nombre: string
    imagen_url: string | null
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
    tipo_plato: string | null
    tiempo_prep_min: number | null
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

function normalizarDia(dia: string | undefined): number | null {
    if (!dia) return null
    const d = dia.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const idx = DIAS_KEYS.findIndex(k => d.includes(k))
    if (idx >= 0) return idx
    const n = parseInt(d)
    if (!isNaN(n) && n >= 1 && n <= 7) return n - 1
    return null
}

function SemanaEntreno({
    entreno,
    onMarcarHecha,
}: {
    entreno: EntrenoData
    onMarcarHecha?: (nombre: string) => void
}) {
    const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null)
    const sesiones = entreno.sesiones ?? []

    // Mapear sesiones a día de la semana (0=Lun … 6=Dom)
    const porDia: Record<number, Sesion[]> = {}
    const sinDia: Sesion[] = []
    for (const s of sesiones) {
        const idx = normalizarDia(s.dia_semana)
        if (idx !== null) {
            if (!porDia[idx]) porDia[idx] = []
            porDia[idx].push(s)
        } else {
            sinDia.push(s)
        }
    }

    const tieneCalendario = Object.keys(porDia).length > 0
    const sesionesActivas = diaSeleccionado !== null ? (porDia[diaSeleccionado] ?? []) : sinDia

    return (
        <div className="card">
            <div className="flex items-center gap-2 mb-4">
                <Dumbbell size={18} style={{ color: '#0D9488' }} />
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{entreno.nombre}</h3>
                    {entreno.duracion_semanas && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{entreno.duracion_semanas} semanas</p>
                    )}
                </div>
            </div>

            {tieneCalendario && (
                <div className="grid grid-cols-7 gap-1 mb-4">
                    {DIAS_SEMANA.map((label, i) => {
                        const tiene = !!porDia[i]?.length
                        const activo = diaSeleccionado === i
                        return (
                            <button
                                key={i}
                                onClick={() => setDiaSeleccionado(activo ? null : i)}
                                disabled={!tiene}
                                className="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-semibold transition-all"
                                style={{
                                    background: activo ? '#0D9488' : tiene ? 'var(--bg)' : 'transparent',
                                    color: activo ? 'white' : tiene ? 'var(--text)' : 'var(--text-muted)',
                                    border: `1px solid ${activo ? '#0D9488' : tiene ? 'var(--border)' : 'transparent'}`,
                                    opacity: tiene ? 1 : 0.35,
                                }}
                            >
                                {label}
                                {tiene && (
                                    <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ background: activo ? 'rgba(255,255,255,0.7)' : '#0D9488' }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Sesiones del día seleccionado (o todas si no hay calendario) */}
            {(tieneCalendario ? sesionesActivas.length > 0 : true) && (
                <div className="space-y-2">
                    {(tieneCalendario ? sesionesActivas : sesiones).map(sesion => (
                        <div key={sesion.id} className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
                            {!tieneCalendario && sesion.dia_semana && (
                                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{sesion.dia_semana}</p>
                            )}
                            {sesion.ejercicios && sesion.ejercicios.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {sesion.ejercicios
                                        .sort((a, b) => a.orden - b.orden)
                                        .map(ej => (
                                            <span key={ej.id} className="badge badge-gray text-[11px]">
                                                {ej.ejercicio?.nombre}
                                            </span>
                                        ))}
                                </div>
                            )}
                            {onMarcarHecha && (
                                <button
                                    type="button"
                                    onClick={() => onMarcarHecha(sesion.nombre)}
                                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-medium transition-colors"
                                    style={{ color: '#0D9488', border: '1px solid #0D9488' }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.background = '#0D9488'
                                        ;(e.currentTarget as HTMLButtonElement).style.color = 'white'
                                    }}
                                    onMouseLeave={e => {
                                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                                        ;(e.currentTarget as HTMLButtonElement).style.color = '#0D9488'
                                    }}
                                >
                                    <CheckCircle2 size={13} />
                                    Marcar como hecha
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {tieneCalendario && diaSeleccionado === null && (
                <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                    Toca un día para ver la sesión
                </p>
            )}

            {tieneCalendario && diaSeleccionado !== null && sesionesActivas.length === 0 && (
                <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                    Día de descanso 💤
                </p>
            )}
        </div>
    )
}

export default function MiPlan({ codigo, plan, entreno, onMarcarSesionHecha }: MiPlanProps) {
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>(
        Object.fromEntries((plan.comidas ?? []).map(c => [c.id, true]))
    )
    const [planLocal, setPlanLocal] = useState<PlanData>(plan)
    const [modalAlternativas, setModalAlternativas] = useState<ModalAlternativasState | null>(null)
    const [modalGenerar, setModalGenerar] = useState<ModalGenerarState | null>(null)
    const [descargando, setDescargando] = useState(false)
    const [recetasComida, setRecetasComida] = useState<Record<string, RecetaSugerida[]>>({})
    const [loadingRecetas, setLoadingRecetas] = useState<Record<string, boolean>>({})
    const [showRecetas, setShowRecetas] = useState<Record<string, boolean>>({})
    const [listaAbierta, setListaAbierta] = useState(false)
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

    async function handleDescargarPDF() {
        setDescargando(true)
        try {
            window.open(`/api/cliente/${codigo}/plan-pdf`, '_blank')
        } finally {
            setDescargando(false)
        }
    }

    function handleElegirAlternativa(
        alternativa: { id: string; nombre: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number; categoria: string | null },
        gramosAlternativa: number
    ) {
        if (!modalAlternativas) return
        const targetAfId = modalAlternativas.afId
        setPlanLocal(prev => ({
            ...prev,
            comidas: (prev.comidas ?? []).map(comida => ({
                ...comida,
                alimentos: (comida.alimentos ?? []).map(af =>
                    af.id === targetAfId
                        ? {
                            ...af,
                            alimento_id: alternativa.id,
                            cantidad_gramos: gramosAlternativa,
                            alimento: {
                                nombre: alternativa.nombre,
                                calorias: alternativa.kcal,
                                proteinas: alternativa.proteinas,
                                carbohidratos: alternativa.carbohidratos,
                                grasas: alternativa.grasas,
                                fibra: 0,
                            }
                        }
                        : af
                )
            }))
        }))
        setModalAlternativas(null)
        addToast({ title: 'Alternativa seleccionada', type: 'success' })
    }

    function handleAceptarComida() {
        setModalGenerar(null)
        addToast({ title: '¡Comida guardada como preferencia!', type: 'success' })
    }

    async function toggleRecetasComida(comidaId: string, macros: { calorias: number; proteinas: number }) {
        if (showRecetas[comidaId]) {
            setShowRecetas(prev => ({ ...prev, [comidaId]: false }))
            return
        }
        setShowRecetas(prev => ({ ...prev, [comidaId]: true }))
        if (recetasComida[comidaId]) return  // ya cargadas
        setLoadingRecetas(prev => ({ ...prev, [comidaId]: true }))
        try {
            const res = await fetch(
                `/api/recetas/sugeridas?kcal=${Math.round(macros.calorias)}&proteinas=${Math.round(macros.proteinas)}&limite=3`
            )
            const { recetas } = await res.json() as { recetas: RecetaSugerida[] }
            setRecetasComida(prev => ({ ...prev, [comidaId]: recetas }))
        } finally {
            setLoadingRecetas(prev => ({ ...prev, [comidaId]: false }))
        }
    }

    const totalDia = sumarMacros(
        (planLocal.comidas ?? []).map(c => calcMacrosComida(c.alimentos ?? []))
    )

    return (
        <div className="space-y-4 print-area">
            {/* Resumen macros del día */}
            <div className="card !p-5" style={{ borderTop: '3px solid var(--primary)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Total del día</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
                    {totalDia.calorias.toFixed(0)}{' '}
                    <span className="text-lg font-normal" style={{ color: 'var(--text-muted)' }}>kcal</span>
                </p>
                <div className="flex gap-4 mt-3">
                    <div className="macro-pill macro-pill-protein">
                        <span className="text-lg font-bold" style={{ color: 'var(--error)' }}>{totalDia.proteinas.toFixed(0)}g</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Proteínas</span>
                    </div>
                    <div className="macro-pill macro-pill-carbs">
                        <span className="text-lg font-bold" style={{ color: 'var(--warning)' }}>{totalDia.carbohidratos.toFixed(0)}g</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Carbohidratos</span>
                    </div>
                    <div className="macro-pill macro-pill-fat">
                        <span className="text-lg font-bold" style={{ color: '#7C3AED' }}>{totalDia.grasas.toFixed(0)}g</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Grasas</span>
                    </div>
                </div>
            </div>

            {/* Receta del día */}
            <RecetaDelDia kcal={totalDia.calorias} proteinas={totalDia.proteinas} />

            {/* ─── Lista de la Compra ─── */}
            <div className="card !p-0 overflow-hidden">
                <button
                    onClick={() => setListaAbierta(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3"
                >
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={16} style={{ color: '#0D9488' }} />
                        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Lista de la compra</span>
                    </div>
                    {listaAbierta
                        ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                    }
                </button>
                {listaAbierta && (
                    <div className="px-4 pb-4">
                        <ListaCompraPortal codigo={codigo} />
                    </div>
                )}
            </div>

            {/* Comidas */}
            <div className="space-y-3">
                {(planLocal.comidas ?? []).map(comida => {
                    const alimentos = comida.alimentos ?? []
                    const macros = calcMacrosComida(alimentos)
                    const expanded = expandidas[comida.id]

                    return (
                        <div key={comida.id} className="card overflow-hidden !p-0">
                            <button
                                onClick={() => setExpandidas(prev => ({ ...prev, [comida.id]: !prev[comida.id] }))}
                                className="w-full px-5 py-4 flex items-center justify-between transition-colors"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg)' }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary-bg)' }}>
                                        <UtensilsCrossed size={18} style={{ color: 'var(--primary)' }} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{comida.nombre}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {macros.calorias.toFixed(0)} kcal
                                            {comida.hora_sugerida && ` · ${comida.hora_sugerida.slice(0, 5)}`}
                                        </p>
                                    </div>
                                </div>
                                {expanded ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                            </button>

                            {expanded && alimentos.length > 0 && (
                                <div className="border-t px-5 py-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
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
                                            <div key={af.id} className="flex items-center justify-between gap-2 py-1.5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{af.alimento?.nombre}</p>
                                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{af.cantidad_gramos}g</p>
                                                </div>
                                                <div className="text-right text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                                    <p className="font-semibold" style={{ color: 'var(--text)' }}>{m.calorias.toFixed(0)} kcal</p>
                                                    <p>P:{m.proteinas.toFixed(1)} C:{m.carbohidratos.toFixed(1)} G:{m.grasas.toFixed(1)}</p>
                                                </div>
                                                {af.alimento_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setModalAlternativas({
                                                            afId: af.id,
                                                            alimentoId: af.alimento_id!,
                                                            alimentoNombre: af.alimento?.nombre ?? '',
                                                            gramosOriginal: af.cantidad_gramos,
                                                            kcalPor100g: af.alimento?.calorias ?? 0,
                                                            protPor100g: af.alimento?.proteinas ?? 0,
                                                        })}
                                                        className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'var(--bg)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                                                        title="Ver alternativas"
                                                    >
                                                        <ArrowLeftRight size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <div className="pt-2 border-t text-right text-sm font-medium text-gray-700" style={{ borderColor: '#F1F5F9' }}>
                                        Total: {macros.calorias.toFixed(0)} kcal · P:{macros.proteinas.toFixed(1)}g · C:{macros.carbohidratos.toFixed(1)}g · G:{macros.grasas.toFixed(1)}g
                                    </div>
                                    <div className="flex gap-2 no-print">
                                        <button
                                            type="button"
                                            onClick={() => setModalGenerar({
                                                tipoComida: comida.nombre,
                                                macrosObjetivo: {
                                                    kcal: Math.round(macros.calorias),
                                                    proteinas: Math.round(macros.proteinas),
                                                    carbohidratos: Math.round(macros.carbohidratos),
                                                    grasas: Math.round(macros.grasas),
                                                }
                                            })}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors"
                                            style={{ color: 'var(--primary)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--primary-bg)' }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                                        >
                                            <Sparkles size={13} />
                                            Generar con IA
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleRecetasComida(comida.id, macros)}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors"
                                            style={{ color: 'var(--text-muted)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg)' }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                                        >
                                            {loadingRecetas[comida.id]
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : <BookOpen size={13} />}
                                            {showRecetas[comida.id] ? 'Ocultar recetas' : 'Recetas compatibles'}
                                        </button>
                                    </div>

                                    {/* Mini-galería de recetas sugeridas */}
                                    {showRecetas[comida.id] && !loadingRecetas[comida.id] && (
                                        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                            {(recetasComida[comida.id] ?? []).length === 0 ? (
                                                <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                                                    No hay recetas con macros similares en el recetario
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-2 pt-1">
                                                    {(recetasComida[comida.id] ?? []).map(receta => (
                                                        <a
                                                            key={receta.id}
                                                            href={`/recetas/${receta.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block rounded-xl overflow-hidden border transition-shadow hover:shadow-md"
                                                            style={{ borderColor: 'var(--border)' }}
                                                        >
                                                            <div className="aspect-square bg-gray-100 relative">
                                                                {receta.imagen_url
                                                                    ? <img src={receta.imagen_url} alt={receta.nombre} className="w-full h-full object-cover" />
                                                                    : <div className="w-full h-full flex items-center justify-center text-2xl">🍽</div>
                                                                }
                                                            </div>
                                                            <div className="p-1.5">
                                                                <p className="text-[10px] font-medium leading-tight line-clamp-2" style={{ color: 'var(--text)' }}>{receta.nombre}</p>
                                                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{receta.kcal} kcal · {receta.proteinas}g P</p>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {expanded && alimentos.length === 0 && (
                                <div className="border-t px-5 py-4 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                    Sin alimentos asignados
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Plan de entrenamiento — Vista semanal */}
            {entreno && <SemanaEntreno entreno={entreno} onMarcarHecha={onMarcarSesionHecha} />}

            {/* Botón Descargar PDF */}
            <button
                onClick={handleDescargarPDF}
                disabled={descargando}
                className="btn btn-primary btn-lg w-full no-print"
            >
                {descargando ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {descargando ? 'Generando...' : 'Descargar plan en PDF'}
            </button>

            {/* Modal alternativas */}
            {modalAlternativas && (
                <AlternativasModal
                    alimentoId={modalAlternativas.alimentoId}
                    alimentoNombre={modalAlternativas.alimentoNombre}
                    gramosOriginal={modalAlternativas.gramosOriginal}
                    kcalPor100g={modalAlternativas.kcalPor100g}
                    protPor100g={modalAlternativas.protPor100g}
                    clienteId={planLocal.cliente_id}
                    onElegir={handleElegirAlternativa}
                    onCerrar={() => setModalAlternativas(null)}
                />
            )}

            {/* Modal generar comida IA */}
            {modalGenerar && (
                <GenerarComidaModal
                    clienteId={planLocal.cliente_id}
                    tipoComida={modalGenerar.tipoComida}
                    macrosObjetivo={modalGenerar.macrosObjetivo}
                    onAceptar={handleAceptarComida}
                    onCerrar={() => setModalGenerar(null)}
                />
            )}
        </div>
    )
}
