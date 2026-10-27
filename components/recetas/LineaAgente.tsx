'use client'

import type { Hallazgo } from '@/lib/recetas/revisor/esquema'

export type AgenteInfo = {
  veredicto: string | null
  confianza: number | null
  resumen: string | null
  hallazgos?: unknown
  aplicadas?: unknown
  created_at?: string
}

const VEREDICTO: Record<string, { texto: string; color: string }> = {
  lista: { texto: 'Lista', color: 'var(--success)' },
  revisar: { texto: 'Revisar', color: 'var(--warning)' },
  corregir: { texto: 'Corregir', color: 'var(--error)' },
}
const GRAVEDAD: Record<string, string> = { alta: 'var(--error)', media: 'var(--warning)', baja: 'var(--text-muted)' }
const NOMBRE_CAMPO: Record<string, string> = { tipo_contenido: 'tipo', familia: 'familia', categoria: 'categoría', tipo_receta: 'uso en dietas' }

/** Lo que dijo el agente de una ficha: veredicto, confianza, resumen, hallazgos desplegables y lo que aplicó solo. */
export default function LineaAgente({ agente }: { agente: AgenteInfo | null | undefined }) {
  if (!agente) return null
  const v = VEREDICTO[agente.veredicto ?? ''] ?? { texto: agente.veredicto ?? '—', color: 'var(--text-muted)' }
  const hallazgos = (Array.isArray(agente.hallazgos) ? agente.hallazgos : []) as Hallazgo[]
  const aplicadas = Object.entries((agente.aplicadas ?? {}) as Record<string, unknown>).filter(([k]) => NOMBRE_CAMPO[k])
  return (
    <div className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
      <p>
        <span className="uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>Agente</span>{' '}
        <b style={{ color: v.color }}>{v.texto}</b>
        {agente.confianza != null && <span style={{ color: 'var(--text-muted)' }}> · {Math.round(agente.confianza * 100)} %</span>}
        {agente.resumen ? <span> · {agente.resumen}</span> : null}
      </p>
      {aplicadas.length > 0 && (
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          Aplicó: {aplicadas.map(([k, val]) => `${NOMBRE_CAMPO[k]} → ${String(val)}`).join(' · ')}
        </p>
      )}
      {hallazgos.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer underline decoration-dotted underline-offset-4" style={{ color: 'var(--text-muted)' }}>{hallazgos.length} {hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'}</summary>
          <ul className="mt-1.5 space-y-1.5">
            {hallazgos.map((h, i) => (
              <li key={i}>
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: GRAVEDAD[h.gravedad] ?? 'var(--text-muted)' }} />
                <b>{h.campo}</b>: {h.descripcion}{h.sugerencia ? <span style={{ color: 'var(--text-muted)' }}> → {h.sugerencia}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
