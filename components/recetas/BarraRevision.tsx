'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { esRecetaAprobable, type QualityIssues } from '@/lib/recetas/revision'

type Item = { id: string; estado: string | null; quality_issues: QualityIssues | null }

/**
 * Revisión continua: al venir de la bandeja, aprobar o descartar lleva directo a la siguiente pendiente
 * (primero las que no tienen bloqueos, igual que la bandeja). Atajos: A aprobar · D descartar · ← → anterior/siguiente.
 */
export default function BarraRevision({ id, pendiente, returnTo, accion }: {
  id: string
  pendiente: boolean
  returnTo: string
  accion: (estado: 'aprobada' | 'descartada') => Promise<boolean>
}) {
  const [cola, setCola] = useState<string[] | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/recetas/revisar?tarea=pendientes&page=1&pageSize=100', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (!vivo) return
        const data: Item[] = j.data ?? []
        const listas = data.filter(r => esRecetaAprobable(r.estado, r.quality_issues))
        const resto = data.filter(r => !esRecetaAprobable(r.estado, r.quality_issues))
        setCola([...listas, ...resto].map(r => r.id))
      })
      .catch(() => { if (vivo) setCola([]) })
    return () => { vivo = false }
  }, [id])

  const pos = cola ? cola.indexOf(id) : -1
  const siguiente = cola ? (pos >= 0 ? cola[pos + 1] : cola[0]) : undefined
  const anterior = pos > 0 && cola ? cola[pos - 1] : undefined

  const ir = useCallback((destino?: string) => {
    window.location.href = destino ? `/recetas/${destino}?returnTo=${encodeURIComponent(returnTo)}` : returnTo
  }, [returnTo])

  const resolver = useCallback(async (estado: 'aprobada' | 'descartada') => {
    if (ocupado) return
    setOcupado(true)
    const ok = await accion(estado)
    if (ok) ir(siguiente)
    else setOcupado(false)
  }, [ocupado, accion, ir, siguiente])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (k === 'a' && pendiente) resolver('aprobada')
      else if (k === 'd' && pendiente && window.confirm('¿Descartar esta receta?')) resolver('descartada')
      else if (e.key === 'ArrowRight' && siguiente) ir(siguiente)
      else if (e.key === 'ArrowLeft' && anterior) ir(anterior)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [pendiente, resolver, siguiente, anterior, ir])

  const total = cola?.length ?? 0
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(12px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.6rem)' }}>
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <button disabled={!anterior} onClick={() => ir(anterior)} aria-label="Anterior" className="rounded-lg border p-2 disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}><ChevronLeft size={16} /></button>
        <div className="min-w-0 flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {cola === null ? 'Cargando cola…' : pos >= 0 ? <><strong style={{ color: 'var(--text)' }}>{pos + 1} de {total}</strong> pendientes</> : total > 0 ? <>Quedan <strong style={{ color: 'var(--text)' }}>{total}</strong> pendientes</> : 'Sin más pendientes'}
          <span className="hidden sm:inline"> · A aprobar · D descartar · ← →</span>
        </div>
        {pendiente && <>
          <button disabled={ocupado} onClick={() => { if (window.confirm('¿Descartar esta receta?')) resolver('descartada') }} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}><Trash2 size={13} />Descartar</button>
          <button disabled={ocupado} onClick={() => resolver('aprobada')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: 'var(--success)', color: '#fff' }}>{ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Aprobar{siguiente ? ' y siguiente' : ''}</button>
        </>}
        <button disabled={!siguiente} onClick={() => ir(siguiente)} aria-label="Siguiente" className="rounded-lg border p-2 disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}><ChevronRight size={16} /></button>
      </div>
    </div>
  )
}
