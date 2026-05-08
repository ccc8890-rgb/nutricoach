'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, Activity, Zap, MessageSquare, ChevronDown, ChevronUp, Clock, Loader2, AlertCircle, Sparkles, FileText, Bot } from 'lucide-react'

interface Props {
    clienteId: string
}

interface ConversacionEntry {
    id: string
    tipo: 'dieta' | 'informe_semanal' | 'ajuste_macros' | 'recomendacion'
    prompt: string
    respuesta: Record<string, unknown>
    resumen: string
    modelo: string
    tokens_usados: number | null
    created_at: string
    plan: { id: string; nombre: string; activo: boolean } | null
}

interface MetaData {
    cliente: { id: string; nombre: string; objetivo: string | null } | null
    total: number
    tipos: { dieta: number; informe_semanal: number; ajuste_macros: number; recomendacion: number }
}

const TIPO_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string; bg: string }> = {
    dieta: { label: 'Dieta generada', icon: Brain, color: '#0D9488', bg: '#F0FDFA' },
    informe_semanal: { label: 'Informe semanal', icon: Activity, color: '#3B82F6', bg: '#EFF6FF' },
    ajuste_macros: { label: 'Ajuste de macros', icon: Zap, color: '#A1A1A6', bg: 'rgba(161,161,166,0.08)' },
    recomendacion: { label: 'Recomendación', icon: MessageSquare, color: '#8B5CF6', bg: '#F5F3FF' },
}

function formatearFecha(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

function formatearFechaGrupo(iso: string): string {
    const d = new Date(iso)
    const hoy = new Date()
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)

    if (d.toDateString() === hoy.toDateString()) return 'Hoy'
    if (d.toDateString() === ayer.toDateString()) return 'Ayer'

    return d.toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined,
    })
}

function agruparPorFecha(entries: ConversacionEntry[]): Map<string, ConversacionEntry[]> {
    const grupos = new Map<string, ConversacionEntry[]>()
    for (const entry of entries) {
        const key = new Date(entry.created_at).toDateString()
        if (!grupos.has(key)) grupos.set(key, [])
        grupos.get(key)!.push(entry)
    }
    return grupos
}

export default function ConversacionesIA({ clienteId }: Props) {
    const [conversaciones, setConversaciones] = useState<ConversacionEntry[]>([])
    const [meta, setMeta] = useState<MetaData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/clientes/${clienteId}/conversaciones-ia`)
                if (!res.ok) throw new Error('Error al cargar conversaciones')
                const json = await res.json()
                setConversaciones(json.data ?? [])
                setMeta(json.meta ?? null)
            } catch (err) {
                console.error('Error cargando conversaciones IA:', err)
                setError('No se pudo cargar el historial de conversaciones')
            } finally {
                setLoading(false)
            }
        }
        if (clienteId) load()
    }, [clienteId])

    function toggleExpand(id: string) {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // --- Loading ---
    if (loading) return (
        <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: '#0D9488' }} />
        </div>
    )

    // --- Error ---
    if (error) return (
        <div className="card text-center py-12">
            <AlertCircle size={36} className="mx-auto text-red-400 mb-3" />
            <p className="text-gray-500 text-sm">{error}</p>
        </div>
    )

    // --- Empty ---
    if (conversaciones.length === 0) return (
        <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#F0FDFA' }}>
                <Bot size={32} style={{ color: '#0D9488' }} />
            </div>
            <p className="text-gray-500 font-medium mb-2">Sin conversaciones con IA</p>
            <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">
                Aquí aparecerán todas las interacciones con DeepSeek: dietas generadas,
                informes semanales y ajustes de macros.
            </p>
            <Link
                href={`/clientes/${clienteId}`}
                className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            >
                <Sparkles size={14} /> Ir a detalle del cliente
            </Link>
        </div>
    )

    const grupos = agruparPorFecha(conversaciones)
    const totalTokens = conversaciones.reduce((acc, c) => acc + (c.tokens_usados ?? 0), 0)

    return (
        <div className="space-y-6">
            {/* Resumen stats */}
            {meta && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => {
                        const count = meta.tipos[tipo as keyof typeof meta.tipos] ?? 0
                        return (
                            <div key={tipo} className="card !p-3 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: cfg.bg }}>
                                    <cfg.icon size={16} style={{ color: cfg.color }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-400 truncate">{cfg.label}</p>
                                    <p className="text-lg font-bold text-gray-800">{count}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Tokens totales */}
            {totalTokens > 0 && (
                <div className="text-xs text-gray-400 flex items-center gap-2 px-1">
                    <span>Total tokens usados:</span>
                    <span className="font-mono font-medium text-gray-600">{totalTokens.toLocaleString()}</span>
                </div>
            )}

            {/* Timeline */}
            <div className="relative">
                <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-100" />

                {Array.from(grupos.entries()).map(([fechaKey, entries]) => (
                    <div key={fechaKey} className="mb-6 last:mb-0">
                        {/* Separador de fecha */}
                        <div className="flex items-center gap-3 mb-3 pl-10">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                {formatearFechaGrupo(entries[0].created_at)}
                            </div>
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="text-[10px] text-gray-300 font-mono">{entries.length}</span>
                        </div>

                        <div className="space-y-3">
                            {entries.map((entry) => {
                                const cfg = TIPO_CONFIG[entry.tipo] ?? TIPO_CONFIG.dieta
                                const Icon = cfg.icon
                                const isExpanded = expandedIds.has(entry.id)
                                const fecha = new Date(entry.created_at)

                                return (
                                    <div key={entry.id} className="relative pl-10">
                                        {/* Punto timeline */}
                                        <div className="absolute left-[13px] top-[18px] w-[13px] h-[13px] rounded-full border-2 border-white shadow-sm z-10"
                                            style={{ background: cfg.color }}
                                        />

                                        {/* Card */}
                                        <div className="card !p-0 overflow-hidden">
                                            {/* Header clickable */}
                                            <button
                                                onClick={() => toggleExpand(entry.id)}
                                                className="w-full text-left !p-4 flex items-start justify-between gap-3 hover:bg-gray-50/50 transition-colors"
                                            >
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    {/* Icono tipo */}
                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                                        style={{ background: cfg.bg }}>
                                                        <Icon size={18} style={{ color: cfg.color }} />
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        {/* Tipo badge + modelo */}
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-semibold uppercase tracking-wider"
                                                                style={{ color: cfg.color }}>
                                                                {cfg.label}
                                                            </span>
                                                            {entry.modelo && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-mono">
                                                                    {entry.modelo}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Resumen */}
                                                        <p className="text-sm text-gray-700 leading-snug line-clamp-2">
                                                            {entry.resumen}
                                                        </p>

                                                        {/* Meta info */}
                                                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                                            <span className="flex items-center gap-1">
                                                                <Clock size={10} />
                                                                {fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            {entry.tokens_usados && (
                                                                <span className="font-mono">{entry.tokens_usados} tokens</span>
                                                            )}
                                                            {entry.plan && (
                                                                <span className="flex items-center gap-1">
                                                                    <FileText size={10} />
                                                                    <Link
                                                                        href={`/dietas/${entry.plan.id}`}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="hover:underline"
                                                                        style={{ color: '#0D9488' }}
                                                                    >
                                                                        {entry.plan.nombre}
                                                                    </Link>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expand toggle */}
                                                <div className="flex-shrink-0 mt-1">
                                                    {isExpanded ? (
                                                        <ChevronUp size={16} className="text-gray-300" />
                                                    ) : (
                                                        <ChevronDown size={16} className="text-gray-300" />
                                                    )}
                                                </div>
                                            </button>

                                            {/* Expandido: prompt + respuesta */}
                                            {isExpanded && (
                                                <div className="border-t border-gray-100" style={{ background: '#FAFAFA' }}>
                                                    {/* Prompt */}
                                                    <div className="p-4 border-b border-gray-100">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                                                            <MessageSquare size={12} />
                                                            Prompt enviado a DeepSeek
                                                        </p>
                                                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                                                            {entry.prompt}
                                                        </pre>
                                                    </div>

                                                    {/* Respuesta */}
                                                    <div className="p-4">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                                                            <Brain size={12} />
                                                            Respuesta generada
                                                        </p>
                                                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto bg-white rounded-lg p-3 border border-gray-100">
                                                            {JSON.stringify(entry.respuesta, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-gray-400 border-t border-gray-100">
                {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => (
                    <div key={tipo} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                        <span>{cfg.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
