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

const NIVEL_COLOR: Record<string, string> = {
    principiante: 'text-green-600 bg-green-50',
    intermedio: 'text-[#8E8E93] bg-[#F2F2F4]',
    avanzado: 'text-red-600 bg-red-50',
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

    // Agrupar por sport_modality (en el orden canónico de MODALITY_CONFIG)
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
                className="border border-gray-200 rounded-xl hover:border-purple-200 hover:shadow-sm transition-all"
            >
                <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandida(estaExpandida ? null : p.id)}
                >
                    <div className="flex items-start gap-3">
                        {/* Icono modalidad */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            cfg ? `${cfg.bg} ${cfg.color}` :
                            p.tipo === 'cardio' ? 'bg-red-50 text-red-500' :
                            p.tipo === 'mixto'  ? 'bg-orange-50 text-orange-500' :
                            'bg-purple-50 text-purple-600'
                        }`}>
                            {cfg ? <cfg.Icon size={18} /> : <Dumbbell size={18} />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 text-[15px]">{p.nombre}</p>
                                {tier === 'elite' && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                        <Crown size={9} /> Elite
                                    </span>
                                )}
                                {cfg && (
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium border px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                        <cfg.Icon size={11} />
                                        {cfg.label}
                                    </span>
                                )}
                                {subcategoria && (
                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                        {subcategoria}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${NIVEL_COLOR[p.nivel ?? ''] ?? 'text-gray-500 bg-gray-50'}`}>
                                    {p.nivel}
                                </span>
                                <span className="text-xs text-gray-400">{p.dias_por_semana} días/sem</span>
                                {(p.duracion_semanas ?? 0) > 0 && (
                                    <span className="text-xs text-gray-400">{p.duracion_semanas} semanas</span>
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
                                className="text-gray-300 hover:text-gray-600 ml-1"
                            >
                                {estaExpandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>
                    {p.descripcion && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{p.descripcion.split('🎯')[0].trim()}</p>
                    )}
                </div>

                {/* Sesiones expandidas */}
                {estaExpandida && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        {p.progresion && Array.isArray(p.progresion) && p.progresion.length > 0 && (
                            <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    📈 Progresión semanal
                                </p>
                                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                                    {p.progresion.map((sem: ProgresionPlantilla) => (
                                        <div key={sem.semana} className="bg-[#F2F2F4] border border-[#D1D1D6] rounded-lg p-2.5">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs font-bold text-[#48484A]">Semana {sem.semana} · {sem.titulo}</p>
                                                <span className="text-[10px] font-medium text-[#8E8E93] bg-[#E5E5EA] px-1.5 py-0.5 rounded">
                                                    {sem.descripcion?.match(/RPE [\d-]+\/10/)?.[0] || ''}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[#636366] leading-relaxed">{sem.descripcion}</p>
                                            {sem.ajustes && sem.ajustes.length > 0 && (
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    {sem.ajustes.map((a: string, i: number) => (
                                                        <p key={i} className="text-[10px] text-[#8E8E93] pl-2 border-l-2 border-[#C7C7CC]">{a}</p>
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
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                    🏋️ Sesiones
                                </p>
                                {sesiones.sort((a, b) => a.orden - b.orden).map(sesion => {
                                    const ejercicios = (sesion.ejercicios ?? []) as PlantillaSesionEjercicio[]
                                    return (
                                        <div key={sesion.id} className="bg-white border border-gray-100 rounded-lg p-3">
                                            <p className="font-medium text-sm text-gray-700 mb-2">
                                                {sesion.nombre}
                                                {sesion.dia_semana && <span className="text-gray-400 font-normal ml-1">· {sesion.dia_semana}</span>}
                                            </p>
                                            <div className="flex flex-col gap-1">
                                                {ejercicios.sort((a, b) => a.orden - b.orden).map((ej, idx) => (
                                                    <div key={ej.id} className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span className="text-gray-300 w-4">{idx + 1}.</span>
                                                        <span className="font-medium text-gray-600">{ej.ejercicio?.nombre}</span>
                                                        <span className="text-gray-400">
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
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
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
                    <h1 className="text-2xl font-bold text-gray-800">Planificación de entrenos</h1>
                    <p className="text-sm text-gray-400 mt-1">
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
                <div className={`mb-6 p-3 rounded-lg text-sm flex items-center gap-2 ${seedStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                    seedStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                        'bg-gray-50 text-gray-600'
                    }`}>
                    {seedStatus === 'success' ? <CheckCircle2 size={16} /> :
                        seedStatus === 'error' ? <AlertCircle size={16} /> :
                            <Loader2 size={16} className="animate-spin" />}
                    {seedMessage}
                </div>
            )}

            {/* Filtros */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filtroModalidad === null
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Todas
                    </button>
                    {(Object.keys(MODALITY_CONFIG) as SportModality[]).map(m => {
                        const c = MODALITY_CONFIG[m]
                        return (
                            <button
                                key={m}
                                onClick={() => setFiltroModalidad(filtroModalidad === m ? null : m)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${filtroModalidad === m
                                    ? `${c.bg} ${c.color} border ${c.border}`
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
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
                    <Target size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium mb-1">
                        {plantillas.length === 0
                            ? 'Todavía no hay plantillas de entrenamiento'
                            : 'No hay plantillas que coincidan con tu búsqueda'}
                    </p>
                    <p className="text-sm text-gray-400 mb-4">
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
                                    <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                                        <c.Icon size={16} className={c.color} />
                                    </div>
                                    <h2 className="font-semibold text-gray-700">{c.label}</h2>
                                    <span className="text-xs text-gray-400">({items.length} plantilla{items.length !== 1 ? 's' : ''})</span>
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
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <Dumbbell size={16} className="text-gray-500" />
                                </div>
                                <h2 className="font-semibold text-gray-700">General</h2>
                                <span className="text-xs text-gray-400">({legacy.length} plantilla{legacy.length !== 1 ? 's' : ''})</span>
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
