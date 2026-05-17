'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio, ProgresionPlantilla, SportModality, TrainingTier } from '@/types'
import { Dumbbell, Heart, Flame, Target, ChevronDown, ChevronUp, Check, Zap, Bike, Waves, Crown } from 'lucide-react'

interface Props {
    onSeleccionar: (plantilla: PlantillaEntrenamiento) => void
    seleccionada: PlantillaEntrenamiento | null
}

// --- Modality config ---
const MODALITY_CONFIG: Record<SportModality, { label: string; icon: React.ReactNode; color: string }> = {
    gym_estetica:  { label: 'Gym Estética', icon: <Dumbbell size={13} />,  color: 'bg-purple-50 text-purple-600 border-purple-200' },
    gym_fuerza:    { label: 'Gym Fuerza',   icon: <Dumbbell size={13} />,  color: 'bg-blue-50 text-blue-600 border-blue-200' },
    funcional:     { label: 'Funcional',    icon: <Flame size={13} />,     color: 'bg-orange-50 text-orange-600 border-orange-200' },
    hyrox:         { label: 'HYROX',        icon: <Zap size={13} />,       color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    ciclismo:      { label: 'Ciclismo',     icon: <Bike size={13} />,      color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
    running:       { label: 'Running',      icon: <Heart size={13} />,     color: 'bg-red-50 text-red-500 border-red-200' },
    hibrido:       { label: 'Híbrido',      icon: <Waves size={13} />,     color: 'bg-teal-50 text-teal-600 border-teal-200' },
    calistenia:    { label: 'Calistenia',   icon: <Dumbbell size={13} />,  color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
}

const OBJETIVO_COLOR: Record<string, string> = {
    hipertrofia:   'badge-purple',
    fuerza:        'badge-blue',
    perdida_grasa: 'badge-orange',
    cardio:        'badge-red',
    tonificacion:  'badge-green',
    rendimiento:   'badge-teal',
}

// Fallback detection for templates without sport_modality set
function detectarSubcategoria(p: PlantillaEntrenamiento): string {
    const n = (p.nombre ?? '').toLowerCase()
    if (n.includes('hyrox')) return 'HYROX'
    if (n.includes('ciclismo') || n.includes('ftp') || n.includes('bici')) return 'Ciclismo'
    if (n.includes('running') || n.includes('maratón') || n.includes('vdot')) return 'Running'
    if (n.includes('calistenia') || n.includes('muscle-up')) return 'Calistenia'
    if (n.includes('híbrido') || n.includes('hibrido')) return 'Híbrido'
    if (n.includes('funcional')) return 'Funcional'
    if (n.includes('fuerza')) return 'Gym Fuerza'
    return 'Gym Estética'
}

export default function PlantillaEntrenoSelector({ onSeleccionar, seleccionada }: Props) {
    const [plantillas, setPlantillas] = useState<PlantillaEntrenamiento[]>([])
    const [loading, setLoading] = useState(true)
    const [expandida, setExpandida] = useState<string | null>(null)
    const [filtroModalidad, setFiltroModalidad] = useState<SportModality | null>(null)
    const [filtroTier, setFiltroTier] = useState<TrainingTier | null>(null)

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data } = await supabase
                .from('plantillas_entrenamiento')
                .select('*, sesiones:plantilla_sesiones(*, ejercicios:plantilla_sesion_ejercicios(*, ejercicio:ejercicios(*)))')
                .eq('coach_id', user.id)
                .eq('activo', true)
                .order('tier', { ascending: true })
                .order('sport_modality', { ascending: true })
                .order('dias_por_semana', { ascending: true })

            setPlantillas(data ?? [])
            setLoading(false)
        }
        load()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                Cargando plantillas…
            </div>
        )
    }

    if (plantillas.length === 0) return null

    // Compute which modalities are present (for filter buttons)
    const modalidadesPresentes = new Set(
        plantillas.map(p => p.sport_modality as SportModality | undefined).filter(Boolean)
    ) as Set<SportModality>

    // Apply filters
    const plantillasFiltradas = plantillas.filter(p => {
        if (filtroTier && p.tier !== filtroTier) return false
        if (filtroModalidad && p.sport_modality !== filtroModalidad) return false
        return true
    })

    function renderPlantillaCard(p: PlantillaEntrenamiento) {
        const estaSeleccionada = seleccionada?.id === p.id
        const estaExpandida = expandida === p.id
        const sesiones = (p.sesiones ?? []) as PlantillaSesion[]
        const modality = p.sport_modality as SportModality | undefined
        const tier = p.tier as TrainingTier | undefined
        const modalityCfg = modality ? MODALITY_CONFIG[modality] : null

        return (
            <div
                key={p.id}
                className={`border rounded-xl transition-all cursor-pointer ${estaSeleccionada
                    ? 'border-purple-500 bg-purple-50/50 shadow-sm'
                    : 'border-gray-200 hover:border-purple-200 hover:shadow-sm'
                    }`}
            >
                {/* Header */}
                <div className="p-4" onClick={() => { onSeleccionar(p); setExpandida(estaSeleccionada ? null : p.id) }}>
                    <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            modality ? (modalityCfg?.color.split(' ')[0] + ' ' + modalityCfg?.color.split(' ')[1]) :
                            p.tipo === 'cardio' ? 'bg-red-50 text-red-500' :
                            p.tipo === 'mixto' ? 'bg-orange-50 text-orange-500' :
                            'bg-purple-50 text-purple-600'
                        }`}>
                            {modality ? modalityCfg?.icon :
                                p.tipo === 'mixto' ? <Zap size={18} /> :
                                p.tipo === 'cardio' ? <Heart size={18} /> :
                                <Dumbbell size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 text-[15px]">{p.nombre}</p>
                                {estaSeleccionada && <Check size={16} className="text-purple-600 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-sm text-gray-400">{p.dias_por_semana} días/sem · {p.nivel}</span>
                                {/* Tier badge */}
                                {tier === 'elite' && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                        <Crown size={9} /> Elite
                                    </span>
                                )}
                                {/* Sport modality badge */}
                                {modalityCfg && (
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium border px-1.5 py-0.5 rounded-full ${modalityCfg.color}`}>
                                        {modalityCfg.icon}
                                        {modalityCfg.label}
                                    </span>
                                )}
                                {/* Fallback subcategory badge if no sport_modality */}
                                {!modality && (() => { const sub = detectarSubcategoria(p); return sub ? (
                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{sub}</span>
                                ) : null })()}
                            </div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                            {p.objetivo && (
                                <span className={`badge text-[11px] ${OBJETIVO_COLOR[p.objetivo] ?? 'badge-gray'}`}>
                                    {p.objetivo.replace('_', ' ')}
                                </span>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); setExpandida(estaExpandida ? null : p.id) }}
                                className="text-gray-300 hover:text-gray-600"
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

                        {/* PROGRESIÓN SEMANAL */}
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
                                                <span className="text-[10px] font-medium text-[#8E8E93] bg-[#E5E5EA] px-1.5 py-0.5 rounded">{sem.descripcion?.match(/RPE [\d-]+\/10/)?.[0] || ''}</span>
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

                        {/* SESIONES */}
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

                        {/* NOTA DE INDIVIDUALIZACIÓN */}
                        {p.descripcion?.includes('🎯') && (
                            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">🎯 Individualización</p>
                                <p className="text-[11px] text-blue-700 leading-relaxed">
                                    {p.descripcion.split('🎯')[1]?.trim()}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="card">
            <div className="flex items-center gap-2 mb-1">
                <Target size={16} className="text-purple-600" />
                <h2 className="font-semibold text-gray-800">Plantillas predefinidas</h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">
                Selecciona una plantilla para rellenar automáticamente las sesiones y ejercicios
            </p>

            {/* ─── Filtros ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 mb-4">
                {/* Tier filter */}
                <div className="flex gap-1.5 flex-wrap">
                    {(['all', 'general', 'elite'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setFiltroTier(t === 'all' ? null : t as TrainingTier)}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                (t === 'all' && filtroTier === null) || filtroTier === t
                                    ? t === 'elite'
                                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                                        : t === 'general'
                                            ? 'bg-gray-200 text-gray-700 border-gray-300'
                                            : 'bg-purple-100 text-purple-700 border-purple-300'
                                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            {t === 'elite' && <Crown size={10} />}
                            {t === 'all' ? 'Todos' : t === 'elite' ? 'Elite' : 'General'}
                        </button>
                    ))}
                </div>

                {/* Modality filter — only show modalities present in data */}
                {modalidadesPresentes.size > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => setFiltroModalidad(null)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                filtroModalidad === null
                                    ? 'bg-purple-100 text-purple-700 border-purple-300'
                                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            Todas
                        </button>
                        {(Object.keys(MODALITY_CONFIG) as SportModality[]).filter(m => modalidadesPresentes.has(m)).map(m => {
                            const cfg = MODALITY_CONFIG[m]
                            return (
                                <button
                                    key={m}
                                    onClick={() => setFiltroModalidad(filtroModalidad === m ? null : m)}
                                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                        filtroModalidad === m
                                            ? cfg.color
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {cfg.icon}
                                    {cfg.label}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ─── Lista filtrada ───────────────────────────────────── */}
            {plantillasFiltradas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                    No hay plantillas con estos filtros
                </p>
            ) : filtroModalidad ? (
                // Flat list when a specific modality is active
                <div className="flex flex-col gap-2">
                    {plantillasFiltradas.map(renderPlantillaCard)}
                </div>
            ) : (
                // Grouped by modality
                (Object.keys(MODALITY_CONFIG) as SportModality[]).map(m => {
                    const items = plantillasFiltradas.filter(p => p.sport_modality === m)
                    if (items.length === 0) return null
                    const cfg = MODALITY_CONFIG[m]
                    return (
                        <div key={m} className="mb-4">
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${cfg.color.split(' ')[1]}`}>
                                {cfg.icon} {cfg.label}
                            </p>
                            <div className="flex flex-col gap-2">
                                {items.map(renderPlantillaCard)}
                            </div>
                        </div>
                    )
                })
            )}

            {/* Templates without sport_modality (legacy) */}
            {(() => {
                const legacy = plantillasFiltradas.filter(p => !p.sport_modality)
                if (legacy.length === 0 || filtroModalidad) return null
                return (
                    <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Dumbbell size={13} /> General
                        </p>
                        <div className="flex flex-col gap-2">
                            {legacy.map(renderPlantillaCard)}
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
