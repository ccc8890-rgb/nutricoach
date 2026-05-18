'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio, ProgresionPlantilla, SportModality, TrainingTier, PerfilEntrenoCliente } from '@/types'
import { Dumbbell, Target, ChevronDown, ChevronUp, Check, Crown, AlertTriangle, Sparkles } from 'lucide-react'
import { MODALITY_CONFIG, detectarSubcategoriaLegacy } from '@/lib/entrenos/utils'
import { evaluarPerfilEntreno, type RecomendacionEntreno } from '@/lib/motor-entreno'

interface Props {
    onSeleccionar: (plantilla: PlantillaEntrenamiento) => void
    seleccionada: PlantillaEntrenamiento | null
    clienteId?: string
}

const OBJETIVO_COLOR: Record<string, string> = {
    hipertrofia:   'badge-purple',
    fuerza:        'badge-blue',
    perdida_grasa: 'badge-orange',
    cardio:        'badge-red',
    tonificacion:  'badge-green',
    rendimiento:   'badge-teal',
}

export default function PlantillaEntrenoSelector({ onSeleccionar, seleccionada, clienteId }: Props) {
    const [plantillas, setPlantillas] = useState<PlantillaEntrenamiento[]>([])
    const [loading, setLoading] = useState(true)
    const [expandida, setExpandida] = useState<string | null>(null)
    const [filtroModalidad, setFiltroModalidad] = useState<SportModality | null>(null)
    const [filtroTier, setFiltroTier] = useState<TrainingTier | null>(null)
    const [recomendacion, setRecomendacion] = useState<RecomendacionEntreno | null>(null)

    useEffect(() => {
        if (!clienteId) return
        async function loadPerfil() {
            const res = await fetch(`/api/perfil-entreno/${clienteId}`, { credentials: 'include' })
            if (!res.ok) return
            const { perfil } = await res.json() as { perfil: PerfilEntrenoCliente | null }
            if (!perfil) return
            const rec = evaluarPerfilEntreno(perfil)
            setRecomendacion(rec)
            if (rec.filtros_plantilla.sport_modality) setFiltroModalidad(rec.filtros_plantilla.sport_modality)
            if (rec.filtros_plantilla.tier) setFiltroTier(rec.filtros_plantilla.tier)
        }
        loadPerfil().catch(() => {})
    }, [clienteId])

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data } = await supabase
                .from('plantillas_entrenamiento')
                .select('*, sesiones:plantilla_sesiones(*, ejercicios:plantilla_sesion_ejercicios(*, ejercicio:ejercicios(*)))')
                .eq('coach_id', user.id)
                .eq('activo', true)
                .order('tier', { ascending: false })   // general antes que elite
                .order('sport_modality', { ascending: true })
                .order('dias_por_semana', { ascending: true })

            setPlantillas(data ?? [])
            setLoading(false)
        }
        load()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: 'var(--text-muted)' }}>
                <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                Cargando plantillas…
            </div>
        )
    }

    if (plantillas.length === 0) return null

    const modalidadesPresentes = new Set(
        plantillas.map(p => p.sport_modality as SportModality | undefined).filter(Boolean)
    ) as Set<SportModality>

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
        const cfg = modality ? MODALITY_CONFIG[modality] : null

        return (
            <div
                key={p.id}
                className="border rounded-xl transition-all cursor-pointer"
                style={estaSeleccionada
                    ? { borderColor: 'rgb(168,85,247)', background: 'rgba(168,85,247,0.10)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                    : { borderColor: 'var(--border)', background: 'var(--surface)' }
                }
            >
                <div className="p-4" onClick={() => { onSeleccionar(p); setExpandida(estaSeleccionada ? null : p.id) }}>
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
                                {estaSeleccionada && <Check size={16} className="text-purple-400 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.dias_por_semana} días/sem · {p.nivel}</span>
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
                                {!modality && (() => {
                                    const sub = detectarSubcategoriaLegacy(p.nombre ?? '')
                                    return sub
                                        ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: 'var(--text-muted)', background: 'rgba(128,128,128,0.12)' }}>{sub}</span>
                                        : null
                                })()}
                            </div>
                        </div>

                        <div className="flex gap-1.5 flex-wrap justify-end">
                            {p.objetivo && (
                                <span className={`badge text-[11px] ${OBJETIVO_COLOR[p.objetivo] ?? 'badge-gray'}`}>
                                    {p.objetivo.replace(/_/g, ' ')}
                                </span>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); setExpandida(estaExpandida ? null : p.id) }}
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

                {estaExpandida && (
                    <div className="px-4 pb-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                        {/* Progresión semanal */}
                        {p.progresion && Array.isArray(p.progresion) && p.progresion.length > 0 && (
                            <div className="mb-3">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>📈 Progresión semanal</p>
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

                        {/* Sesiones */}
                        {sesiones.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>🏋️ Sesiones</p>
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

                        {/* Individualización */}
                        {p.descripcion?.includes('🎯') && (
                            <div
                                className="mt-3 rounded-lg p-2.5"
                                style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.25)' }}
                            >
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgb(10,132,255)' }}>🎯 Individualización</p>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'rgb(10,132,255)' }}>{p.descripcion.split('🎯')[1]?.trim()}</p>
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
                <Target size={16} className="text-purple-400" />
                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Plantillas predefinidas</h2>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Selecciona una plantilla para rellenar automáticamente las sesiones y ejercicios
            </p>

            {/* Panel recomendación del motor */}
            {recomendacion && (
                <div
                    className="mb-4 rounded-xl p-3 space-y-2"
                    style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.25)' }}
                >
                    <div className="flex items-start gap-2">
                        <Sparkles size={13} style={{ color: 'rgb(10,132,255)' }} className="mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgb(10,132,255)' }}>Motor de recomendación</p>
                            <p className="text-xs" style={{ color: 'rgb(10,132,255)' }}>{recomendacion.foco_principal}</p>
                        </div>
                    </div>
                    {recomendacion.advertencias.length > 0 && (
                        <div className="space-y-1 pt-1" style={{ borderTop: '1px solid rgba(10,132,255,0.2)' }}>
                            {recomendacion.advertencias.map((adv, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                    <AlertTriangle size={11} style={{ color: '#C9A96E' }} className="mt-0.5 flex-shrink-0" />
                                    <p className="text-[11px]" style={{ color: '#C9A96E' }}>{adv}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {recomendacion.ajustes_adicionales.length > 0 && (
                        <div className="space-y-1 pt-1" style={{ borderTop: '1px solid rgba(10,132,255,0.2)' }}>
                            {recomendacion.ajustes_adicionales.map((aj, i) => (
                                <p
                                    key={i}
                                    className="text-[11px] pl-3"
                                    style={{ color: 'var(--text-muted)', borderLeft: '2px solid rgba(10,132,255,0.35)' }}
                                >{aj}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Filtros */}
            <div className="flex flex-col gap-2 mb-4">
                {/* Tier */}
                <div className="flex gap-1.5 flex-wrap">
                    {(['all', 'general', 'elite'] as const).map(t => {
                        const isActive = (t === 'all' && filtroTier === null) || filtroTier === t
                        return (
                            <button
                                key={t}
                                onClick={() => setFiltroTier(t === 'all' ? null : t as TrainingTier)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
                                style={isActive
                                    ? t === 'elite'
                                        ? { background: 'rgba(201,169,110,0.2)', borderColor: 'rgba(201,169,110,0.5)', color: '#C9A96E' }
                                        : t === 'general'
                                            ? { background: 'rgba(128,128,128,0.2)', borderColor: 'rgba(128,128,128,0.4)', color: 'var(--text)' }
                                            : { background: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.5)', color: 'rgb(192,132,252)' }
                                    : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                                }
                            >
                                {t === 'elite' && <Crown size={10} />}
                                {t === 'all' ? 'Todos' : t === 'elite' ? 'Elite' : 'General'}
                            </button>
                        )
                    })}
                </div>

                {/* Modalidad */}
                {modalidadesPresentes.size > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => setFiltroModalidad(null)}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
                            style={filtroModalidad === null
                                ? { background: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.5)', color: 'rgb(192,132,252)' }
                                : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                            }
                        >
                            Todas
                        </button>
                        {(Object.keys(MODALITY_CONFIG) as SportModality[]).filter(m => modalidadesPresentes.has(m)).map(m => {
                            const c = MODALITY_CONFIG[m]
                            return (
                                <button
                                    key={m}
                                    onClick={() => setFiltroModalidad(filtroModalidad === m ? null : m)}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
                                    style={filtroModalidad === m
                                        ? { background: c.bgRgba, color: c.colorRgb, borderColor: c.bgRgba.replace('0.15', '0.4') }
                                        : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                                    }
                                >
                                    <c.Icon size={12} />
                                    {c.label}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Lista */}
            {plantillasFiltradas.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No hay plantillas con estos filtros</p>
            ) : filtroModalidad ? (
                <div className="flex flex-col gap-2">
                    {plantillasFiltradas.map(renderPlantillaCard)}
                </div>
            ) : (
                <>
                    {(Object.keys(MODALITY_CONFIG) as SportModality[]).map(m => {
                        const items = plantillasFiltradas.filter(p => p.sport_modality === m)
                        if (items.length === 0) return null
                        const c = MODALITY_CONFIG[m]
                        return (
                            <div key={m} className="mb-4">
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${c.color}`}>
                                    <c.Icon size={13} /> {c.label}
                                </p>
                                <div className="flex flex-col gap-2">{items.map(renderPlantillaCard)}</div>
                            </div>
                        )
                    })}
                    {/* Legacy sin sport_modality */}
                    {(() => {
                        const legacy = plantillasFiltradas.filter(p => !p.sport_modality)
                        if (legacy.length === 0) return null
                        return (
                            <div className="mb-4">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                    <Dumbbell size={13} /> General
                                </p>
                                <div className="flex flex-col gap-2">{legacy.map(renderPlantillaCard)}</div>
                            </div>
                        )
                    })()}
                </>
            )}
        </div>
    )
}
