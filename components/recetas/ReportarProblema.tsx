'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { ASPECTOS_CORRECCION } from '@/lib/recetas/correcciones'
import { ORIGENES_REPORTE, type OrigenReporte } from '@/lib/recetas/reportes'

type Resultado = { reportadas: string[]; omitidas: { id: string; motivo: string }[] }

/**
 * Diálogo para reportar una o varias recetas: qué falla, nota y origen. Las recetas salen del recetario
 * (pasan a Revisión → Reportadas) hasta que se arreglen y se vuelvan a aprobar.
 */
export default function ReportarProblema({ ids, abierto, onCerrar, onHecho }: {
  ids: string[]
  abierto: boolean
  onCerrar: () => void
  onHecho: (r: Resultado) => void
}) {
  const [aspectos, setAspectos] = useState<string[]>([])
  const [nota, setNota] = useState('')
  const [origen, setOrigen] = useState<OrigenReporte>('propio')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enPlanes, setEnPlanes] = useState<number | null>(null)

  useEffect(() => {
    if (!abierto || ids.length === 0) return
    setAspectos([]); setNota(''); setOrigen('propio'); setError(''); setEnPlanes(null)
    let vivo = true
    fetch('/api/recetas/uso-en-planes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      .then(r => r.ok ? r.json() : null)
      .then((j: Record<string, number> | null) => { if (vivo && j) setEnPlanes(Object.values(j).filter(n => n > 0).length) })
      .catch(() => null)
    return () => { vivo = false }
  }, [abierto, ids])

  if (!abierto) return null

  async function enviar() {
    setEnviando(true); setError('')
    try {
      const res = await fetch('/api/recetas/reportar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, aspectos, nota, origen }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'No se pudo reportar'); return }
      onHecho(j as Resultado)
    } catch {
      setError('No se pudo reportar. Revisa la conexión.')
    } finally {
      setEnviando(false)
    }
  }

  const uno = ids.length === 1
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onCerrar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{uno ? 'Reportar problema' : `Reportar ${ids.length} recetas`}</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Salen del recetario y pasan a Revisión → Reportadas hasta que se arreglen y se vuelvan a aprobar.
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>¿Qué falla?</p>
          <div className="flex flex-wrap gap-2">
            {ASPECTOS_CORRECCION.map(a => {
              const activo = aspectos.includes(a.id)
              return (
                <button key={a.id} type="button" onClick={() => setAspectos(prev => activo ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border"
                  style={{ borderColor: activo ? 'var(--accent)' : 'var(--border)', background: activo ? 'var(--accent-bg)' : 'transparent', color: activo ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>

        <textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={600} rows={3} placeholder="Nota (opcional si has marcado algo)"
          className="w-full rounded-xl p-3 text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />

        <div className="flex flex-wrap gap-4">
          {ORIGENES_REPORTE.map(o => (
            <label key={o.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="radio" name="origen-reporte" checked={origen === o.id} onChange={() => setOrigen(o.id)} /> {o.label}
            </label>
          ))}
        </div>

        {enPlanes !== null && enPlanes > 0 && (
          <p className="text-xs rounded-lg p-2" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            {uno ? 'Esta receta está en planes activos' : `${enPlanes} de estas recetas están en planes activos`}: los planes no se tocan solos.
          </p>
        )}
        {error && <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>}

        <button onClick={enviar} disabled={enviando || (aspectos.length === 0 && !nota.trim())}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          {enviando && <Loader2 size={14} className="animate-spin" />} Sacar del recetario y reportar
        </button>
      </div>
    </div>
  )
}
