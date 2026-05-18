'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardText, ArrowRight, CheckCircle } from '@phosphor-icons/react'

interface CheckinRow {
    id: string
    fecha: string
    peso?: number
    adherencia?: number
    energia?: number
    notas?: string
    cliente_id: string
    cliente_nombre: string
}

function tiempoRelativo(fecha: string): string {
    const dias = Math.floor((Date.now() - new Date(fecha + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
    if (dias === 0) return 'hoy'
    if (dias === 1) return 'ayer'
    return `hace ${dias} días`
}

const ENERGIA_EMOJI: Record<number, string> = { 1: '😴', 2: '😑', 3: '😐', 4: '🙂', 5: '⚡' }
const ADHERENCIA_COLOR: Record<number, string> = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#16a34a' }

export default function CheckinsPendientes() {
    const [checkins, setCheckins] = useState<CheckinRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/checkins/pendientes')
            .then(r => r.json())
            .then(({ checkins }) => setCheckins(checkins ?? []))
            .catch(() => setCheckins([]))
            .finally(() => setLoading(false))
    }, [])

    const visibles = checkins.slice(0, 5)
    const resto = checkins.length - visibles.length

    return (
        <div className="card-glass mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ClipboardText size={16} weight="fill" style={{ color: 'var(--accent)' }} />
                    <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Check-ins sin responder</h2>
                    {!loading && checkins.length > 0 && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                            {checkins.length}
                        </span>
                    )}
                </div>
                <Link href="/clientes" className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Ver clientes <ArrowRight size={11} className="inline" />
                </Link>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 w-full rounded-xl" />)}
                </div>
            ) : checkins.length === 0 ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                    <CheckCircle size={18} weight="fill" style={{ color: '#22c55e' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Todo al día esta semana</span>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {visibles.map(c => (
                        <Link
                            key={c.id}
                            href={`/clientes/${c.cliente_id}`}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                            style={{ background: 'var(--surface-hover)' }}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                                    {c.cliente_nombre[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{c.cliente_nombre}</p>
                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {tiempoRelativo(c.fecha)}
                                        {c.peso ? ` · ${c.peso} kg` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {c.energia && (
                                    <span className="text-sm" title="Energía">{ENERGIA_EMOJI[c.energia] ?? '–'}</span>
                                )}
                                {c.adherencia && (
                                    <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white"
                                        style={{ background: ADHERENCIA_COLOR[c.adherencia] ?? '#9ca3af', fontSize: 10 }}>
                                        {c.adherencia}
                                    </span>
                                )}
                                <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </Link>
                    ))}
                    {resto > 0 && (
                        <Link href="/clientes" className="block text-center text-xs py-1.5 rounded-xl"
                            style={{ color: 'var(--text-muted)', background: 'var(--surface-hover)' }}>
                            Ver {resto} más
                        </Link>
                    )}
                </div>
            )}
        </div>
    )
}
