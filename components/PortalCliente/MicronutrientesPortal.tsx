'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { NutrienteGap, TotalesMicronutrientes } from '@/lib/micronutrientes/gap-report'

interface MicronutrientesPortalProps {
    codigo: string
}

interface MicronutrientesResponse {
    totales: TotalesMicronutrientes
    nutrientes: NutrienteGap[]
    prioritarios: NutrienteGap[]
    resumen: {
        ok: number
        revisar: number
        score: number
    }
}

function formatValor(valor: number, unidad: string): string {
    const redondeado = valor >= 100 ? Math.round(valor) : Math.round(valor * 10) / 10
    return `${redondeado}${unidad}`
}

export default function MicronutrientesPortal({ codigo }: MicronutrientesPortalProps) {
    const [data, setData] = useState<MicronutrientesResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        fetch(`/api/cliente/${codigo}/micronutrientes`)
            .then(r => r.json())
            .then((res: MicronutrientesResponse) => setData(res))
            .catch(() => setError(true))
            .finally(() => setLoading(false))
    }, [codigo])

    if (loading) return (
        <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin" style={{ color: '#0D9488' }} />
        </div>
    )

    if (error || !data) return (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No se pudo cargar el informe de micronutrientes.
        </p>
    )

    const visibles = data.prioritarios.length
        ? data.prioritarios
        : data.nutrientes.filter(n => n.estado === 'ok').slice(0, 4)

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Cobertura nutricional
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {data.resumen.ok}/{data.nutrientes.length} objetivos en rango
                    </p>
                </div>
                <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center" style={{ background: 'var(--primary-bg)' }}>
                    <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{data.resumen.score}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>%</span>
                </div>
            </div>

            <div className="space-y-2">
                {visibles.map(nutriente => {
                    const esOk = nutriente.estado === 'ok'
                    const color = esOk ? '#0D9488' : nutriente.estado === 'alto' ? 'var(--error)' : 'var(--warning)'
                    return (
                        <div key={nutriente.key} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    {esOk ? <CheckCircle2 size={15} style={{ color }} /> : <AlertTriangle size={15} style={{ color }} />}
                                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                                        {nutriente.label}
                                    </span>
                                </div>
                                <span className="text-xs font-semibold" style={{ color }}>
                                    {formatValor(nutriente.valor, nutriente.unidad)} / {formatValor(nutriente.objetivo, nutriente.unidad)}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.min(100, nutriente.pct)}%`, background: color }}
                                />
                            </div>
                            {!esOk && (
                                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                                    {nutriente.sugerencia}
                                </p>
                            )}
                        </div>
                    )
                })}
            </div>

            {!data.prioritarios.length && (
                <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Activity size={13} />
                    No hay brechas principales en los objetivos monitorizados.
                </p>
            )}
        </div>
    )
}
