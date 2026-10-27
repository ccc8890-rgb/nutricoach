'use client'

import { useState } from 'react'
import { BookmarkPlus, Loader2 } from '@/components/icons/lucide'

/** Guarda el plan de un cliente (estructura semanal, ejercicios y pasos de Garmin) como plantilla reutilizable. */
export default function GuardarPlanComoPlantilla({ planId, nombreInicial }: { planId: string; nombreInicial: string }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(nombreInicial)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true); setMensaje(null)
    try {
      const res = await fetch(`/api/entrenos/planes/${planId}/guardar-plantilla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar')
      setMensaje({ ok: true, texto: `Guardada con ${json.sesiones} sesiones. La encuentras en Planes → Plantillas de entreno, lista para asignar a otro cliente.` })
      setAbierto(false)
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo guardar' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {!abierto ? (
        <button className="btn-secondary btn-sm" onClick={() => { setAbierto(true); setMensaje(null) }}><BookmarkPlus size={13} /> Guardar como plantilla</button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') guardar() }}
            maxLength={80}
            placeholder="Nombre de la plantilla"
            className="text-sm px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          <div className="flex gap-1.5">
            <button className="btn-primary btn-sm" onClick={guardar} disabled={guardando || !nombre.trim()}>
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <BookmarkPlus size={13} />} Guardar
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {mensaje && <p className="text-xs max-w-[240px]" role="status" style={{ color: mensaje.ok ? 'var(--text-muted)' : 'var(--semantic-alert-text)' }}>{mensaje.texto}</p>}
    </div>
  )
}
