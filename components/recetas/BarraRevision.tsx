'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, Trash2, Wrench } from 'lucide-react'
import { esRecetaAprobable, type QualityIssues } from '@/lib/recetas/revision'
import { ASPECTOS_CORRECCION } from '@/lib/recetas/correcciones'

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
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [aspectos, setAspectos] = useState<string[]>([])
  const [nota, setNota] = useState('')
  const [errorMarca, setErrorMarca] = useState<string | null>(null)

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

  const marcar = useCallback(async () => {
    if (ocupado) return
    setOcupado(true); setErrorMarca(null)
    const res = await fetch(`/api/recetas/${id}/correccion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aspectos, nota }) })
    if (res.ok) { try { const k = 'nc:revision-resueltas'; const a: string[] = JSON.parse(sessionStorage.getItem(k) || '[]'); sessionStorage.setItem(k, JSON.stringify([...new Set([...a, id])])) } catch { /* sin almacenamiento */ } ir(siguiente) }
    else { setErrorMarca((await res.json().catch(() => ({}))).error || 'No se pudo marcar'); setOcupado(false) }
  }, [ocupado, id, aspectos, nota, ir, siguiente])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (corrigiendo) { if (e.key === 'Escape') setCorrigiendo(false); return }
      if (k === 'c' && pendiente) setCorrigiendo(true)
      else if (k === 'a' && pendiente) resolver('aprobada')
      else if (k === 'd' && pendiente && window.confirm('¿Descartar esta receta?')) resolver('descartada')
      else if (e.key === 'ArrowRight' && siguiente) ir(siguiente)
      else if (e.key === 'ArrowLeft' && anterior) ir(anterior)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [pendiente, resolver, siguiente, anterior, ir, corrigiendo])

  const total = cola?.length ?? 0
  return (
    <div className="coach-review-bar fixed inset-x-0 bottom-0 z-40 border-t px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(12px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.6rem)' }}>
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <button disabled={!anterior} onClick={() => ir(anterior)} aria-label="Anterior" className="rounded-lg border p-2 disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}><ChevronLeft size={16} /></button>
        <div className="min-w-0 flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {cola === null ? 'Cargando cola…' : pos >= 0 ? <><strong style={{ color: 'var(--text)' }}>{pos + 1} de {total}</strong> pendientes</> : total > 0 ? <>Quedan <strong style={{ color: 'var(--text)' }}>{total}</strong> pendientes</> : 'Sin más pendientes'}
          <span className="hidden sm:inline"> · A aprobar · C corregir · D descartar · ← →</span>
        </div>
        {pendiente && <>
          <button disabled={ocupado} onClick={() => setCorrigiendo(true)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}><Wrench size={13} />Corregir</button>
          <button disabled={ocupado} onClick={() => { if (window.confirm('¿Descartar esta receta?')) resolver('descartada') }} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:opacity-40" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}><Trash2 size={13} />Descartar</button>
          <button disabled={ocupado} onClick={() => resolver('aprobada')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: 'var(--success)', color: '#fff' }}>{ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Aprobar{siguiente ? ' y siguiente' : ''}</button>
        </>}
        <button disabled={!siguiente} onClick={() => ir(siguiente)} aria-label="Siguiente" className="rounded-lg border p-2 disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}><ChevronRight size={16} /></button>
      </div>
      {corrigiendo && (
        <div className="mx-auto mt-2.5 max-w-3xl rounded-xl border p-3" style={{ borderColor: 'var(--warning)', background: 'var(--surface)' }}>
          <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text)' }}>¿Qué hay que corregir? <span style={{ color: 'var(--text-muted)' }}>(la IA le dará una pasada y volverá a revisión)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {ASPECTOS_CORRECCION.map(a => {
              const on = aspectos.includes(a.id)
              return <button key={a.id} onClick={() => setAspectos(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])} className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: on ? 'var(--warning)' : 'var(--border)', color: on ? 'var(--warning)' : 'var(--text-secondary)', background: on ? 'color-mix(in srgb, var(--warning) 12%, transparent)' : 'transparent' }}>{a.label}</button>
            })}
          </div>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} maxLength={600} placeholder="Detalle (opcional): «la salsa de soja son 15 g, no 45», «el título no encaja»…" className="mt-2 w-full rounded-lg border px-2.5 py-2 text-xs outline-none" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
          {errorMarca && <p className="mt-1 text-xs" style={{ color: 'var(--error)' }}>{errorMarca}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setCorrigiendo(false)} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button disabled={ocupado || (aspectos.length === 0 && !nota.trim())} onClick={marcar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40" style={{ background: 'var(--warning)', color: '#000' }}>{ocupado ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}Marcar y pasar a la siguiente</button>
          </div>
        </div>
      )}
    </div>
  )
}
