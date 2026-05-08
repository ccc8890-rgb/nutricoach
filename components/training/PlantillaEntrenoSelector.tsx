'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlantillaEntrenamiento, PlantillaSesion, PlantillaSesionEjercicio, ProgresionPlantilla } from '@/types'
import { Dumbbell, Heart, Flame, Target, ChevronDown, ChevronUp, Check, Zap, Bike, Waves } from 'lucide-react'

interface Props {
    onSeleccionar: (plantilla: PlantillaEntrenamiento) => void
    seleccionada: PlantillaEntrenamiento | null
}

const TIPO_ICON: Record<string, React.ReactNode> = {
    gimnasio: <Dumbbell size={18} />,
    cardio: <Heart size={18} />,
    mixto: <Flame size={18} />,
}

const OBJETIVO_COLOR: Record<string, string> = {
    hipertrofia: 'badge-purple',
    fuerza: 'badge-blue',
    perdida_grasa: 'badge-orange',
    cardio: 'badge-red',
    tonificacion: 'badge-green',
    rendimiento: 'badge-teal',
}

function detectarSubcategoria(p: PlantillaEntrenamiento): string {
    const n = (p.nombre ?? '').toLowerCase()
    if (n.includes('hyrox')) return 'HYROX'
    if (n.includes('triatlón') || n.includes('triatlon') || n.includes('ironman')) return 'Triatlón'
    if (n.includes('ciclismo') || n.includes('rodillo') || n.includes('ftp') || n.includes('bici')) return 'Ciclismo'
    if (n.includes('running') || n.includes('maratón') || n.includes('maraton') || n.includes('5k') || n.includes('10k') || n.includes('media')) return 'Running'
    if (n.includes('full body')) return 'Full Body'
    if (n.includes('push') || n.includes('pull') || n.includes('ppl')) return 'PPL'
    if (n.includes('torso') || n.includes('pierna')) return 'Torso/Pierna'
    if (n.includes('upper') || n.includes('lower')) return 'Upper/Lower'
    if (n.includes('weider')) return 'Weider'
    if (n.includes('hiit')) return 'HIIT'
    if (n.includes('cardio') || n.includes('steady') || n.includes('liss') || n.includes('estado estable')) return 'Cardio Estado Estable'
    return ''
}

const MODALIDAD_GRUPOS: { key: string; label: string; icon: React.ReactNode; tipos: string[]; detectar: (p: PlantillaEntrenamiento) => boolean }[] = [
    { key: 'hyrox', label: 'HYROX', icon: <Zap size={14} />, tipos: ['mixto'], detectar: (p) => detectarSubcategoria(p) === 'HYROX' },
    { key: 'triatlon', label: 'Triatlón', icon: <Waves size={14} />, tipos: ['mixto'], detectar: (p) => detectarSubcategoria(p) === 'Triatlón' },
    { key: 'ciclismo', label: 'Ciclismo', icon: <Bike size={14} />, tipos: ['cardio'], detectar: (p) => detectarSubcategoria(p) === 'Ciclismo' },
    { key: 'running', label: 'Running', icon: <Heart size={14} />, tipos: ['cardio'], detectar: (p) => detectarSubcategoria(p) === 'Running' },
    { key: 'gimnasio', label: 'Gimnasio', icon: <Dumbbell size={14} />, tipos: ['gimnasio'], detectar: (p) => !['HYROX', 'Triatlón', 'Ciclismo', 'Running'].includes(detectarSubcategoria(p)) },
    { key: 'cardio', label: 'Cardio', icon: <Heart size={14} />, tipos: ['cardio'], detectar: (p) => !['Ciclismo', 'Running'].includes(detectarSubcategoria(p)) },
]

export default function PlantillaEntrenoSelector({ onSeleccionar, seleccionada }: Props) {
    const [plantillas, setPlantillas] = useState<PlantillaEntrenamiento[]>([])
    const [loading, setLoading] = useState(true)
    const [expandida, setExpandida] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const { data } = await supabase
                .from('plantillas_entrenamiento')
                .select('*, sesiones:plantilla_sesiones(*, ejercicios:plantilla_sesion_ejercicios(*, ejercicio:ejercicios(*)))')
                .eq('coach_id', user.id)
                .eq('activo', true)
                .order('tipo', { ascending: true })
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

    function renderPlantillaCard(p: PlantillaEntrenamiento) {
        const estaSeleccionada = seleccionada?.id === p.id
        const estaExpandida = expandida === p.id
        const sesiones = (p.sesiones ?? []) as PlantillaSesion[]
        const sub = detectarSubcategoria(p)

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
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.tipo === 'cardio' ? 'bg-red-50 text-red-500' :
                            p.tipo === 'mixto' ? 'bg-orange-50 text-orange-500' :
                                'bg-purple-50 text-purple-600'
                            }`}>
                            {p.tipo === 'mixto' ? <Zap size={18} /> :
                                p.tipo === 'cardio' ? <Heart size={18} /> :
                                    TIPO_ICON[p.tipo ?? 'gimnasio'] ?? <Dumbbell size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900 text-[15px]">{p.nombre}</p>
                                {estaSeleccionada && <Check size={16} className="text-purple-600 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm text-gray-400">{p.dias_por_semana} días/sem · {p.nivel}</span>
                                {sub && (
                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                        {sub}
                                    </span>
                                )}
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
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{p.descripcion}</p>
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
            <p className="text-xs text-gray-400 mb-4">
                Selecciona una plantilla para rellenar automáticamente las sesiones y ejercicios
            </p>

            {MODALIDAD_GRUPOS.map(({ key, label, icon, tipos, detectar }) => {
                const items = plantillas.filter(p => tipos.includes(p.tipo ?? '') && detectar(p))
                if (items.length === 0) return null
                return (
                    <div key={key} className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            {icon} {label}
                        </p>
                        <div className="flex flex-col gap-2">
                            {items.map(renderPlantillaCard)}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
