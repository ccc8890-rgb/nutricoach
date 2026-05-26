'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UtensilsCrossed, ChevronDown, ChevronUp, Download, Loader2, ArrowLeftRight, Sparkles, BookOpen, CheckCircle2, RefreshCw, PencilLine, Search, Plus, Trash2, ExternalLink } from 'lucide-react'
import GarminMiniCard from './GarminMiniCard'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Macros, RegistroComidaDia } from '@/types'
import { useToast } from '@/components/ui/Toast'
import AlternativasModal from '@/components/personalizacion/AlternativasModal'
import GenerarComidaModal from '@/components/personalizacion/GenerarComidaModal'
import PlanSemanal from './PlanSemanal'

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
    receta_id?: string | null
    kcal_target?: number | null
    proteinas_target?: number | null
    carbos_target?: number | null
    grasas_target?: number | null
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

interface PlanData {
    id: string
    cliente_id: string
    nombre: string
    descripcion?: string
    comidas?: Comida[]
    created_at: string
    kcal_objetivo?: number | null
    proteinas_objetivo?: number | null
    carbohidratos_objetivo?: number | null
    grasas_objetivo?: number | null
}

const DIAS_NUTRICION = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const DIA_ABR: Record<string, string> = {
    Lunes: 'L',
    Martes: 'M',
    Miércoles: 'X',
    Jueves: 'J',
    Viernes: 'V',
    Sábado: 'S',
    Domingo: 'D',
}

function diaActualEspana() {
    const idx = new Date().getDay()
    return DIAS_NUTRICION[idx === 0 ? 6 : idx - 1]
}

function diaComida(comida: Pick<Comida, 'dia_semana'>) {
    return comida.dia_semana || DIAS_NUTRICION[0]
}

interface MiPlanProps {
    codigo: string
    plan: PlanData
    registros_comidas?: RegistroComidaDia[]
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

interface AlternativaReceta {
    id: string
    nombre: string
    imagen_url?: string | null
    tiene_foto_real?: boolean
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
    tiempo_prep_min?: number
}

interface AlimentoBusqueda {
    id: string
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
    fibra?: number | null
}

type BusquedaComidaState = {
    comidaId: string
    modo: 'receta' | 'alimento'
    query: string
} | null

function MacroRing({
    label,
    value,
    target,
    unit,
    color,
}: {
    label: string
    value: number
    target?: number | null
    unit: string
    color: string
}) {
    const safeTarget = Number(target ?? 0)
    const pct = safeTarget > 0 ? Math.min(125, Math.round((value / safeTarget) * 100)) : 0
    const radius = 27
    const center = 34
    const stroke = 6
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (Math.min(pct, 100) / 100) * circumference
    const delta = safeTarget > 0 ? Math.round(value - safeTarget) : 0
    const deltaText = safeTarget > 0
        ? delta === 0
            ? 'en objetivo'
            : `${Math.abs(delta)}${unit} ${delta > 0 ? 'sobre' : 'faltan'}`
        : 'sin objetivo'

    return (
        <div className="min-w-0 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="mx-auto relative" style={{ width: 68, height: 68 }}>
                <svg width="68" height="68" viewBox={`0 0 ${center * 2} ${center * 2}`}>
                    <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
                    {safeTarget > 0 && (
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={color}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            transform={`rotate(-90 ${center} ${center})`}
                            style={{ transition: 'stroke-dashoffset .35s ease' }}
                        />
                    )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-base font-bold tabular-nums leading-none" style={{ color: 'var(--text)' }}>
                        {Math.round(value)}
                    </span>
                    <span className="text-[10px] leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {unit}
                    </span>
                </div>
            </div>
            <div className="mt-2 text-center">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{label}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: safeTarget > 0 && Math.abs(delta) <= Math.max(5, safeTarget * 0.05) ? color : 'var(--text-muted)' }}>
                    {safeTarget > 0 ? `${pct}% · ${deltaText}` : deltaText}
                </p>
            </div>
        </div>
    )
}

export default function MiPlan({ codigo, plan, registros_comidas }: MiPlanProps) {
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>(
        Object.fromEntries((plan.comidas ?? []).map(c => [c.id, true]))
    )
    const [planLocal, setPlanLocal] = useState<PlanData>(plan)
    const [registros, setRegistros] = useState<Record<string, RegistroComidaDia>>({})
    const [registrando, setRegistrando] = useState<string | null>(null)
    const [anotandoCambio, setAnotandoCambio] = useState<string | null>(null)
    const [textoCambio, setTextoCambio] = useState('')

    // Inicializar registros desde props
    useEffect(() => {
        if (registros_comidas) {
            const map: Record<string, RegistroComidaDia> = {}
            registros_comidas.forEach(r => { map[r.comida_id] = r })
            setRegistros(map)
        }
    }, [registros_comidas])

    async function handleRegistrar(comidaId: string, estado: 'hecha' | 'cambiada' | 'saltada', notas?: string) {
        setRegistrando(comidaId)
        try {
            const res = await fetch(`/api/cliente/${codigo}/registrar-comida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comida_id: comidaId, estado, notas: notas ?? null }),
            })
            if (!res.ok) throw new Error('Error al registrar')
            setRegistros(prev => ({
                ...prev,
                [comidaId]: { ...(prev[comidaId] ?? {}), comida_id: comidaId, estado, notas: notas ?? null } as RegistroComidaDia,
            }))
            addToast({ type: 'success', title: estado === 'hecha' ? 'Comida registrada' : 'Cambio anotado', message: '' })
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'No se pudo registrar la comida' })
        } finally {
            setRegistrando(null)
            setAnotandoCambio(null)
            setTextoCambio('')
        }
    }
    const [modalAlternativas, setModalAlternativas] = useState<ModalAlternativasState | null>(null)
    const [modalGenerar, setModalGenerar] = useState<ModalGenerarState | null>(null)
    const [descargando, setDescargando] = useState(false)
    const [recetasComida, setRecetasComida] = useState<Record<string, RecetaSugerida[]>>({})
    const [loadingRecetas, setLoadingRecetas] = useState<Record<string, boolean>>({})
    const [showRecetas, setShowRecetas] = useState<Record<string, boolean>>({})
    const [vistaActual, setVistaActual] = useState<'hoy' | 'semana'>('hoy')
    const [diaActivo, setDiaActivo] = useState<string>(() => diaActualEspana())
    const [usandoReceta, setUsandoReceta] = useState<string | null>(null)
    const [drawerComidaId, setDrawerComidaId] = useState<string | null>(null)
    const [alternativas, setAlternativas] = useState<AlternativaReceta[]>([])
    const [cargandoAlt, setCargandoAlt] = useState(false)
    const [busquedaComida, setBusquedaComida] = useState<BusquedaComidaState>(null)
    const [resultadosRecetas, setResultadosRecetas] = useState<RecetaSugerida[]>([])
    const [resultadosAlimentos, setResultadosAlimentos] = useState<AlimentoBusqueda[]>([])
    const [buscando, setBuscando] = useState(false)
    const [editandoAlimento, setEditandoAlimento] = useState<string | null>(null)
    const { addToast } = useToast()

    function inferirTipoPlato(nombreComida: string): string | null {
        const n = nombreComida.toLowerCase()
        if (n.includes('desayuno') || n.includes('mañana') && n.includes('primera')) return 'Desayuno'
        if (n.includes('almuerzo') || n.includes('media mañana')) return 'Almuerzo'
        if (n.includes('comida') || n.includes('mediodía') || n.includes('almuerzo principal')) return 'Comida'
        if (n.includes('merienda') || n.includes('post') || n.includes('snack')) return 'Merienda'
        if (n.includes('cena')) return 'Cena'
        return null
    }

    async function usarReceta(comidaId: string, recetaId: string, recetaNombre: string) {
        setUsandoReceta(recetaId)
        try {
            const res = await fetch(`/api/cliente/${codigo}/comidas/${comidaId}/receta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receta_id: recetaId }),
            })
            if (!res.ok) throw new Error('Error al aplicar la receta')
            const { ingredientes, receta } = await res.json() as { ingredientes: AlimentoEnComida[]; receta?: Comida['receta'] }

            setPlanLocal(prev => ({
                ...prev,
                comidas: (prev.comidas ?? []).map(c =>
                    c.id === comidaId ? { ...c, receta_id: receta?.id ?? recetaId, receta: receta ?? c.receta, alimentos: ingredientes } : c
                )
            }))

            // Invalidar caché de sugerencias para esta comida (la composición cambió)
            setRecetasComida(prev => { const next = { ...prev }; delete next[comidaId]; return next })
            setShowRecetas(prev => ({ ...prev, [comidaId]: false }))
            setDrawerComidaId(null)
            setBusquedaComida(null)

            addToast({ title: `"${recetaNombre}" aplicada para hoy`, type: 'success' })
        } catch {
            addToast({ title: 'Error al aplicar la receta', type: 'error' })
        } finally {
            setUsandoReceta(null)
        }
    }

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

    async function handleElegirAlternativa(
        alternativa: { id: string; nombre: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number; categoria: string | null },
        gramosAlternativa: number
    ) {
        if (!modalAlternativas) return
        const targetAfId = modalAlternativas.afId
        const comida = (planLocal.comidas ?? []).find(c => (c.alimentos ?? []).some(af => af.id === targetAfId))
        if (!comida) return

        setEditandoAlimento(targetAfId)
        try {
            const res = await fetch(`/api/cliente/${codigo}/comidas/${comida.id}/alimentos/${targetAfId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alimento_id: alternativa.id, cantidad_gramos: gramosAlternativa }),
            })
            if (!res.ok) throw new Error('No se pudo guardar el intercambio')
        } catch {
            addToast({ title: 'No se pudo guardar el intercambio', type: 'error' })
            setEditandoAlimento(null)
            return
        }
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
        setEditandoAlimento(null)
        addToast({ title: 'Alternativa seleccionada', type: 'success' })
    }

    function handleAceptarComida() {
        setModalGenerar(null)
        addToast({ title: 'Comida guardada como preferencia', type: 'success' })
    }

    async function toggleRecetasComida(comidaId: string, comidaNombre: string, macros: { calorias: number; proteinas: number }) {
        if (showRecetas[comidaId]) {
            setShowRecetas(prev => ({ ...prev, [comidaId]: false }))
            return
        }
        setShowRecetas(prev => ({ ...prev, [comidaId]: true }))
        if (recetasComida[comidaId]) return  // ya cargadas
        setLoadingRecetas(prev => ({ ...prev, [comidaId]: true }))
        try {
            const tipo = inferirTipoPlato(comidaNombre)
            const params = new URLSearchParams({
                kcal: String(Math.round(macros.calorias)),
                proteinas: String(Math.round(macros.proteinas)),
                limite: '4',
                ...(planLocal.cliente_id ? { cliente_id: planLocal.cliente_id } : {}),
                ...(tipo ? { tipo_plato: tipo } : {}),
            })
            const res = await fetch(`/api/recetas/sugeridas?${params}`)
            const { recetas } = await res.json() as { recetas: RecetaSugerida[] }
            setRecetasComida(prev => ({ ...prev, [comidaId]: recetas }))
        } finally {
            setLoadingRecetas(prev => ({ ...prev, [comidaId]: false }))
        }
    }

    async function abrirDrawerAlternativas(comidaId: string) {
        setDrawerComidaId(comidaId)
        setCargandoAlt(true)
        setAlternativas([])
        try {
            const res = await fetch(`/api/cliente/${codigo}/comidas/${comidaId}/alternativas`)
            const data = await res.json() as { alternativas?: AlternativaReceta[] }
            setAlternativas(data.alternativas ?? [])
        } catch {
            // drawer mostrará vacío
        } finally {
            setCargandoAlt(false)
        }
    }

    function abrirBusqueda(comidaId: string, modo: 'receta' | 'alimento') {
        setBusquedaComida({ comidaId, modo, query: '' })
        setResultadosRecetas([])
        setResultadosAlimentos([])
    }

    async function ejecutarBusqueda(nextState?: BusquedaComidaState) {
        const state = nextState ?? busquedaComida
        if (!state) return
        const comida = (planLocal.comidas ?? []).find(c => c.id === state.comidaId)
        if (!comida) return

        const query = state.query.trim()
        if (query.length < 2) {
            setResultadosRecetas([])
            setResultadosAlimentos([])
            return
        }

        setBuscando(true)
        try {
            if (state.modo === 'receta') {
                const macros = calcMacrosComida(comida.alimentos ?? [])
                const tipo = inferirTipoPlato(comida.nombre)
                const params = new URLSearchParams({
                    q: query,
                    kcal: String(Math.round(macros.calorias || comida.kcal_target || 0)),
                    proteinas: String(Math.round(macros.proteinas || comida.proteinas_target || 0)),
                    limite: '7',
                    ...(planLocal.cliente_id ? { cliente_id: planLocal.cliente_id } : {}),
                    ...(tipo ? { tipo_plato: tipo } : {}),
                })
                const res = await fetch(`/api/recetas/sugeridas?${params}`)
                const data = await res.json() as { recetas?: RecetaSugerida[] }
                setResultadosRecetas(data.recetas ?? [])
            } else {
                const res = await fetch(`/api/alimentos?q=${encodeURIComponent(query)}&soloConDatos=true`)
                const data = await res.json() as AlimentoBusqueda[]
                setResultadosAlimentos((data ?? []).slice(0, 10))
            }
        } finally {
            setBuscando(false)
        }
    }

    async function añadirAlimentoManual(comidaId: string, alimento: AlimentoBusqueda, gramos = 100) {
        setEditandoAlimento(alimento.id)
        try {
            const res = await fetch(`/api/cliente/${codigo}/comidas/${comidaId}/alimentos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alimento_id: alimento.id, cantidad_gramos: gramos }),
            })
            if (!res.ok) throw new Error('No se pudo añadir el alimento')
            const data = await res.json() as { alimento: AlimentoEnComida }
            setPlanLocal(prev => ({
                ...prev,
                comidas: (prev.comidas ?? []).map(c =>
                    c.id === comidaId
                        ? { ...c, receta_id: null, receta: null, alimentos: [...(c.alimentos ?? []), data.alimento] }
                        : c
                )
            }))
            setBusquedaComida(null)
            addToast({ title: 'Alimento añadido a la comida', type: 'success' })
        } catch {
            addToast({ title: 'No se pudo añadir el alimento', type: 'error' })
        } finally {
            setEditandoAlimento(null)
        }
    }

    async function eliminarAlimento(comidaId: string, itemId: string) {
        setEditandoAlimento(itemId)
        try {
            const res = await fetch(`/api/cliente/${codigo}/comidas/${comidaId}/alimentos/${itemId}`, {
                method: 'DELETE',
            })
            if (!res.ok) throw new Error('No se pudo eliminar')
            setPlanLocal(prev => ({
                ...prev,
                comidas: (prev.comidas ?? []).map(c =>
                    c.id === comidaId
                        ? { ...c, receta_id: null, receta: null, alimentos: (c.alimentos ?? []).filter(af => af.id !== itemId) }
                        : c
                )
            }))
        } catch {
            addToast({ title: 'No se pudo eliminar el alimento', type: 'error' })
        } finally {
            setEditandoAlimento(null)
        }
    }

    // Usar plan original (no planLocal) para PlanSemanal — evita re-ejecutar
    // el useEffect cada vez que el usuario hace swap en la vista Hoy
    const comidasParaSemana = useMemo(() => plan.comidas ?? [], [plan.comidas])
    const comidasDia = useMemo(
        () => (planLocal.comidas ?? []).filter(c => diaComida(c) === diaActivo).sort((a, b) => a.orden - b.orden),
        [planLocal.comidas, diaActivo]
    )

    const totalDia = sumarMacros(
        comidasDia.map(c => calcMacrosComida(c.alimentos ?? []))
    )

    // Progreso de adherencia del día
    const comidaIdsDia = new Set(comidasDia.map(c => c.id))
    const totalComidas = comidasDia.length
    const comidasHechas = Object.values(registros).filter(r => comidaIdsDia.has(r.comida_id) && (r.estado === 'hecha' || r.estado === 'cambiada')).length
    const pctAdherencia = totalComidas > 0 ? Math.round((comidasHechas / totalComidas) * 100) : 0

    const ringColor = pctAdherencia >= 80 ? '#22c55e' : pctAdherencia >= 50 ? '#f59e0b' : pctAdherencia > 0 ? '#0D9488' : 'var(--border)'
    const targets = {
        kcal: planLocal.kcal_objetivo ?? null,
        proteinas: planLocal.proteinas_objetivo ?? null,
        carbohidratos: planLocal.carbohidratos_objetivo ?? null,
        grasas: planLocal.grasas_objetivo ?? null,
    }

    const saludo = (() => {
        const h = new Date().getHours()
        if (h < 12) return 'Buenos días'
        if (h < 20) return 'Buenas tardes'
        return 'Buenas noches'
    })()

    return (
        <div className="space-y-4 print-area">
            {/* Toggle Hoy / Semana */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                {(['hoy', 'semana'] as const).map(v => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => setVistaActual(v)}
                        className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                        style={{
                            background: vistaActual === v ? 'var(--primary)' : 'transparent',
                            color: vistaActual === v ? 'white' : 'var(--text-muted)',
                        }}
                    >
                        {v === 'hoy' ? 'Hoy' : 'Semana'}
                    </button>
                ))}
            </div>

            {/* Vista semanal — usa comidasParaSemana (plan original, referencia estable) */}
            {vistaActual === 'semana' && (
                <PlanSemanal comidas={comidasParaSemana} clienteId={planLocal.cliente_id} codigo={codigo} targets={targets} />
            )}

            {/* Vista diaria */}
            {vistaActual === 'hoy' && (<>

            <div className="grid grid-cols-7 gap-1.5">
                {DIAS_NUTRICION.map(dia => {
                    const activo = dia === diaActivo
                    const totalDiaChip = (planLocal.comidas ?? []).filter(c => diaComida(c) === dia).length
                    return (
                        <button
                            key={dia}
                            type="button"
                            onClick={() => setDiaActivo(dia)}
                            className="rounded-2xl border py-2 text-center transition-colors"
                            style={{
                                borderColor: activo ? 'var(--primary)' : 'var(--border)',
                                background: activo ? 'var(--primary-bg)' : 'var(--surface)',
                                color: activo ? 'var(--primary)' : 'var(--text-muted)',
                            }}
                            aria-label={`Ver dieta de ${dia}`}
                        >
                            <span className="block text-xs font-bold">{DIA_ABR[dia]}</span>
                            <span className="block text-[9px] tabular-nums mt-0.5">{totalDiaChip}</span>
                        </button>
                    )
                })}
            </div>

            {/* Resumen macros + adherencia del día */}
            <section className="rounded-3xl border p-4 sm:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                            {saludo}
                        </p>
                        <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--text)' }}>
                            {diaActivo === diaActualEspana() ? 'Dieta de hoy' : `Dieta de ${diaActivo}`}
                        </h2>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {diaActivo === diaActualEspana()
                                ? new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
                                : diaActivo}
                        </p>
                        <p className="text-xs font-semibold mt-1" style={{ color: ringColor }}>
                            {comidasHechas}/{totalComidas} comidas
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <MacroRing label="Energía" value={totalDia.calorias} target={targets.kcal} unit="kcal" color="#34C759" />
                    <MacroRing label="Proteína" value={totalDia.proteinas} target={targets.proteinas} unit="g" color="#FF3B30" />
                    <MacroRing label="Carbohidratos" value={totalDia.carbohidratos} target={targets.carbohidratos} unit="g" color="#FF9500" />
                    <MacroRing label="Grasas" value={totalDia.grasas} target={targets.grasas} unit="g" color="#0A84FF" />
                </div>

                {totalComidas > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                {comidasHechas === totalComidas ? 'Todas las comidas registradas' : `${totalComidas - comidasHechas} comida${totalComidas - comidasHechas !== 1 ? 's' : ''} por registrar`}
                            </span>
                            <span className="text-[11px] font-semibold" style={{ color: ringColor }}>{pctAdherencia}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pctAdherencia}%`, background: ringColor }}
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* Garmin mini-card (solo si tiene integración activa) */}
            <GarminMiniCard codigo={codigo} />

            {/* Comidas */}
            <div className="space-y-3">
                {comidasDia.length === 0 && (
                    <div className="card p-6 text-center">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No hay comidas construidas para {diaActivo}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Revisa la vista semanal o pide a tu coach que complete este día.</p>
                    </div>
                )}
                {comidasDia.map(comida => {
                    const alimentos = comida.alimentos ?? []
                    const macros = calcMacrosComida(alimentos)
                    const expanded = expandidas[comida.id]

                    const registro = registros[comida.id]
                    const yaHecho = registro?.estado === 'hecha'
                    const tieneCambio = registro?.estado === 'cambiada' ? registro?.notas : null
                    const recetaNombre = comida.receta?.nombre ?? comida.nombre

                    return (
                        <div key={comida.id} className="card overflow-hidden !p-0">
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setExpandidas(prev => ({ ...prev, [comida.id]: !prev[comida.id] }))}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        setExpandidas(prev => ({ ...prev, [comida.id]: !prev[comida.id] }))
                                    }
                                }}
                                className="w-full px-5 py-3 flex items-center justify-between transition-colors"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg)' }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: yaHecho ? '#DCFCE7' : 'var(--primary-bg)' }}>
                                        {comida.receta?.imagen_url ? (
                                            <Image src={comida.receta.imagen_url} alt={recetaNombre} width={48} height={48} className="h-full w-full object-cover" sizes="48px" />
                                        ) : yaHecho ? (
                                            <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
                                        ) : (
                                            <UtensilsCrossed size={18} style={{ color: 'var(--primary)' }} />
                                        )}
                                    </div>
                                    <div className="text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                                {comida.nombre}{comida.hora_sugerida ? ` · ${comida.hora_sugerida.slice(0, 5)}` : ''}
                                            </p>
                                            {yaHecho && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Hecho</span>}
                                            {tieneCambio && !yaHecho && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Cambio</span>}
                                        </div>
                                        <p className="font-semibold leading-tight line-clamp-2 mt-0.5" style={{ color: 'var(--text)' }}>
                                            {recetaNombre}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                                {macros.calorias.toFixed(0)} kcal · P {macros.proteinas.toFixed(0)}g
                                            </p>
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); abrirDrawerAlternativas(comida.id) }}
                                                className="text-[10px] font-medium"
                                                style={{ color: 'var(--primary)' }}
                                            >
                                                Cambiar plato
                                            </button>
                                            {comida.receta_id && (
                                                <Link
                                                    href={`/recetas/${comida.receta_id}?returnTo=/cliente/${codigo}`}
                                                    onClick={e => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 text-[10px] font-medium"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                >
                                                    Ver receta <ExternalLink size={10} />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {expanded ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                            </div>

                            {/* S3 — Botones Hecho / Anotar cambio */}
                            {!yaHecho && !anotandoCambio && (
                                <div className="px-5 pb-3 pt-0 flex gap-2 no-print">
                                    <button
                                        type="button"
                                        disabled={registrando === comida.id}
                                        onClick={(e) => { e.stopPropagation(); handleRegistrar(comida.id, 'hecha') }}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all"
                                        style={{ background: '#DCFCE7', color: '#16A34A' }}
                                    >
                                        {registrando === comida.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        Hecho
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setAnotandoCambio(comida.id); setTextoCambio(registro?.notas ?? '') }}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all"
                                        style={{ background: '#FEF3C7', color: '#D97706' }}
                                    >
                                        <PencilLine size={14} />
                                        Anotar cambio
                                    </button>
                                </div>
                            )}

                            {/* Input para anotar cambio */}
                            {anotandoCambio === comida.id && (
                                <div className="px-5 pb-3 pt-0 flex flex-col gap-2 no-print">
                                    <input
                                        type="text"
                                        value={textoCambio}
                                        onChange={e => setTextoCambio(e.target.value)}
                                        placeholder="¿Qué has comido en lugar de esto?"
                                        className="input text-sm py-2"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={registrando === comida.id || !textoCambio.trim()}
                                            onClick={() => handleRegistrar(comida.id, 'cambiada', textoCambio.trim())}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all"
                                            style={{ background: '#FEF3C7', color: '#D97706', opacity: !textoCambio.trim() ? 0.5 : 1 }}
                                        >
                                            {registrando === comida.id ? <Loader2 size={13} className="animate-spin" /> : <PencilLine size={14} />}
                                            Guardar cambio
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setAnotandoCambio(null); setTextoCambio('') }}
                                            className="px-3 text-xs font-medium rounded-lg transition-all"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

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
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            disabled={editandoAlimento === af.id}
                                                            onClick={() => setModalAlternativas({
                                                                afId: af.id,
                                                                alimentoId: af.alimento_id!,
                                                                alimentoNombre: af.alimento?.nombre ?? '',
                                                                gramosOriginal: af.cantidad_gramos,
                                                                kcalPor100g: af.alimento?.calorias ?? 0,
                                                                protPor100g: af.alimento?.proteinas ?? 0,
                                                            })}
                                                            className="p-1.5 rounded-lg transition-colors"
                                                            style={{ color: 'var(--text-muted)' }}
                                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'var(--bg)' }}
                                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                                                            title="Ver alternativas"
                                                        >
                                                            {editandoAlimento === af.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={editandoAlimento === af.id}
                                                            onClick={() => eliminarAlimento(comida.id, af.id)}
                                                            className="p-1.5 rounded-lg transition-colors"
                                                            style={{ color: 'var(--text-muted)' }}
                                                            title="Quitar ingrediente"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <div className="pt-2 border-t text-right text-sm font-medium text-[var(--text-secondary)]" style={{ borderColor: '#F1F5F9' }}>
                                        Total: {macros.calorias.toFixed(0)} kcal · P:{macros.proteinas.toFixed(1)}g · C:{macros.carbohidratos.toFixed(1)}g · G:{macros.grasas.toFixed(1)}g
                                    </div>
                                    <div className="flex gap-2 no-print">
                                        <button
                                            type="button"
                                            onClick={() => abrirBusqueda(comida.id, 'receta')}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors"
                                            style={{ color: 'var(--text)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg)' }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                                        >
                                            <Search size={13} />
                                            Buscar receta
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => abrirBusqueda(comida.id, 'alimento')}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors"
                                            style={{ color: 'var(--text)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg)' }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                                        >
                                            <Plus size={13} />
                                            Añadir alimento
                                        </button>
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
                                            onClick={() => toggleRecetasComida(comida.id, comida.nombre, macros)}
                                            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors"
                                            style={{ color: 'var(--text-muted)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg)' }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                                        >
                                            {loadingRecetas[comida.id]
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : <BookOpen size={13} />}
                                            {showRecetas[comida.id] ? 'Ocultar alternativas' : 'Ver alternativas'}
                                        </button>
                                    </div>

                                    {busquedaComida?.comidaId === comida.id && (
                                        <div className="rounded-2xl border p-3 space-y-3 no-print" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                                            <div className="flex items-center gap-2">
                                                <div className="flex rounded-xl overflow-hidden border shrink-0" style={{ borderColor: 'var(--border)' }}>
                                                    {(['receta', 'alimento'] as const).map(modo => (
                                                        <button
                                                            key={modo}
                                                            type="button"
                                                            onClick={() => {
                                                                const next = { ...busquedaComida, modo, query: busquedaComida.query }
                                                                setBusquedaComida(next)
                                                                setResultadosRecetas([])
                                                                setResultadosAlimentos([])
                                                            }}
                                                            className="px-3 py-2 text-[11px] font-semibold"
                                                            style={{
                                                                background: busquedaComida.modo === modo ? 'var(--primary)' : 'transparent',
                                                                color: busquedaComida.modo === modo ? 'white' : 'var(--text-muted)',
                                                            }}
                                                        >
                                                            {modo === 'receta' ? 'Receta' : 'Alimento'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="relative flex-1 min-w-0">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                                    <input
                                                        value={busquedaComida.query}
                                                        onChange={e => setBusquedaComida({ ...busquedaComida, query: e.target.value })}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') ejecutarBusqueda()
                                                        }}
                                                        placeholder={busquedaComida.modo === 'receta' ? 'Buscar en recetario' : 'Buscar alimento'}
                                                        className="input w-full pl-9 pr-3 py-2 text-sm"
                                                        autoFocus
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => ejecutarBusqueda()}
                                                    disabled={buscando || busquedaComida.query.trim().length < 2}
                                                    className="px-3 py-2 rounded-xl text-xs font-semibold"
                                                    style={{
                                                        background: 'var(--primary)',
                                                        color: 'white',
                                                        opacity: buscando || busquedaComida.query.trim().length < 2 ? 0.55 : 1,
                                                    }}
                                                >
                                                    {buscando ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
                                                </button>
                                            </div>

                                            {busquedaComida.modo === 'receta' && (
                                                <div className="space-y-2">
                                                    {resultadosRecetas.map(receta => (
                                                        <div key={receta.id} className="flex items-center gap-3 rounded-xl p-2 border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                                                            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: 'var(--surface-2)' }}>
                                                                {receta.imagen_url
                                                                    ? <Image src={receta.imagen_url} alt={receta.nombre} width={48} height={48} className="w-full h-full object-cover" sizes="48px" />
                                                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><UtensilsCrossed size={16} /></div>
                                                                }
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>{receta.nombre}</p>
                                                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{receta.kcal} kcal · P {receta.proteinas}g · C {receta.carbohidratos}g · G {receta.grasas}g</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                disabled={usandoReceta === receta.id}
                                                                onClick={() => usarReceta(comida.id, receta.id, receta.nombre)}
                                                                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                                                                style={{ background: 'var(--primary)', color: 'white', opacity: usandoReceta === receta.id ? 0.6 : 1 }}
                                                            >
                                                                {usandoReceta === receta.id ? 'Aplicando' : 'Usar'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {!buscando && busquedaComida.query.trim().length >= 2 && resultadosRecetas.length === 0 && (
                                                        <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Sin recetas para esa búsqueda</p>
                                                    )}
                                                </div>
                                            )}

                                            {busquedaComida.modo === 'alimento' && (
                                                <div className="space-y-2">
                                                    {resultadosAlimentos.map(alimento => (
                                                        <div key={alimento.id} className="flex items-center gap-3 rounded-xl p-2 border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>{alimento.nombre}</p>
                                                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>100g · {Math.round(alimento.calorias)} kcal · P {Math.round(alimento.proteinas)}g</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                disabled={editandoAlimento === alimento.id}
                                                                onClick={() => añadirAlimentoManual(comida.id, alimento)}
                                                                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                                                                style={{ background: 'var(--primary)', color: 'white', opacity: editandoAlimento === alimento.id ? 0.6 : 1 }}
                                                            >
                                                                {editandoAlimento === alimento.id ? 'Añadiendo' : 'Añadir'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {!buscando && busquedaComida.query.trim().length >= 2 && resultadosAlimentos.length === 0 && (
                                                        <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Sin alimentos para esa búsqueda</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Alternativas de recetas accionables */}
                                    {showRecetas[comida.id] && !loadingRecetas[comida.id] && (
                                        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                                                Alternativas para hoy
                                            </p>
                                            {(recetasComida[comida.id] ?? []).length === 0 ? (
                                                <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                                                    No hay recetas con macros similares en el recetario
                                                </p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {(recetasComida[comida.id] ?? []).map(receta => (
                                                        <div
                                                            key={receta.id}
                                                            className="flex items-center gap-3 rounded-xl p-2 border"
                                                            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                                                        >
                                                            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                                                {receta.imagen_url
                                                                    ? <Image src={receta.imagen_url} alt={receta.nombre} width={56} height={56} className="w-full h-full object-cover" sizes="56px" />
                                                                    : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><UtensilsCrossed size={18} /></div>
                                                                }
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium leading-tight line-clamp-2" style={{ color: 'var(--text)' }}>{receta.nombre}</p>
                                                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                                    {receta.kcal} kcal · {receta.proteinas}g P
                                                                    {receta.tiempo_prep_min ? ` · ${receta.tiempo_prep_min} min` : ''}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                disabled={usandoReceta === receta.id}
                                                                onClick={() => usarReceta(comida.id, receta.id, receta.nombre)}
                                                                className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                                                                style={{
                                                                    background: 'var(--primary)',
                                                                    color: 'white',
                                                                    opacity: usandoReceta === receta.id ? 0.6 : 1,
                                                                }}
                                                            >
                                                                {usandoReceta === receta.id
                                                                    ? <Loader2 size={10} className="animate-spin" />
                                                                    : <RefreshCw size={10} />
                                                                }
                                                                Usar
                                                            </button>
                                                        </div>
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

            {/* Botón Descargar PDF */}
            <button
                onClick={handleDescargarPDF}
                disabled={descargando}
                className="btn btn-primary btn-lg w-full no-print"
            >
                {descargando ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {descargando ? 'Generando...' : 'Descargar plan en PDF'}
            </button>

            </>)}

            {/* Modal alternativas */}
            {modalAlternativas && (
                <AlternativasModal
                    alimentoId={modalAlternativas.alimentoId}
                    alimentoNombre={modalAlternativas.alimentoNombre}
                    gramosOriginal={modalAlternativas.gramosOriginal}
                    kcalPor100g={modalAlternativas.kcalPor100g}
                    protPor100g={modalAlternativas.protPor100g}
                    clienteId={planLocal.cliente_id}
                    codigo={codigo}
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

            {/* Drawer alternativas por comida */}
            {drawerComidaId && (
                <div
                    className="fixed inset-0 z-50 flex items-end bg-black/40"
                    onClick={() => setDrawerComidaId(null)}
                >
                    <div
                        className="w-full rounded-t-2xl p-5 pb-safe max-h-[80vh] overflow-y-auto shadow-2xl"
                        style={{ background: 'var(--surface)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--border)' }} />
                        <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Cambiar plato</h3>
                        {cargandoAlt ? (
                            <div className="flex justify-center py-8">
                                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                            </div>
                        ) : alternativas.length === 0 ? (
                            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No hay alternativas disponibles</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {alternativas.map(alt => (
                                    <div key={alt.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                                        {alt.imagen_url ? (
                                            <img
                                                src={alt.imagen_url}
                                                alt={alt.nombre}
                                                width={56}
                                                height={56}
                                                className="rounded-lg object-cover shrink-0 w-14 h-14"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #ecfdf5, #ccfbf1)' }}>
                                                <UtensilsCrossed size={20} style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{alt.nombre}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{alt.kcal} kcal · {alt.proteinas}g P</p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={usandoReceta === alt.id}
                                            onClick={() => drawerComidaId && usarReceta(drawerComidaId, alt.id, alt.nombre)}
                                            className="text-xs font-medium px-3 py-1.5 rounded-lg border shrink-0"
                                            style={{ color: 'var(--primary)', borderColor: 'var(--primary)', opacity: usandoReceta === alt.id ? 0.6 : 1 }}
                                        >
                                            {usandoReceta === alt.id ? 'Aplicando' : 'Usar'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
