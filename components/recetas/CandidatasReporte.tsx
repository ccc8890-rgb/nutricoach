'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from '@/components/icons/lucide'
import EnlaceReceta from '@/components/recetas/EnlaceReceta'
import ReportarProblema from '@/components/recetas/ReportarProblema'
import { etiquetaCalidad } from '@/lib/recetas/etiquetas-calidad'

type Candidata = { id: string; nombre: string; motivos: string[] }

/** Sugerencias del control de calidad sobre recetas ya aprobadas. Nada se envía sin que el coach lo marque. */
export default function CandidatasReporte({ onReportadas }: { onReportadas: () => void }) {
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null)
  const [error, setError] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto || candidatas) return
    fetch('/api/recetas/candidatas', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => setCandidatas(j.data ?? []))
      .catch(() => setError('No se pudieron cargar las sugerencias'))
  }, [abierto, candidatas])

  const [dialogo, setDialogo] = useState(false)
  return (
    <section className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <button onClick={() => setAbierto(v => !v)} className="flex w-full items-center justify-between text-sm font-semibold" style={{ color: 'var(--text)' }}>
        Candidatas sugeridas por el control de calidad <ChevronDown size={16} />
      </button>
      {abierto && (
        <div className="mt-3 space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Recetas ya aprobadas con bloqueos o puntuación baja. No se reporta nada hasta que las marques.</p>
          {error && <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>}
          {candidatas === null && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cargando…</p>}
          {candidatas?.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No hay candidatas ahora mismo.</p>}
          {candidatas?.map(c => (
            <label key={c.id} className="flex items-start gap-3 rounded-lg p-2 text-sm" style={{ background: 'var(--bg)' }}>
              <input type="checkbox" className="mt-1" checked={sel.has(c.id)} onChange={() => setSel(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} />
              <span className="min-w-0 flex-1">
                <EnlaceReceta id={c.id} className="font-medium hover:underline" style={{ color: 'var(--text)' }}>{c.nombre}</EnlaceReceta>
                <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{c.motivos.length ? c.motivos.map(m => etiquetaCalidad(m).corto).join(' · ') : 'Puntuación baja'}</span>
              </span>
            </label>
          ))}
          {sel.size > 0 && (
            <button onClick={() => setDialogo(true)} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Reportar {sel.size} seleccionada{sel.size !== 1 ? 's' : ''}</button>
          )}
        </div>
      )}
      <ReportarProblema ids={[...sel]} abierto={dialogo} onCerrar={() => setDialogo(false)}
        onHecho={r => { setDialogo(false); setSel(new Set()); setCandidatas(prev => prev ? prev.filter(c => !r.reportadas.includes(c.id)) : prev); onReportadas() }} />
    </section>
  )
}
