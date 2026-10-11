'use client'

import { useEffect, useState } from 'react'
import { BookmarkPlus, Loader2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CATEGORIAS_SESION, type CategoriaSesion } from '@/lib/entrenos/biblioteca-categorias'

export interface EjercicioEditable {
  id: string
  nombre: string
  series: number | null
  repeticiones: string | null
  descanso_segundos: number | null
  peso_sugerido: string | null
  rpe: string | null
}

const CATEGORIAS_GUARDABLES = CATEGORIAS_SESION.filter(c => c !== 'Otros')

const campo = 'text-sm px-2 py-1 rounded-lg w-full'
const estiloCampo = { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' } as const

/**
 * Editor de una sesión desde el calendario: nombre, duración y ejercicios (series, repeticiones, carga, RPE, descanso),
 * añadir/quitar ejercicios, hacer la sesión solo de este día y guardarla como sesión base.
 */
export default function EditorSesionCalendario({ sesionId, fecha, nombre, duracionMin, ejercicios, compartida, conPasos, onCambio, onIndependizada }: {
  sesionId: string
  fecha: string
  nombre: string
  duracionMin: number | null
  ejercicios: EjercicioEditable[]
  compartida: boolean
  conPasos: boolean
  onCambio: () => Promise<void>
  onIndependizada: (nuevaSesionId: string) => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nombre: string; grupo_muscular: string | null }[]>([])
  const [categoria, setCategoria] = useState<CategoriaSesion>(conPasos ? 'Running' : 'Fuerza')
  const [guardadaEn, setGuardadaEn] = useState<string | null>(null)

  useEffect(() => {
    const q = busqueda.trim()
    if (q.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('ejercicios').select('id, nombre, grupo_muscular').ilike('nombre', `%${q}%`).limit(8)
      setResultados((data ?? []) as { id: string; nombre: string; grupo_muscular: string | null }[])
    }, 250)
    return () => clearTimeout(t)
  }, [busqueda])

  async function llamar(url: string, metodo: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<Record<string, unknown> | null> {
    setOcupado(true); setError(null)
    try {
      const res = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'error')
      return json
    } catch (e) {
      setError(e instanceof Error && e.message !== 'error' ? e.message : 'No se pudo guardar el cambio')
      return null
    } finally {
      setOcupado(false)
    }
  }

  const base = `/api/entrenos/calendario-sesion/${sesionId}`

  async function guardarDatos(cambios: { nombre?: string; duracion_estimada_min?: number | null }) {
    if (await llamar(base, 'PATCH', cambios)) await onCambio()
  }

  async function guardarEjercicio(filaId: string, cambios: Record<string, unknown>) {
    if (await llamar(`${base}/ejercicios`, 'PATCH', { fila_id: filaId, ...cambios })) await onCambio()
  }

  async function quitarEjercicio(filaId: string) {
    if (await llamar(`${base}/ejercicios`, 'DELETE', { fila_id: filaId })) await onCambio()
  }

  async function anadirEjercicio(ejercicioId: string) {
    if (await llamar(`${base}/ejercicios`, 'POST', { ejercicio_id: ejercicioId })) {
      setBusqueda(''); setResultados([])
      await onCambio()
    }
  }

  async function independizar() {
    const r = await llamar(base, 'POST', { accion: 'independizar', fecha })
    if (r && typeof r.sesion_id === 'string') { await onCambio(); onIndependizada(r.sesion_id) }
  }

  async function guardarComoBase() {
    const r = await llamar(base, 'POST', { accion: 'guardar_base', categoria })
    if (r) setGuardadaEn(String(r.plantilla ?? 'tus sesiones base'))
  }

  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  return (
    <div className="mb-4 rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      {compartida && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--semantic-warn-bg)' }}>
          <p className="text-xs" style={{ color: 'var(--semantic-warn-text)' }}>Esta sesión se repite en otras fechas: lo que cambies aquí afectará a todas.</p>
          <button onClick={independizar} disabled={ocupado} className="btn-secondary btn-sm">Editar solo este día</button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2 mb-3">
        <input defaultValue={nombre} maxLength={80} className={campo} style={estiloCampo} aria-label="Nombre de la sesión"
          onBlur={e => { const v = e.target.value.trim(); if (v && v !== nombre) guardarDatos({ nombre: v }) }} />
        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <input type="number" min={5} max={480} defaultValue={duracionMin ?? ''} className="text-sm px-2 py-1 rounded-lg w-16" style={estiloCampo} aria-label="Duración en minutos"
            onBlur={e => { const v = num(e.target.value); if (v !== duracionMin && (v === null || (v >= 5 && v <= 480))) guardarDatos({ duracion_estimada_min: v }) }} /> min
        </label>
      </div>

      {conPasos && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Los pasos de Garmin (ritmos y series) no se editan aquí; los ejercicios de abajo son la descripción de la sesión.</p>}

      {ejercicios.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="hidden sm:grid grid-cols-[1fr_56px_72px_72px_56px_64px_28px] gap-2 text-[11px] uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
            <span>Ejercicio</span><span>Series</span><span>Reps</span><span>Carga</span><span>RPE</span><span>Desc. (s)</span><span />
          </div>
          {ejercicios.map(e => (
            <div key={`${e.id}-${e.series}-${e.repeticiones}-${e.peso_sugerido}-${e.rpe}-${e.descanso_segundos}`} className="grid grid-cols-[1fr_56px_72px_72px_56px_64px_28px] gap-2 items-center">
              <span className="text-sm truncate" style={{ color: 'var(--text)' }} title={e.nombre}>{e.nombre}</span>
              <input type="number" min={1} max={20} defaultValue={e.series ?? ''} className={campo} style={estiloCampo} aria-label="Series"
                onBlur={ev => { const v = num(ev.target.value); if (v && v !== e.series) guardarEjercicio(e.id, { series: v }) }} />
              <input defaultValue={e.repeticiones ?? ''} maxLength={20} className={campo} style={estiloCampo} aria-label="Repeticiones"
                onBlur={ev => { const v = ev.target.value.trim(); if (v && v !== e.repeticiones) guardarEjercicio(e.id, { repeticiones: v }) }} />
              <input defaultValue={e.peso_sugerido ?? ''} maxLength={30} className={campo} style={estiloCampo} aria-label="Carga"
                onBlur={ev => { const v = ev.target.value.trim() || null; if (v !== (e.peso_sugerido ?? null)) guardarEjercicio(e.id, { peso_sugerido: v }) }} />
              <input defaultValue={e.rpe ?? ''} maxLength={20} className={campo} style={estiloCampo} aria-label="RPE"
                onBlur={ev => { const v = ev.target.value.trim() || null; if (v !== (e.rpe ?? null)) guardarEjercicio(e.id, { rpe: v }) }} />
              <input type="number" min={0} max={900} defaultValue={e.descanso_segundos ?? ''} className={campo} style={estiloCampo} aria-label="Descanso en segundos"
                onBlur={ev => { const v = num(ev.target.value); if (v !== e.descanso_segundos && (v === null || (v >= 0 && v <= 900))) guardarEjercicio(e.id, { descanso_segundos: v }) }} />
              <button onClick={() => quitarEjercicio(e.id)} disabled={ocupado} className="p-1 rounded" style={{ color: 'var(--text-muted)' }} aria-label={`Quitar ${e.nombre}`}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="relative mb-3">
        <div className="flex items-center gap-2">
          <Plus size={14} style={{ color: 'var(--text-muted)' }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Añadir ejercicio (busca por nombre)…" className={campo} style={estiloCampo} />
        </div>
        {resultados.length > 0 && (
          <div className="absolute z-20 left-5 right-0 mt-1 rounded-lg overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {resultados.map(r => (
              <button key={r.id} onClick={() => anadirEjercicio(r.id)} className="w-full text-left px-3 py-2 text-sm flex justify-between gap-3" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                <span className="truncate">{r.nombre}</span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{r.grupo_muscular}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <BookmarkPlus size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Guardar como sesión base en</span>
        <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaSesion)} className="text-sm px-2 py-1 rounded-lg" style={estiloCampo}>
          {CATEGORIAS_GUARDABLES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={guardarComoBase} disabled={ocupado} className="btn-secondary btn-sm">Guardar</button>
        {guardadaEn && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Guardada en «{guardadaEn}»</span>}
        {ocupado && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
      </div>

      {error && <p className="text-xs mt-2" role="alert" style={{ color: 'var(--semantic-alert-text)' }}>{error}</p>}
    </div>
  )
}
