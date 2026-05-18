'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio, ProgresionPlantilla } from '@/types'
import type { SportModality } from '@/types'
import {
    Dumbbell,
    Target,
    ChevronDown,
    ChevronUp,
    Search,
    Download,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Crown,
} from 'lucide-react'
import { useDebounce } from '@/lib/useDebounce'
import { useToast } from '@/components/ui/Toast'
import { MODALITY_CONFIG, detectarSubcategoriaLegacy } from '@/lib/entrenos/utils'

const OBJETIVO_COLOR: Record<string, string> = {
    hipertrofia: 'badge-purple',
    fuerza: 'badge-blue',
    perdida_grasa: 'badge-orange',
    cardio: 'badge-red',
    tonificacion: 'badge-green',
    rendimiento: 'badge-teal',
}

function nivelStyle(nivel: string | null | undefined): React.CSSProperties {
    switch (nivel) {
        case 'principiante': return { color: 'rgb(52,199,89)', background: 'rgba(52,199,89,0.12)' }
        case 'avanzado':     return { color: 'rgb(255,69,58)', background: 'rgba(255,69,58,0.12)' }
        default:             return { color: 'var(--text-muted)', background: 'rgba(128,128,128,0.12)' }
    }
}

export default function PlantillasEntrenoPage() {
    const [plantillas, setPlantillas] = useState<PlantillaEntrenamiento[]>([])
    const [loading, setLoading] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const [filtroModalidad, setFiltroModalidad] = useState<SportModality | null>(null)
    const [expandida, setExpandida] = useState<string | null>(null)
    const [seedStatus, setSeedStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [seedMessage, setSeedMessage] = useState('')
    const busquedaDebounced = useDebounce(busqueda, 300)
    const { addToast } = useToast()

    const load = useCallback(async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data } = await supabase
            .from('plantillas_entrenamiento')
            .select('*, sesiones:plantilla_sesiones(*, ejercicios:plantilla_sesion_ejercicios(*, ejercicio:ejercicios(*)))')
            .eq('coach_id', user.id)
            .eq('activo', true)
            .order('sport_modality', { ascending: true })
            .order('tier', { ascending: false })
            .order('dias_por_semana', { ascending: true })

        setPlantillas(data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const filtradas = plantillas.filter(p => {
        if (filtroModalidad !== null && p.sport_modality !== filtroModalidad) return false
        if (busquedaDebounced) {
            const q = busquedaDebounced.toLowerCase()
            const matchesNombre = p.nombre.toLowerCase().includes(q)
            const matchesDesc = (p.descripcion ?? '').toLowerCase().includes(q)
            const matchesObj = (p.objetivo ?? '').toLowerCase().includes(q)
            const matchesNivel = (p.nivel ?? '').toLowerCase().includes(q)
            const matchesSub = detectarSubcategoriaLegacy(p.nombre ?? '').toLowerCase().includes(q)
            const matchesModality = (p.sport_modality ?? '').toLowerCase().includes(q)
            const matchesTier = (p.tier ?? '').toLowerCase().includes(q)
            return matchesNombre || matchesDesc || matchesObj || matchesNivel || matchesSub || matchesModality || matchesTier
        }
        return true
    })

    const agrupadasPorModalidad = (Object.keys(MODALITY_CONFIG) as SportModality[]).reduce<Record<string, PlantillaEntrenamiento[]>>((acc, m) => {
        acc[m] = filtradas.filter(p => p.sport_modality === m)
        return acc
    }, {})
    const legacy = filtradas.filter(p => !p.sport_modality)

    async function poblarPlantillas() {
        setSeedStatus('loading')
        setSeedMessage('')
        try {
            const res = await fetch('/api/plantillas-entreno/seed')
            const data = await res.json()
            if (data.error) {
                setSeedStatus('error')
                setSeedMessage(data.error)
                addToast({ type: 'error', title: data.error })
            } else {
                setSeedStatus('success')
                setSeedMessage(data.message || 'Plantillas insertadas correctamente')
                addToast({ type: 'success', title: data.message || 'Plantillas insertadas correctamente' })
                load()
            }
        } catch {
            setSeedStatus('error')
            setSeedMessage('Error de conexión al insertar plantillas')
            addToast({ type: 'error', title: 'Error de conexión al insertar plantillas' })
        }
    }

    function renderPlantillaCard(p: PlantillaEntrenamiento) {
        const estaExpandida = expandida === p.id
        const sesiones = (p.sesiones ?? []) as PlantillaSesion[]
        const modality = p.sport_modality as SportModality | undefined
        const tier = p.tier
        const cfg = modality ? MODALITY_CONFIG[modality] : null
        const subcategoria = !modality ? detectarSubcategoriaLegacy(p.nombre ?? '') : ''

        return (
            <div
                key={p.id}
                className="border rounded-xl transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
                <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandida(estaExpandida ? null : p.id)}
                >
                    <div className="flex items-start gap-3">
                        {/* Icono modalidad */}
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={cfg
                                ? { background: cfg.bgRgba, color: cfg.colorRgb }
                                : p.tipo === 'cardio'
                                    ? { background: 'rgba(239,68,68,0.15)', color: 'rgb(239,68,68)' }
                                    : p.tipo === 'mixto'
                                        ? { background: 'rgba(249,115,22,0.15)', color: 'rgb(249,115,22)' }
                                        : { background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }
                            }
                        >
                            {cfg ? <cfg.Icon size={18} /> : <Dumbbell size={18} />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-[15px]" style={{ color: 'var(--text)' }}>{p.nombre}</p>
                                {tier === 'elite' && (
                                    <span
                                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                                        style={{ background: 'rgba(201,169,110,0.15)', borderColor: 'rgba(201,169,110,0.4)', color: '#C9A96E' }}
                                    >
                                        <Crown size={9} /> Elite
                                    </span>
                                )}
                                {cfg && (
                                    <span
                                        className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                                        style={{ background: cfg.bgRgba, color: cfg.colorRgb, borderColor: cfg.bgRgba.replace('0.15', '0.35') }}
                                    >
                                        <cfg.Icon size={11} />
                                        {cfg.label}
                                    </span>
                                )}
                                {subcategoria && (
                                    <span
                                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                        style={{ color: 'var(--text-muted)', background: 'rgba(128,128,128,0.12)' }}
                                    >
                                        {subcategoria}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span
                                    className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                                    style={nivelStyle(p.nivel)}
                                >
                                    {p.nivel}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.dias_por_semana} días/sem</span>
                                {(p.duracion_semanas ?? 0) > 0 && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.duracion_semanas} semanas</span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-1.5 flex-wrap justify-end items-start">
                            {p.objetivo && (
                                <span className={`badge text-[11px] ${OBJETIVO_COLOR[p.objetivo] ?? 'badge-gray'}`}>
                                    {p.objetivo.replace(/_/g, ' ')}
                                </span>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); setExpandida(estaExpandida ? null : p.id) }}
                                className="ml-1"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {estaExpandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>
                    {p.descripcion && (
                        <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{p.descripcion.split('🎯')[0].trim()}</p>
                    )}
                </div>

                {/* Sesiones expandidas */}
                {estaExpandida && (
                    <div className="px-4 pb-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                        {p.progresion && Array.isArray(p.progresion) && p.progresion.length > 0 && (
                            <div className="mb-3">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                                    📈 Progresión semanal
                                </p>
                                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                                    {p.progresion.map((sem: ProgresionPlantilla) => (
                                        <div
                                            key={sem.semana}
                                            className="rounded-lg p-2.5"
                                            style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid var(--border)' }}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Semana {sem.semana} · {sem.titulo}</p>
                                                <span
                                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                                    style={{ color: 'var(--text-muted)', background: 'rgba(128,128,128,0.15)' }}
                                                >
                                                    {sem.descripcion?.match(/RPE [\d-]+\/10/)?.[0] || ''}
                                                </span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{sem.descripcion}</p>
                                            {sem.ajustes && sem.ajustes.length > 0 && (
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    {sem.ajustes.map((a: string, i: number) => (
                                                        <p
                                                            key={i}
                                                            className="text-[10px] pl-2"
                                                            style={{ color: 'var(--text-muted)', borderLeft: '2px solid var(--border)' }}
                                                        >{a}</p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {sesiones.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                    🏋️ Sesiones
                                </p>
                                {sesiones.sort((a, b) => a.orden - b.orden).map(sesion => {
                                    const ejercicios = (sesion.ejercicios ?? []) as PlantillaSesionEjercicio[]
                                    return (
                                        <div
                                            key={sesion.id}
                                            className="rounded-lg p-3"
                                            style={{ background: 'rgba(128,128,128,0.06)', border: '1px solid var(--border)' }}
                                        >
                                            <p className="font-medium text-sm mb-2" style={{ color: 'var(--text)' }}>
                                                {sesion.nombre}
                                                {sesion.dia_semana && <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>· {sesion.dia_semana}</span>}
                                            </p>
                                            <div className="flex flex-col gap-1">
                                                {ejercicios.sort((a, b) => a.orden - b.orden).map((ej, idx) => (
                                                    <div key={ej.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        <span className="w-4 opacity-50">{idx + 1}.</span>
                                                        <span className="font-medium" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre}</span>
                                                        <span>
                                                            {ej.series}×{ej.repeticiones}
                                                            {ej.rpe ? ` · RPE ${ej.rpe}` : ''}
                                                            {ej.descanso_segundos ? ` · ${ej.descanso_segundos}s` : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const loadingSpinner = (
        <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="animate-spin" />
            Cargando plantillas…
        </div>
    )

    const hayAlgunaPlantilla = (Object.keys(MODALITY_CONFIG) as SportModality[]).some(m => agrupadasPorModalidad[m].length > 0) || legacy.length > 0

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Planificación de entrenos</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Plantillas predefinidas por modalidad — Gym, HYROX, Running, Ciclismo, Funcional, Calistenia
                    </p>
                </div>
                <button
                    onClick={poblarPlantillas}
                    disabled={seedStatus === 'loading'}
                    className="btn-primary flex items-center gap-2"
                >
                    {seedStatus === 'loading' ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Download size={16} />
                    )}
                    {seedStatus === 'loading' ? 'Insertando…' : 'Poblar plantillas'}
                </button>
            </header>

            {/* Estado del seed */}
            {seedMessage && (
                <div
                    className="mb-6 p-3 rounded-lg text-sm flex items-center gap-2"
                    style={seedStatus === 'success'
                        ? { background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.35)', color: 'rgb(52,199,89)' }
                        : seedStatus === 'error'
                            ? { background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.35)', color: 'rgb(255,69,58)' }
                            : { background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)' }
                    }
                >
                    {seedStatus === 'success' ? <CheckCircle2 size={16} /> :
                        seedStatus === 'error' ? <AlertCircle size={16} /> :
                            <Loader2 size={16} className="animate-spin" />}
                    {seedMessage}
                </div>
            )}

            {/* Filtros */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, modalidad, tier…"
                        className="input search-input"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <button
                        onClick={() => setFiltroModalidad(null)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                        style={filtroModalidad === null
                            ? { background: 'rgba(168,85,247,0.2)', color: 'rgb(192,132,252)', border: '1px solid rgba(168,85,247,0.4)' }
                            : { background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)', border: '1px solid transparent' }
                        }
                    >
                        Todas
                    </button>
                    {(Object.keys(MODALITY_CONFIG) as SportModality[]).map(m => {
                        const c = MODALITY_CONFIG[m]
                        return (
                            <button
                                key={m}
                                onClick={() => setFiltroModalidad(filtroModalidad === m ? null : m)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
                                style={filtroModalidad === m
                                    ? { background: c.bgRgba, color: c.colorRgb, border: `1px solid ${c.bgRgba.replace('0.15', '0.4')}` }
                                    : { background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)', border: '1px solid transparent' }
                                }
                            >
                                <c.Icon size={14} />
                                {c.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Listado */}
            {loading ? (
                loadingSpinner
            ) : !hayAlgunaPlantilla ? (
                <div className="card text-center py-16">
                    <Target size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>
                        {plantillas.length === 0
                            ? 'Todavía no hay plantillas de entrenamiento'
                            : 'No hay plantillas que coincidan con tu búsqueda'}
                    </p>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                        {plantillas.length === 0
                            ? 'Pulsa "Poblar plantillas" para insertar las plantillas predefinidas'
                            : 'Prueba con otros filtros'}
                    </p>
                    {plantillas.length === 0 && (
                        <button onClick={poblarPlantillas} disabled={seedStatus === 'loading'} className="btn-primary">
                            Poblar plantillas
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {(Object.keys(MODALITY_CONFIG) as SportModality[]).map(m => {
                        const items = agrupadasPorModalidad[m]
                        if (items.length === 0) return null
                        const c = MODALITY_CONFIG[m]
                        return (
                            <div key={m}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.bgRgba }}>
                                        <c.Icon size={16} style={{ color: c.colorRgb }} />
                                    </div>
                                    <h2 className="font-semibold" style={{ color: 'var(--text)' }}>{c.label}</h2>
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({items.length} plantilla{items.length !== 1 ? 's' : ''})</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {items.map(renderPlantillaCard)}
                                </div>
                            </div>
                        )
                    })}
                    {legacy.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.15)' }}>
                                    <Dumbbell size={16} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>General</h2>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({legacy.length} plantilla{legacy.length !== 1 ? 's' : ''})</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {legacy.map(renderPlantillaCard)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
