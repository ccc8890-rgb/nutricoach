'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

interface Estado { etiqueta: string; hayPropuestaPendiente: boolean }

export default function PlanificarConIA({ clienteId }: { clienteId: string }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const leer = useCallback(() => {
    fetch(`/api/entrenos/planificar-ia?cliente_id=${clienteId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setEstado(d ? { etiqueta: d.etiqueta, hayPropuestaPendiente: d.hayPropuestaPendiente } : null))
      .catch(() => setEstado(null))
  }, [clienteId])

  useEffect(() => { leer() }, [leer])

  async function planificar() {
    setCargando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/entrenos/planificar-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente_id: clienteId }) })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setMensaje({ tipo: 'error', texto: d?.error ?? 'No se pudo planificar.' }); return }
      setMensaje({ tipo: 'ok', texto: `${d.resumen} — está en «Decisiones de IA pendientes».` })
      window.dispatchEvent(new CustomEvent('decisiones-ia:recargar'))
      leer()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo planificar. Inténtalo de nuevo.' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button className="btn-primary btn-sm" onClick={planificar} disabled={cargando || estado?.hayPropuestaPendiente}>
        {cargando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Planificar con IA
      </button>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {estado?.hayPropuestaPendiente ? 'Hay una propuesta pendiente de aprobar abajo.' : estado?.etiqueta ?? ''}
      </span>
      {mensaje && <span className="text-xs" role="status" style={{ color: mensaje.tipo === 'error' ? 'var(--semantic-danger-text, var(--text))' : 'var(--text)' }}>{mensaje.texto}</span>}
    </div>
  )
}
