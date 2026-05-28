'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UtensilsCrossed, ClipboardCheck, BarChart3, Loader2, MessageSquareText, Dumbbell, MessageCircle, Smartphone, Calendar, AlertCircle, ShoppingCart, BookOpen, Clock, CheckCircle2, Moon, Sun, Home } from 'lucide-react'
import MiPlan from './MiPlan'
import CheckInForm from './CheckInForm'
import ProgresoCharts from './ProgresoCharts'
import NotasCoach from './NotasCoach'
import TLSGauge from './TLSGauge'
import RegistrarEntrenoModal from './RegistrarEntrenoModal'
import ChatPanel from './ChatPanel'
import IntegracionesPanel from './IntegracionesPanel'
import ListaCompraPortal from './ListaCompraPortal'
import GarminMiniCard from './GarminMiniCard'
import type { PlanNutricion, Cliente, PlanEntrenamiento, CheckIn, SeguimientoPeso, NotaCoach, RegistroComidaDia } from '@/types'
import { useTheme } from '@/components/ThemeProvider'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'

interface DashboardData {
    plan: PlanNutricion
    cliente: Pick<Cliente, 'id' | 'peso_inicial' | 'objetivo' | 'onboarding_completado'> & { nombre?: string; fecha_proxima_revision?: string }
    entreno: PlanEntrenamiento | null
    checkins: CheckIn[]
    peso: SeguimientoPeso[]
    notas: NotaCoach[]
    registros_comidas?: RegistroComidaDia[]
}

interface DashboardClienteProps {
    codigo: string
}

type Tab = 'plan' | 'dieta' | 'entreno' | 'compra' | 'recetas' | 'checkin' | 'progreso' | 'chat' | 'integraciones'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'plan', label: 'Hoy', icon: Home },
    { key: 'dieta', label: 'Dieta', icon: UtensilsCrossed },
    { key: 'entreno', label: 'Training', icon: Dumbbell },
    { key: 'compra', label: 'Compra', icon: ShoppingCart },
    { key: 'recetas', label: 'Recetas', icon: BookOpen },
    { key: 'checkin', label: 'Check-in', icon: ClipboardCheck },
    { key: 'progreso', label: 'Progreso', icon: BarChart3 },
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'integraciones', label: 'Apps', icon: Smartphone },
]

function normalizarDia(dia: string | null | undefined): number | null {
    if (!dia) return null
    const keys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
    const d = dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const idx = keys.findIndex(k => d.includes(k))
    return idx >= 0 ? idx : null
}

function fechaHoyLocal() {
    return new Date().toLocaleDateString('en-CA')
}

type ComidaCliente = NonNullable<PlanNutricion['comidas']>[number] & {
    dia_semana?: string | null
    receta_id?: string | null
    receta?: {
        id: string
        nombre: string
        imagen_url?: string | null
        kcal?: number | null
        tiempo_prep_min?: number | null
    } | null
    alimentos?: Array<{
        id: string
        cantidad_gramos: number
        alimento?: {
            nombre?: string | null
            calorias?: number | null
            proteinas?: number | null
            carbohidratos?: number | null
            grasas?: number | null
            fibra?: number | null
        } | null
    }>
}

type SesionCliente = {
    id: string
    nombre: string
    dia_semana?: string | null
    duracion_min?: number | null
    duracion_estimada_min?: number | null
    ejercicios?: unknown[]
    notas?: string | null
}

type RecetaPlanCliente = {
    id: string
    nombre: string
    imagen_url?: string | null
    kcal?: number | null
    proteinas?: number | null
    tiempo_prep_min?: number | null
    comida?: string
    tipo: 'asignada' | 'alternativa'
}

function calcMacrosComida(comida: ComidaCliente) {
    return sumarMacros((comida.alimentos ?? []).map(a =>
        calcularMacrosPorCantidad(
            Number(a.alimento?.calorias ?? 0),
            Number(a.alimento?.proteinas ?? 0),
            Number(a.alimento?.carbohidratos ?? 0),
            Number(a.alimento?.grasas ?? 0),
            Number(a.alimento?.fibra ?? 0),
            Number(a.cantidad_gramos ?? 0)
        )
    ))
}

function RecipeGridCliente({ items, codigo }: { items: RecetaPlanCliente[]; codigo: string }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map(receta => (
                <Link
                    key={receta.id}
                    href={`/recetas/${receta.id}?returnTo=/cliente/${codigo}`}
                    className="group rounded-2xl border overflow-hidden"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                >
                    <div className="aspect-[16/9]" style={{ background: 'var(--surface)' }}>
                        {receta.imagen_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={receta.imagen_url} alt={receta.nombre} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                                <BookOpen size={22} />
                            </div>
                        )}
                    </div>
                    <div className="p-3">
                        <div className="mb-1 flex items-center gap-2">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: receta.tipo === 'asignada' ? 'var(--primary-bg)' : 'var(--surface)', color: receta.tipo === 'asignada' ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {receta.tipo === 'asignada' ? 'Plan' : 'Alternativa'}
                            </span>
                            {receta.comida && <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{receta.comida}</span>}
                        </div>
                        <p className="text-sm font-semibold line-clamp-2 group-hover:underline" style={{ color: 'var(--text)' }}>{receta.nombre}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {Math.round(Number(receta.kcal ?? 0))} kcal{receta.proteinas ? ` · P ${Math.round(Number(receta.proteinas))}g` : ''}{receta.tiempo_prep_min ? ` · ${receta.tiempo_prep_min} min` : ''}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    )
}

function EntrenoCliente({
    entreno,
    codigo,
    tlsKey,
    onRegistrar,
    onSesion,
}: {
    entreno: PlanEntrenamiento | null
    codigo: string
    tlsKey: number
    onRegistrar: () => void
    onSesion: (nombre: string) => void
}) {
    const hoy = new Date().getDay()
    const hoyIdx = hoy === 0 ? 6 : hoy - 1
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    const [diaActivo, setDiaActivo] = useState(hoyIdx)
    const [sesionesHechas, setSesionesHechas] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set()
        try {
            return new Set(JSON.parse(localStorage.getItem(`nutricoach:training:${codigo}`) ?? '[]') as string[])
        } catch {
            return new Set()
        }
    })
    const sesiones = (entreno?.sesiones ?? []) as Array<{
        id: string
        nombre: string
        dia_semana?: string | null
        duracion_min?: number | null
        duracion_estimada_min?: number | null
        notas?: string | null
        ejercicios?: Array<{
            id: string
            orden: number
            series?: number | null
            repeticiones?: string | null
            descanso_seg?: number | null
            descanso_segundos?: number | null
            peso_sugerido?: string | null
            notas?: string | null
            ejercicio?: { nombre?: string | null; grupo_muscular?: string | null }
        }>
    }>
    const sesionesDia = sesiones.filter(s => normalizarDia(s.dia_semana) === diaActivo)
    const sesionesHoy = sesiones.filter(s => normalizarDia(s.dia_semana) === hoyIdx)
    const visibles = sesionesDia.length ? sesionesDia : sesionesHoy.length ? sesionesHoy : sesiones
    const totalEjercicios = visibles.reduce((acc, s) => acc + (s.ejercicios?.length ?? 0), 0)
    const duracionDia = visibles.reduce((acc, s) => acc + Number(s.duracion_min ?? s.duracion_estimada_min ?? 0), 0)

    function marcarSesion(sesionId: string, nombre: string) {
        setSesionesHechas(prev => {
            const next = new Set(prev)
            next.add(sesionId)
            localStorage.setItem(`nutricoach:training:${codigo}`, JSON.stringify(Array.from(next)))
            return next
        })
        onSesion(nombre)
    }

    return (
        <div className="space-y-4">
            <TLSGauge key={tlsKey} codigo={codigo} onRegistrar={onRegistrar} />
            <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Plan de entrenamiento</p>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{entreno?.nombre ?? 'Sin plan activo'}</h2>
                    </div>
                    <button onClick={onRegistrar} className="btn-primary text-xs px-3 py-2">Registrar</button>
                </div>

                {!entreno || sesiones.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tu coach todavía no ha asignado sesiones de entrenamiento.</p>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-7 gap-1.5">
                            {dias.map((dia, idx) => {
                                const count = sesiones.filter(s => normalizarDia(s.dia_semana) === idx).length
                                const active = idx === diaActivo
                                const today = idx === hoyIdx
                                return (
                                    <button
                                        key={dia}
                                        type="button"
                                        onClick={() => setDiaActivo(idx)}
                                        className="rounded-2xl border py-2 text-center transition-colors"
                                        style={{
                                            borderColor: active ? 'var(--primary)' : 'var(--border)',
                                            background: active ? 'var(--primary-bg)' : 'var(--bg)',
                                            color: active ? 'var(--primary)' : 'var(--text-muted)',
                                        }}
                                    >
                                        <span className="block text-xs font-bold">{dia.slice(0, 1)}</span>
                                        <span className="block text-[9px] tabular-nums mt-0.5">{today ? 'Hoy' : count}</span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Sesiones</p>
                                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{visibles.length}</p>
                            </div>
                            <div className="rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ejercicios</p>
                                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{totalEjercicios}</p>
                            </div>
                            <div className="rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tiempo</p>
                                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{duracionDia || '—'}{duracionDia ? 'm' : ''}</p>
                            </div>
                        </div>

                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {sesionesDia.length ? `Entrenamiento de ${dias[diaActivo]}` : sesionesHoy.length ? 'No hay sesión para ese día. Mostrando hoy.' : 'Semana de entrenamiento'}
                        </p>
                        {visibles.map(sesion => (
                            <div key={sesion.id} className="rounded-2xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
                                            {sesionesHechas.has(sesion.id) && <CheckCircle2 size={14} style={{ color: '#16A34A' }} />}
                                        </div>
                                        <p className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                            <Clock size={12} /> {sesion.dia_semana ?? 'Sin día'}{(sesion.duracion_min ?? sesion.duracion_estimada_min) ? ` · ${sesion.duracion_min ?? sesion.duracion_estimada_min} min` : ''}
                                        </p>
                                        {sesion.notas && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{sesion.notas}</p>}
                                    </div>
                                    <button
                                        onClick={() => marcarSesion(sesion.id, sesion.nombre)}
                                        className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
                                        style={{ background: sesionesHechas.has(sesion.id) ? '#DCFCE7' : 'var(--primary-bg)', color: sesionesHechas.has(sesion.id) ? '#16A34A' : 'var(--primary)' }}
                                    >
                                        {sesionesHechas.has(sesion.id) ? 'Hecha' : 'Hecho'}
                                    </button>
                                </div>
                                {(sesion.ejercicios ?? []).length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {(sesion.ejercicios ?? []).slice().sort((a, b) => a.orden - b.orden).map(ej => (
                                            <div key={ej.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--surface)' }}>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre ?? 'Ejercicio'}</p>
                                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                        {ej.ejercicio?.grupo_muscular ?? 'Trabajo principal'}
                                                        {(ej.descanso_seg ?? ej.descanso_segundos) ? ` · descanso ${ej.descanso_seg ?? ej.descanso_segundos}s` : ''}
                                                    </p>
                                                    {ej.notas && <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{ej.notas}</p>}
                                                </div>
                                                <p className="text-xs font-semibold text-right shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                                    {ej.series ? `${ej.series}x` : ''}{ej.repeticiones ?? 'programado'}{ej.peso_sugerido ? ` · ${ej.peso_sugerido}` : ''}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

function HoyCliente({
    data,
    codigo,
    notasNoLeidas,
    diasDesdeUltimoCheckin,
    proximaRevision,
    onAbrirDieta,
    onAbrirEntreno,
    onAbrirCheckin,
    onAbrirChat,
}: {
    data: DashboardData
    codigo: string
    notasNoLeidas: number
    diasDesdeUltimoCheckin: number | null
    proximaRevision: string | null
    onAbrirDieta: () => void
    onAbrirEntreno: () => void
    onAbrirCheckin: () => void
    onAbrirChat: () => void
}) {
    const hoyIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
    const fechaHoy = fechaHoyLocal()
    const comidas = (data.plan.comidas ?? []) as ComidaCliente[]
    const comidasHoy = comidas
        .filter(comida => (normalizarDia(comida.dia_semana) ?? 0) === hoyIdx)
        .slice()
        .sort((a, b) => a.orden - b.orden)
    const registrosHoy = new Map((data.registros_comidas ?? [])
        .filter(r => r.fecha === fechaHoy)
        .map(r => [r.comida_id, r]))
    const completadas = comidasHoy.filter(c => {
        const estado = registrosHoy.get(c.id)?.estado
        return estado === 'hecha' || estado === 'cambiada'
    }).length
    const totalKcal = comidasHoy.reduce((acc, comida) => acc + calcMacrosComida(comida).calorias, 0)
    const siguienteComida = comidasHoy.find(c => !registrosHoy.has(c.id)) ?? comidasHoy[0] ?? null
    const siguienteMacros = siguienteComida ? calcMacrosComida(siguienteComida) : null

    const sesiones = (data.entreno?.sesiones ?? []) as SesionCliente[]
    const sesionesHoy = sesiones.filter(s => normalizarDia(s.dia_semana) === hoyIdx)
    const sesionHoy = sesionesHoy[0] ?? null
    const duracionSesion = sesionHoy ? Number(sesionHoy.duracion_min ?? sesionHoy.duracion_estimada_min ?? 0) : 0

    const pendienteCheckin = diasDesdeUltimoCheckin === null || diasDesdeUltimoCheckin >= 7
    const pendientes = [
        data.cliente.onboarding_completado === false ? { label: 'Completar perfil', action: onAbrirCheckin } : null,
        pendienteCheckin ? { label: 'Check-in semanal', action: onAbrirCheckin } : null,
        notasNoLeidas > 0 ? { label: `${notasNoLeidas} nota${notasNoLeidas > 1 ? 's' : ''} del coach`, action: onAbrirChat } : null,
    ].filter(Boolean) as Array<{ label: string; action: () => void }>

    const consejo = sesionHoy
        ? 'Hoy prioriza cumplir comida y entreno sin buscar perfección extra. Si cambias una comida, márcalo para que el coach tenga contexto.'
        : completadas === 0
            ? 'Empieza por la primera comida marcada. Mantener el plan visible y simple suele ganar a improvisar tarde.'
            : 'Vas sumando adherencia. Revisa la siguiente comida antes de que llegue la hora y deja preparada la opción más fácil.'

    return (
        <div className="space-y-4">
            <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Hoy</p>
                        <h2 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                            {completadas}/{comidasHoy.length || 0} comidas
                        </h2>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                            {Math.round(totalKcal)} kcal planificadas{sesionHoy ? ' · entreno programado' : ' · sin sesión marcada'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onAbrirDieta}
                        className="shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98]"
                        style={{ background: 'var(--primary)', color: 'white' }}
                    >
                        Abrir dieta
                    </button>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg)' }}>
                    <div
                        className="h-full rounded-full transition-all"
                        style={{
                            width: `${comidasHoy.length ? Math.round((completadas / comidasHoy.length) * 100) : 0}%`,
                            background: completadas === comidasHoy.length && comidasHoy.length > 0 ? '#16A34A' : 'var(--primary)',
                        }}
                    />
                </div>
            </section>

            <section className="rounded-3xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Dieta de hoy</p>
                            <h3 className="mt-1 text-base font-bold" style={{ color: 'var(--text)' }}>
                                {siguienteComida ? 'Siguiente comida' : 'Sin comidas para hoy'}
                            </h3>
                        </div>
                        <button type="button" onClick={onAbrirDieta} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                            Ver semana
                        </button>
                    </div>
                </div>

                {siguienteComida ? (
                    <button
                        type="button"
                        onClick={onAbrirDieta}
                        className="w-full p-4 text-left transition-colors active:scale-[0.99]"
                        style={{ background: 'transparent' }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl" style={{ background: 'var(--bg)' }}>
                                {siguienteComida.receta?.imagen_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={siguienteComida.receta.imagen_url} alt={siguienteComida.receta.nombre} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center" style={{ color: 'var(--primary)' }}>
                                        <UtensilsCrossed size={18} />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                    {siguienteComida.nombre}{siguienteComida.hora_sugerida ? ` · ${siguienteComida.hora_sugerida.slice(0, 5)}` : ''}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-base font-semibold" style={{ color: 'var(--text)' }}>
                                    {siguienteComida.receta?.nombre ?? siguienteComida.nombre}
                                </p>
                                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {Math.round(siguienteMacros?.calorias ?? 0)} kcal · tocar para ver ingredientes
                                </p>
                            </div>
                        </div>
                    </button>
                ) : (
                    <p className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>Tu coach todavía no ha construido comidas para este día.</p>
                )}
            </section>

            <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Entrenamiento</p>
                        <h3 className="mt-1 line-clamp-1 text-base font-bold" style={{ color: 'var(--text)' }}>
                            {sesionHoy?.nombre ?? 'Sin sesión para hoy'}
                        </h3>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {sesionHoy ? `${duracionSesion || '—'} min · ${sesionHoy.ejercicios?.length ?? 0} ejercicios` : 'Revisa la semana de training cuando toque entrenar.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onAbrirEntreno}
                        className="shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold"
                        style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
                    >
                        Ver training
                    </button>
                </div>
            </section>

            <GarminMiniCard codigo={codigo} />

            <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pendientes</p>
                        <h3 className="mt-1 text-base font-bold" style={{ color: 'var(--text)' }}>
                            {pendientes.length ? `${pendientes.length} acción${pendientes.length > 1 ? 'es' : ''}` : 'Todo al día'}
                        </h3>
                        {proximaRevision && <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Próxima revisión: {proximaRevision}</p>}
                    </div>
                    {!pendientes.length && <CheckCircle2 size={20} style={{ color: '#16A34A' }} />}
                </div>
                {pendientes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {pendientes.map(p => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={p.action}
                                className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Nota del día</p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{consejo}</p>
            </section>
        </div>
    )
}

function RecetarioCliente({ plan, codigo }: { plan: PlanNutricion; codigo: string }) {
    const comidas = (plan.comidas ?? []) as Array<{
        nombre: string
        receta_id?: string | null
        receta?: { id: string; nombre: string; imagen_url?: string | null; kcal?: number | null; proteinas?: number | null; tiempo_prep_min?: number | null } | null
        alternativa_recetas?: Array<{ id: string; nombre: string; imagen_url?: string | null; kcal?: number | null; proteinas?: number | null; tiempo_prep_min?: number | null }>
    }>
    const recetasMap = new Map<string, RecetaPlanCliente>()

    comidas.forEach(comida => {
        if (comida.receta_id && comida.receta) {
            recetasMap.set(comida.receta_id, { ...comida.receta, comida: comida.nombre, tipo: 'asignada' })
        }
    })

    comidas.forEach(comida => {
        ; (comida.alternativa_recetas ?? []).forEach(receta => {
            if (!recetasMap.has(receta.id)) {
                recetasMap.set(receta.id, { ...receta, comida: comida.nombre, tipo: 'alternativa' })
            }
        })
    })

    const recetas = Array.from(recetasMap.values())
    const asignadas = recetas.filter(r => r.tipo === 'asignada')
    const alternativas = recetas.filter(r => r.tipo === 'alternativa')

    return (
        <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Recetario desbloqueado</p>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{recetas.length} recetas disponibles</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Recetas principales y opciones alternativas que tu coach ha dejado disponibles en tu plan.
                </p>
            </div>
            {recetas.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Todavía no hay recetas vinculadas a tu plan.</p>
            ) : (
                <div className="space-y-5">
                    {asignadas.length > 0 && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Asignadas por el coach</h3>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{asignadas.length}</span>
                            </div>
                            <RecipeGridCliente items={asignadas} codigo={codigo} />
                        </div>
                    )}
                    {alternativas.length > 0 && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Opciones alternativas</h3>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{alternativas.length}</span>
                            </div>
                            <RecipeGridCliente items={alternativas} codigo={codigo} />
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}

export default function DashboardCliente({ codigo }: DashboardClienteProps) {
    const searchParams = useSearchParams()
    const { theme, toggleTheme } = useTheme()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [tab, setTab] = useState<Tab>(() => {
        const connected = searchParams.get('connected')
        if (connected === 'strava' || connected === 'garmin' || connected === 'google_fit') return 'integraciones'
        const tabParam = searchParams.get('tab')
        if (tabParam && TABS.some(t => t.key === tabParam)) return tabParam as Tab
        return 'plan'
    })
    const [notasNoLeidas, setNotasNoLeidas] = useState(0)
    const [notasVistas, setNotasVistas] = useState<string[]>([])
    const [mostrarRegistrarEntreno, setMostrarRegistrarEntreno] = useState(false)
    const [sesionPendiente, setSesionPendiente] = useState<string | null>(null)
    const [tlsKey, setTlsKey] = useState(0)
    const [mostrarBienvenida, setMostrarBienvenida] = useState(false)

    const loadData = useCallback(async () => {
        try {
            fetch(`/api/cliente/${codigo}/registrar-acceso`, { method: 'POST' }).catch(() => { })

            const res = await fetch(`/api/cliente/${codigo}/dashboard`)
            if (!res.ok) {
                const err = await res.json()
                setError(err.error || 'Error al cargar')
                setLoading(false)
                return
            }
            const json = await res.json()
            setData(json)

            // Detectar notas nuevas (no vistas)
            if (json.notas?.length > 0) {
                const nuevas = json.notas.filter((n: NotaCoach) => !notasVistas.includes(n.id))
                setNotasNoLeidas(nuevas.length)
            }

            setLoading(false)
        } catch {
            setError('Error de conexión')
            setLoading(false)
        }
    }, [codigo, notasVistas])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Mostrar banner de bienvenida solo en el primer acceso (detectado por localStorage)
    useEffect(() => {
        const key = `nutricoach:welcome:${codigo}`
        if (!localStorage.getItem(key)) {
            setMostrarBienvenida(true)
        }
    }, [codigo])

    // Marcar notas como leídas al visitar chat.
    useEffect(() => {
        if (tab === 'chat' && data?.notas) {
            const ids = data.notas.map(n => n.id)
            setNotasVistas(prev => {
                const nuevas = ids.filter(id => !prev.includes(id))
                if (nuevas.length > 0) {
                    setNotasNoLeidas(0)
                    return [...prev, ...nuevas]
                }
                return prev
            })
        }
    }, [tab, data?.notas])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <div className="max-w-md w-full mx-4 text-center">
                    <div className="card p-12">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--error-bg)' }}>
                            <AlertCircle size={32} style={{ color: 'var(--error)' }} />
                        </div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Plan no disponible</h1>
                        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                            {error || 'Este plan no existe o ha sido desactivado por tu coach'}
                        </p>
                        <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                            Si crees que es un error, contacta con tu coach.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Último check-in para vista previa
    const ultimoCheckin = data.checkins?.[0]
    const diasDesdeUltimoCheckin = ultimoCheckin
        ? Math.floor((new Date().getTime() - new Date(ultimoCheckin.fecha).getTime()) / (1000 * 60 * 60 * 24))
        : null

    const nombreCliente = data.cliente?.nombre?.split(' ')[0] ?? 'Cliente'
    const proximaRevision = data.cliente?.fecha_proxima_revision
        ? new Date(data.cliente.fecha_proxima_revision).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : null

    return (
        <div className="min-h-screen pb-nav-safe" style={{ background: 'var(--bg)' }}>
            <div
                className="sticky top-0 z-30 border-b backdrop-blur-xl"
                style={{
                    borderColor: 'var(--border)',
                    background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
                    WebkitBackdropFilter: 'blur(18px)',
                }}
            >
                <div className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="max-w-3xl mx-auto px-4 pt-safe pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Casanova Nutrition</p>
                                <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--text)' }}>{nombreCliente}</h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={toggleTheme}
                                    className="inline-flex h-8 items-center rounded-full border p-1 transition-colors"
                                    style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-muted)' }}
                                    aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                                >
                                    <span
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                                        style={{ background: theme === 'light' ? 'var(--surface)' : 'transparent', color: theme === 'light' ? 'var(--text)' : 'var(--text-muted)' }}
                                    >
                                        <Sun size={13} />
                                    </span>
                                    <span
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                                        style={{ background: theme === 'dark' ? 'var(--surface)' : 'transparent', color: theme === 'dark' ? 'var(--text)' : 'var(--text-muted)' }}
                                    >
                                        <Moon size={13} />
                                    </span>
                                </button>
                                {proximaRevision && (
                                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                                        <Calendar size={12} /> {proximaRevision}
                                    </span>
                                )}
                                {notasNoLeidas > 0 && (
                                    <button
                                        onClick={() => setTab('chat')}
                                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                                        style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444' }}
                                    >
                                        <MessageSquareText size={12} />
                                        {notasNoLeidas}
                                    </button>
                                )}
                                {ultimoCheckin && diasDesdeUltimoCheckin !== null && (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                                        <ClipboardCheck size={12} />
                                        {diasDesdeUltimoCheckin === 0 ? 'Hoy' : `${diasDesdeUltimoCheckin}d`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs — estilo pill */}
                <div className="px-2 py-2" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div style={{ display: 'flex', gap: '6px', width: 'max-content', minWidth: '100%', paddingLeft: '4px', paddingRight: '4px' }}>
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className="flex items-center gap-1.5 rounded-xl font-medium whitespace-nowrap transition-all"
                                style={{
                                    padding: '7px 12px',
                                    fontSize: '12px',
                                    background: tab === key ? 'var(--primary)' : 'var(--bg)',
                                    color: tab === key ? 'white' : 'var(--text-secondary)',
                                }}
                            >
                                <Icon size={14} />
                                {label}
                                {key === 'chat' && notasNoLeidas > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Banner onboarding pendiente */}
            {data.cliente?.onboarding_completado === false && (
                <div className="max-w-2xl mx-auto px-4 pt-4">
                    <a href="/onboarding" className="block rounded-xl p-4 border-l-4 text-sm font-medium"
                        style={{ background: 'var(--warning-bg, #fef3c7)', borderColor: '#f59e0b', color: '#92400e' }}>
                        <span className="font-semibold">Completa tu perfil en 5 minutos</span>
                        <span className="block text-xs mt-0.5 font-normal" style={{ color: '#a16207' }}>
                            Tu coach necesita tus datos para personalizar tu plan. Toca aquí para continuar el onboarding.
                        </span>
                    </a>
                </div>
            )}

            {/* Contenido */}
            <div className="max-w-3xl mx-auto p-4 space-y-4">

                {/* Banner de bienvenida — primera visita */}
                {mostrarBienvenida && (
                    <div
                        className="rounded-2xl p-4 flex items-start gap-3"
                        style={{
                            background: 'rgba(99,102,241,0.1)',
                            border: '1px solid rgba(99,102,241,0.25)',
                        }}
                    >
                        <span className="text-2xl flex-shrink-0">👋</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                                ¡Bienvenido{nombreCliente !== 'Cliente' ? `, ${nombreCliente}` : ''}!
                            </p>
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                Tu coach ha preparado tu plan personalizado. Explora las pestañas para ver tu dieta, entrenos y hacer tu primer check-in.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                localStorage.setItem(`nutricoach:welcome:${codigo}`, '1')
                                setMostrarBienvenida(false)
                            }}
                            className="text-xs px-2.5 py-1 rounded-full flex-shrink-0 font-medium"
                            style={{ background: 'rgba(99,102,241,0.2)', color: 'rgb(99,102,241)' }}
                        >
                            Entendido
                        </button>
                    </div>
                )}

                {tab === 'plan' && (
                    <HoyCliente
                        data={data}
                        codigo={codigo}
                        notasNoLeidas={notasNoLeidas}
                        diasDesdeUltimoCheckin={diasDesdeUltimoCheckin}
                        proximaRevision={proximaRevision}
                        onAbrirDieta={() => setTab('dieta')}
                        onAbrirEntreno={() => setTab('entreno')}
                        onAbrirCheckin={() => setTab('checkin')}
                        onAbrirChat={() => setTab('chat')}
                    />
                )}

                {tab === 'dieta' && (
                    <MiPlan
                        codigo={codigo}
                        plan={data.plan}
                        registros_comidas={data.registros_comidas}
                    />
                )}

                {tab === 'checkin' && (
                    <CheckInForm
                        codigo={codigo}
                        onCheckinCreado={loadData}
                        ultimoCheckin={ultimoCheckin}
                    />
                )}

                {tab === 'entreno' && (
                    <EntrenoCliente
                        entreno={data.entreno}
                        codigo={codigo}
                        tlsKey={tlsKey}
                        onRegistrar={() => setMostrarRegistrarEntreno(true)}
                        onSesion={(nombre) => {
                            setSesionPendiente(nombre)
                            setMostrarRegistrarEntreno(true)
                        }}
                    />
                )}

                {tab === 'compra' && (
                    <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                        <div className="mb-4">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Lista de la compra</p>
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Semana actual</h2>
                        </div>
                        <ListaCompraPortal codigo={codigo} />
                    </section>
                )}

                {tab === 'recetas' && (
                    <RecetarioCliente plan={data.plan} codigo={codigo} />
                )}

                {tab === 'progreso' && (
                    <div className="space-y-4">
                        <ProgresoCharts
                            checkins={data.checkins}
                            peso={data.peso}
                            pesoInicial={data.cliente?.peso_inicial}
                            objetivo={data.cliente?.objetivo}
                        />
                    </div>
                )}

                {tab === 'chat' && (
                    <div className="card !p-0 overflow-hidden">
                        <ChatPanel codigo={codigo} pollingInterval={10000} />
                    </div>
                )}

                {tab === 'integraciones' && data.cliente && (
                    <IntegracionesPanel codigo={codigo} clienteId={data.cliente.id} />
                )}
            </div>

            {mostrarRegistrarEntreno && (
                <RegistrarEntrenoModal
                    codigo={codigo}
                    sesionNombre={sesionPendiente ?? undefined}
                    tipoPreset="gym"
                    onClose={() => { setMostrarRegistrarEntreno(false); setSesionPendiente(null) }}
                    onGuardado={() => {
                        setTlsKey(k => k + 1)
                        setSesionPendiente(null)
                        setTab('entreno')
                    }}
                />
            )}

            {/* Footer con notas del coach */}
            <div className="max-w-2xl mx-auto px-4 pb-8">
                <NotasCoach codigo={codigo} />
                <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
                    Plan creado por Casanova Nutrition ·{' '}
                    {new Date(data.plan.created_at).toLocaleDateString('es-ES')}
                </p>
            </div>
        </div>
    )
}
