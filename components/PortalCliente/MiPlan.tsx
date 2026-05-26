'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UtensilsCrossed, ChevronDown, ChevronUp, Download, Loader2, CheckCircle2, PencilLine, ExternalLink } from 'lucide-react'
import GarminMiniCard from './GarminMiniCard'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Macros, RegistroComidaDia } from '@/types'
import { useToast } from '@/components/ui/Toast'
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
    alternativa_recetas?: Array<{
        id: string
        nombre: string
        imagen_url: string | null
        kcal: number | null
        tiempo_prep_min: number | null
    }>
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

function fechaParaDiaSemana(dia: string) {
    const idx = DIAS_NUTRICION.findIndex(d => d === dia)
    const hoy = new Date()
    const day = hoy.getDay()
    const monday = new Date(hoy)
    monday.setDate(hoy.getDate() - (day === 0 ? 6 : day - 1))
    const target = new Date(monday)
    target.setDate(monday.getDate() + Math.max(0, idx))
    return target.toLocaleDateString('en-CA')
}

function diaComida(comida: Pick<Comida, 'dia_semana'>) {
    return comida.dia_semana || DIAS_NUTRICION[0]
}

interface MiPlanProps {
    codigo: string
    plan: PlanData
    registros_comidas?: RegistroComidaDia[]
}

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
    const planLocal = plan
    const [registros, setRegistros] = useState<Record<string, RegistroComidaDia>>({})
    const [registrando, setRegistrando] = useState<string | null>(null)
    const [anotandoCambio, setAnotandoCambio] = useState<string | null>(null)
    const [textoCambio, setTextoCambio] = useState('')

    // Inicializar registros desde props
    useEffect(() => {
        if (registros_comidas) {
            const map: Record<string, RegistroComidaDia> = {}
            registros_comidas.forEach(r => { map[`${r.comida_id}:${r.fecha ?? ''}`] = r })
            setRegistros(map)
        }
    }, [registros_comidas])

    async function handleRegistrar(comidaId: string, estado: 'hecha' | 'cambiada' | 'saltada', notas?: string) {
        setRegistrando(comidaId)
        const fecha = fechaParaDiaSemana(diaActivo)
        const key = `${comidaId}:${fecha}`
        try {
            const res = await fetch(`/api/cliente/${codigo}/registrar-comida`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comida_id: comidaId, estado, notas: notas ?? null, fecha }),
            })
            if (!res.ok) throw new Error('Error al registrar')
            setRegistros(prev => ({
                ...prev,
                [key]: { ...(prev[key] ?? {}), comida_id: comidaId, fecha, estado, notas: notas ?? null } as RegistroComidaDia,
            }))
            const title = estado === 'hecha' ? 'Comida registrada' : estado === 'saltada' ? 'Comida marcada como no hecha' : 'Cambio anotado'
            addToast({ type: 'success', title, message: '' })
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'No se pudo registrar la comida' })
        } finally {
            setRegistrando(null)
            setAnotandoCambio(null)
            setTextoCambio('')
        }
    }
    const [descargando, setDescargando] = useState(false)
    const [vistaActual, setVistaActual] = useState<'hoy' | 'semana'>('hoy')
    const [diaActivo, setDiaActivo] = useState<string>(() => diaActualEspana())
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
    const fechaDiaActivo = fechaParaDiaSemana(diaActivo)
    const comidasHechas = Object.values(registros).filter(r => comidaIdsDia.has(r.comida_id) && r.fecha === fechaDiaActivo && (r.estado === 'hecha' || r.estado === 'cambiada')).length
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

                    const registro = registros[`${comida.id}:${fechaDiaActivo}`]
                    const yaHecho = registro?.estado === 'hecha'
                    const saltada = registro?.estado === 'saltada'
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
                                            {saltada && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">No hecha</span>}
                                        </div>
                                        <p className="font-semibold leading-tight line-clamp-2 mt-0.5" style={{ color: 'var(--text)' }}>
                                            {recetaNombre}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                                {macros.calorias.toFixed(0)} kcal
                                            </p>
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

                            {(comida.alternativa_recetas ?? []).length > 0 && (
                                <div className="px-5 pb-3 -mt-1 flex flex-wrap gap-2">
                                    {(comida.alternativa_recetas ?? []).slice(0, 3).map(alt => (
                                        <Link
                                            key={alt.id}
                                            href={`/recetas/${alt.id}?returnTo=/cliente/${codigo}`}
                                            className="inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-medium"
                                            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)' }}
                                        >
                                            <span className="truncate max-w-[180px]">{alt.nombre}</span>
                                            {alt.kcal ? <span className="shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>{Math.round(alt.kcal)} kcal</span> : null}
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {/* S3 — Botones Hecho / Anotar cambio */}
                            {!yaHecho && !tieneCambio && !saltada && !anotandoCambio && (
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
                                    <button
                                        type="button"
                                        disabled={registrando === comida.id}
                                        onClick={(e) => { e.stopPropagation(); handleRegistrar(comida.id, 'saltada') }}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all"
                                        style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                    >
                                        No hecha
                                    </button>
                                </div>
                            )}

                            {(yaHecho || tieneCambio || saltada) && !anotandoCambio && (
                                <div className="px-5 pb-3 pt-0 flex items-center justify-between gap-2 no-print">
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {yaHecho ? 'Registrada como hecha.' : saltada ? 'Marcada como no hecha.' : `Cambio: ${tieneCambio}`}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setAnotandoCambio(comida.id); setTextoCambio(registro?.notas ?? '') }}
                                        className="text-xs font-semibold rounded-lg px-3 py-1.5"
                                        style={{ color: 'var(--primary)', background: 'var(--primary-bg)' }}
                                    >
                                        Cambiar estado
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
                                            disabled={registrando === comida.id}
                                            onClick={() => handleRegistrar(comida.id, 'hecha')}
                                            className="px-3 text-xs font-medium rounded-lg transition-all"
                                            style={{ background: '#DCFCE7', color: '#16A34A' }}
                                        >
                                            Hecha
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
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div className="pt-2 border-t text-right text-sm font-medium text-[var(--text-secondary)]" style={{ borderColor: '#F1F5F9' }}>
                                        Total: {macros.calorias.toFixed(0)} kcal
                                    </div>
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

        </div>
    )
}
