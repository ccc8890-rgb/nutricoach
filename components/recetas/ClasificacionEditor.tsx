'use client'
import { useState } from 'react'
import { NIVELES_FIT, TIPOS_USO, CONTEXTOS_USO, APTAS_CLIENTE } from '@/lib/recetas/profesional'

export interface Clasificacion {
  nivel_fit: string
  tipo_uso: string
  contexto_uso: string
  apta_cliente: string
  alcohol_culinario: boolean
}

const CAMPOS: { clave: keyof Omit<Clasificacion, 'alcohol_culinario'>; etiqueta: string; opciones: readonly string[] }[] = [
  { clave: 'nivel_fit', etiqueta: 'Nivel fit', opciones: NIVELES_FIT },
  { clave: 'tipo_uso', etiqueta: 'Tipo de uso', opciones: TIPOS_USO },
  { clave: 'contexto_uso', etiqueta: 'Contexto', opciones: CONTEXTOS_USO },
  { clave: 'apta_cliente', etiqueta: 'Apta para', opciones: APTAS_CLIENTE },
]

const bonito = (v: string) => v.replace(/_/g, ' ')

// Chips de la clasificación profesional + edición manual. Lo editado no lo pisa la auditoría automática.
export default function ClasificacionEditor({ recetaId, clasificacion, manual, onGuardado }: {
  recetaId: string
  clasificacion: Clasificacion
  manual: boolean
  onGuardado: (c: Clasificacion, manual: boolean) => void
}) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<Clasificacion>(clasificacion)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(cuerpo: Record<string, unknown>) {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`/api/recetas/${recetaId}/clasificacion`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar')
      onGuardado(json.clasificacion, Boolean(json.manual))
      setEditando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const chip = { background: 'var(--bg)', color: 'var(--text-secondary)' }

  return (
    <div>
      <div className="flex items-start gap-4">
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4">
          {CAMPOS.map(c => (
            <div key={c.clave} className="min-w-0">
              <dt className="coach-recipe-kicker">{c.etiqueta}</dt>
              <dd className="mt-1.5 text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>{bonito(clasificacion[c.clave])}</dd>
            </div>
          ))}
        </dl>
        <button type="button" onClick={() => { setBorrador(clasificacion); setEditando(v => !v) }} className="shrink-0 rounded border px-2.5 py-1 text-xs font-medium" style={{ borderColor: 'var(--recipe-rule)', color: 'var(--text-secondary)' }}>
          {editando ? 'Cancelar' : 'Editar'}
        </button>
      </div>
      {(clasificacion.alcohol_culinario || manual) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {clasificacion.alcohol_culinario && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ ...chip, color: 'var(--warning)' }}>alcohol culinario</span>}
          {manual && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>editada a mano</span>}
        </div>
      )}

      {editando && (
        <div className="mt-3 p-3 rounded-xl space-y-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            {CAMPOS.map(c => (
              <label key={c.clave} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {c.etiqueta}
                <select
                  value={borrador[c.clave]}
                  onChange={e => setBorrador(b => ({ ...b, [c.clave]: e.target.value }))}
                  className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {c.opciones.map(o => <option key={o} value={o}>{bonito(o)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={borrador.alcohol_culinario} onChange={e => setBorrador(b => ({ ...b, alcohol_culinario: e.target.checked }))} />
            Lleva alcohol culinario
          </label>
          {error && <p className="text-xs" style={{ color: 'var(--danger, #FF6B6B)' }}>{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={guardando} onClick={() => enviar({ ...borrador })} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--bg)', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            {manual && (
              <button type="button" disabled={guardando} onClick={() => enviar({ auto: true })} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                Volver a automática
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
