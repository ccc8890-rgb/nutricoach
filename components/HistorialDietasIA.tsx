'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, Clock, CheckCircle, XCircle, Loader2, AlertCircle, UtensilsCrossed, ChevronRight, Sparkles } from 'lucide-react'

interface Props {
    clienteId: string
}

interface HistorialEntry {
    plan: {
        id: string
        nombre: string
        kcal_objetivo: number | null
        proteinas_objetivo: number | null
        carbohidratos_objetivo: number | null
        grasas_objetivo: number | null
        activo: boolean
        codigo_publico: string | null
        created_at: string
    }
    respuesta: {
        id: string
        estado: string
        nombre_cliente: string | null
        email_cliente: string | null
        created_at: string
    } | null
    num_comidas: number
    es_generado_ia: boolean
}

const ESTADO_IA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    nueva: { label: 'Respuesta nueva', color: '#3B82F6', bg: '#EFF6FF' },
    procesando: { label: 'Generando dieta…', color: '#A1A1A6', bg: 'rgba(161,161,166,0.08)' },
    dieta_lista: { label: 'Dieta generada', color: '#0D9488', bg: '#F0FDFA' },
    dieta_aprobada: { label: 'Dieta aprobada', color: '#10B981', bg: '#ECFDF5' },
    dieta_rechazada: { label: 'Dieta rechazada', color: '#EF4444', bg: '#FEF2F2' },
}

export default function HistorialDietasIA({ clienteId }: Props) {
    const [historial, setHistorial] = useState<HistorialEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/clientes/${clienteId}/historial-ia`)
                if (!res.ok) throw new Error('Error al cargar historial')
                const json = await res.json()
                setHistorial(json.data ?? [])
            } catch (err) {
                console.error('Error cargando historial IA:', err)
                setError('No se pudo cargar el historial')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [clienteId])

    if (loading) return (
        <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: '#0D9488' }} />
        </div>
    )

    if (error) return (
        <div className="card text-center py-12">
            <AlertCircle size={36} className="mx-auto text-red-400 mb-3" />
            <p className="text-gray-500 text-sm">{error}</p>
        </div>
    )

    if (historial.length === 0) return (
        <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#F0FDFA' }}>
                <Brain size={32} style={{ color: '#0D9488' }} />
            </div>
            <p className="text-gray-500 font-medium mb-2">Sin historial de dietas IA</p>
            <p className="text-sm text-gray-400 mb-4">
                Las dietas generadas con DeepSeek aparecerán aquí con su estado y versión
            </p>
            <Link
                href="/respuestas"
                className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            >
                <Sparkles size={14} /> Ir a respuestas
            </Link>
        </div>
    )

    return (
        <div className="space-y-4">
            {/* Timeline */}
            <div className="relative">
                {/* Línea vertical */}
                <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-100" />

                <div className="space-y-4">
                    {historial.map((entry, idx) => {
                        const estado = entry.respuesta?.estado
                        const estadoInfo = estado ? ESTADO_IA_LABELS[estado] : null
                        const fecha = new Date(entry.plan.created_at)
                        const esActivo = entry.plan.activo
                        const esIa = entry.es_generado_ia

                        return (
                            <div key={entry.plan.id} className="relative pl-10">
                                {/* Indicador de timeline */}
                                <div className={`absolute left-[13px] top-[18px] w-[13px] h-[13px] rounded-full border-2 border-white shadow-sm z-10
                                    ${esActivo ? 'bg-green-500' : 'bg-gray-300'}`}
                                />

                                {/* Card */}
                                <Link
                                    href={`/dietas/${entry.plan.id}`}
                                    className="card block hover:shadow-md transition-shadow !p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            {/* Header */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-semibold text-gray-900 text-sm truncate">
                                                    {entry.plan.nombre}
                                                </h3>
                                                {esIa && (
                                                    <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                                        style={{ background: '#F0FDFA', color: '#0D9488' }}>
                                                        <Brain size={10} />
                                                        IA
                                                    </span>
                                                )}
                                                <span className={`badge ${esActivo ? 'badge-green' : 'badge-gray'} text-[10px]`}>
                                                    {esActivo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>

                                            {/* Macros row */}
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                                <span className="font-semibold text-gray-700">
                                                    {entry.plan.kcal_objetivo ? `${entry.plan.kcal_objetivo} kcal` : 'Sin macros'}
                                                </span>
                                                {entry.plan.proteinas_objetivo && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444' }} />
                                                        P:{entry.plan.proteinas_objetivo}g
                                                    </span>
                                                )}
                                                {entry.plan.carbohidratos_objetivo && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A1A1A6' }} />
                                                        C:{entry.plan.carbohidratos_objetivo}g
                                                    </span>
                                                )}
                                                {entry.plan.grasas_objetivo && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#8B5CF6' }} />
                                                        G:{entry.plan.grasas_objetivo}g
                                                    </span>
                                                )}
                                            </div>

                                            {/* Meta info */}
                                            <div className="flex items-center gap-4 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} />
                                                    {fecha.toLocaleDateString('es-ES', {
                                                        day: 'numeric', month: 'short', year: 'numeric'
                                                    })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <UtensilsCrossed size={11} />
                                                    {entry.num_comidas} comidas
                                                </span>
                                                {entry.respuesta?.nombre_cliente && (
                                                    <span>{entry.respuesta.nombre_cliente}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Estado badge + flecha */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {estadoInfo ? (
                                                <span className="text-[10px] font-medium px-2 py-1 rounded-full whitespace-nowrap"
                                                    style={{ background: estadoInfo.bg, color: estadoInfo.color }}>
                                                    {estadoInfo.label}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-400 whitespace-nowrap">
                                                    Plan manual
                                                </span>
                                            )}
                                            <ChevronRight size={14} className="text-gray-300" />
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-gray-400 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span>Plan activo</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <span>Plan inactivo</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Brain size={12} style={{ color: '#0D9488' }} />
                    <span>Generado por IA</span>
                </div>
            </div>
        </div>
    )
}
