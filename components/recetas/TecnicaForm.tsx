'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FAMILIAS_TECNICA } from '@/lib/recetas-constants'
import { ESTADOS_TECNICA, FORMULARIO_TECNICA_VACIO, NIVELES_TECNICA, tecnicaDeFormulario, type FormTecnica } from '@/lib/tecnicas'

const mono = { fontFamily: 'var(--font-mono, monospace)' } as const
const campo = 'w-full px-3 py-2 text-base outline-none'
const estilo = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' } as const

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.14em] mb-1" style={{ ...mono, color: 'var(--text-muted)' }}>{etiqueta}</span>
      {children}
    </label>
  )
}

const ETIQUETA_ESTADO: Record<string, string> = { en_revision: 'En revisión', aprobada: 'Aprobada', descartada: 'Descartada' }

/** Alta y edición de una técnica. Con `id` actualiza; sin `id` crea. */
export default function TecnicaForm({ id, inicial }: { id?: string; inicial?: FormTecnica }) {
  const router = useRouter()
  const [f, setF] = useState<FormTecnica>(inicial ?? FORMULARIO_TECNICA_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof FormTecnica) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(prev => ({ ...prev, [k]: e.target.value }))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const v = tecnicaDeFormulario(f)
    if (!v.ok) { setError(v.motivo); return }
    setGuardando(true); setError(null)
    try {
      const res = await fetch(id ? `/api/tecnicas/${id}` : '/api/tecnicas', { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v.tecnica) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      router.push(`/recetas/tecnicas/${id ?? data.id}`)
    } catch { setError('No se pudo guardar') } finally { setGuardando(false) }
  }

  const texto = (k: keyof FormTecnica, etiqueta: string, filas = 3) => (
    <Campo etiqueta={etiqueta}><textarea className={campo} style={estilo} rows={filas} value={f[k]} onChange={set(k)} /></Campo>
  )

  return (
    <form onSubmit={guardar} className="mx-auto max-w-2xl space-y-5 p-4 pb-24">
      <h1 className="text-2xl font-light" style={{ color: 'var(--text)' }}>{id ? 'Editar técnica' : 'Nueva técnica'}</h1>
      <Campo etiqueta="Nombre"><input className={campo} style={estilo} value={f.nombre} onChange={set('nombre')} required /></Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Familia">
          <select className={campo} style={estilo} value={f.familia} onChange={set('familia')}>
            <option value="">Sin familia</option>
            {FAMILIAS_TECNICA.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Estado">
          <select className={campo} style={estilo} value={f.estado} onChange={set('estado')}>
            {ESTADOS_TECNICA.map(x => <option key={x} value={x}>{ETIQUETA_ESTADO[x]}</option>)}
          </select>
        </Campo>
      </div>
      {texto('descripcion', 'Qué es', 2)}
      {texto('principio', 'Principio (por qué funciona)')}
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Temperatura (°C)"><input className={campo} style={estilo} inputMode="decimal" value={f.temperatura_c} onChange={set('temperatura_c')} /></Campo>
        <Campo etiqueta="Nivel">
          <select className={campo} style={estilo} value={f.nivel} onChange={set('nivel')}>
            <option value="">—</option>
            {NIVELES_TECNICA.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Tiempo activo (min)"><input className={campo} style={estilo} inputMode="decimal" value={f.tiempo_activo_min} onChange={set('tiempo_activo_min')} /></Campo>
        <Campo etiqueta="Tiempo total (min)"><input className={campo} style={estilo} inputMode="decimal" value={f.tiempo_total_min} onChange={set('tiempo_total_min')} /></Campo>
      </div>
      <Campo etiqueta="Proporciones"><input className={campo} style={estilo} value={f.proporciones} onChange={set('proporciones')} /></Campo>
      <Campo etiqueta="Equipo"><input className={campo} style={estilo} value={f.equipo} onChange={set('equipo')} /></Campo>
      {texto('pasos', 'Paso a paso', 8)}
      {texto('errores_tipicos', 'Errores típicos')}
      {texto('variantes', 'Variantes')}
      {texto('seguridad', 'Seguridad', 2)}
      <Campo etiqueta="Origen"><input className={campo} style={estilo} value={f.origen} onChange={set('origen')} /></Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Fuente (URL)"><input className={campo} style={estilo} value={f.url_origen} onChange={set('url_origen')} /></Campo>
        <Campo etiqueta="Autor"><input className={campo} style={estilo} value={f.autor_original} onChange={set('autor_original')} /></Campo>
      </div>
      <Campo etiqueta="Etiquetas (separadas por comas)"><input className={campo} style={estilo} value={f.tags} onChange={set('tags')} /></Campo>
      {error && <p className="text-sm" style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={guardando} className="px-4 py-2 text-sm font-medium" style={{ background: 'var(--accent)', color: 'var(--accent-contrast, #000)' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm" style={{ ...estilo, color: 'var(--text-secondary)' }}>Cancelar</button>
      </div>
    </form>
  )
}
