'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { CATEGORIAS_SESION, type CategoriaSesion } from '@/lib/entrenos/biblioteca-categorias'
import { MUSCULOS, PESTANAS_EJERCICIO, musculoDe, pestanaDe, porDefecto, sinDuplicados, type EjercicioBiblioteca, type Musculo, type PestanaEjercicio } from '@/lib/entrenos/ejercicio-categorias'

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


interface CatalogoEjercicios { ejercicios: EjercicioBiblioteca[]; uso: Record<string, number> }
let cacheCatalogo: CatalogoEjercicios | null = null

/** Elegir un ejercicio con un clic: habituales, pestañas por tipo de trabajo y, en fuerza, por músculo. El buscador es solo un apoyo. */
function SelectorEjercicio({ onElegir, ocupado }: { onElegir: (e: EjercicioBiblioteca) => void; ocupado: boolean }) {
  const [catalogo, setCatalogo] = useState<CatalogoEjercicios | null>(cacheCatalogo)
  const [fallo, setFallo] = useState(false)
  const [pestana, setPestana] = useState<PestanaEjercicio>('Calentamiento')
  const [musculo, setMusculo] = useState<Musculo | 'Todos'>('Todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (cacheCatalogo) return
    fetch('/api/entrenos/ejercicios-catalogo')
      .then(r => r.json())
      .then(d => { if (!d.ejercicios) throw new Error(); cacheCatalogo = d; setCatalogo(d) })
      .catch(() => setFallo(true))
  }, [])

  const { lista, habituales } = useMemo(() => {
    if (!catalogo) return { lista: [] as EjercicioBiblioteca[], habituales: [] as EjercicioBiblioteca[] }
    const uso = new Map(Object.entries(catalogo.uso))
    const unicos = sinDuplicados(catalogo.ejercicios, uso)
    const habituales = [...unicos].filter(e => (uso.get(e.id) ?? 0) > 0).sort((a, b) => (uso.get(b.id) ?? 0) - (uso.get(a.id) ?? 0)).slice(0, 12)
    const q = busqueda.trim().toLowerCase()
    const lista = unicos
      .filter(e => (q ? e.nombre.toLowerCase().includes(q) : pestanaDe(e) === pestana && (pestana !== 'Fuerza' || musculo === 'Todos' || musculoDe(e) === musculo)))
      .sort((a, b) => (uso.get(b.id) ?? 0) - (uso.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
    return { lista, habituales }
  }, [catalogo, pestana, musculo, busqueda])

  const chip = (activo: boolean) => ({ background: activo ? 'var(--primary)' : 'transparent', color: activo ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)' }) as const

  if (fallo) return <p className="text-xs mb-3" style={{ color: 'var(--semantic-alert-text)' }}>No se pudo cargar la biblioteca de ejercicios.</p>
  if (!catalogo) return <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: 'var(--text-muted)' }}><Loader2 size={13} className="animate-spin" /> Cargando ejercicios…</div>

  return (
    <div className="mb-3 rounded-lg p-2.5" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Plus size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Añadir ejercicio</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…" className="text-xs px-2 py-1 rounded-lg w-32" style={estiloCampo} />
        </span>
      </div>

      {habituales.length > 0 && !busqueda && (
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Habituales</p>
          <div className="flex flex-wrap gap-1.5">
            {habituales.map(e => (
              <button key={e.id} onClick={() => onElegir(e)} disabled={ocupado} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--surface-elevated,var(--border))', color: 'var(--text)' }}>{e.nombre}</button>
            ))}
          </div>
        </div>
      )}

      {!busqueda && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {PESTANAS_EJERCICIO.map(p => <button key={p} onClick={() => { setPestana(p); setMusculo('Todos') }} className="text-xs px-2.5 py-1 rounded-full" style={chip(pestana === p)}>{p}</button>)}
          </div>
          {pestana === 'Fuerza' && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {(['Todos', ...MUSCULOS] as const).map(m => <button key={m} onClick={() => setMusculo(m)} className="text-[11px] px-2 py-0.5 rounded-full" style={chip(musculo === m)}>{m}</button>)}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pt-1">
        {lista.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No hay ejercicios aquí.</p>
        ) : lista.map(e => (
          <button key={e.id} onClick={() => onElegir(e)} disabled={ocupado} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>{e.nombre}</button>
        ))}
      </div>
    </div>
  )
}

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
  const [categoria, setCategoria] = useState<CategoriaSesion>(conPasos ? 'Running' : 'Fuerza')
  const [guardadaEn, setGuardadaEn] = useState<string | null>(null)

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

  async function anadirEjercicio(e: EjercicioBiblioteca) {
    if (await llamar(`${base}/ejercicios`, 'POST', { ejercicio_id: e.id, ...porDefecto(e) })) await onCambio()
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

      <SelectorEjercicio onElegir={anadirEjercicio} ocupado={ocupado} />

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
