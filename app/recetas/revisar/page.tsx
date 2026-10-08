'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ExternalLink, ImageOff, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react'
import RevisionTabs from '@/components/recetas/RevisionTabs'
import { useToast } from '@/components/ui/Toast'
import { APTAS_CLIENTE, NIVELES_FIT, TIPOS_USO } from '@/lib/recetas/profesional'
import { useEstadoUrl, useRecordarLista, useRestaurarScroll } from '@/lib/useEstadoUrl'
import { esRecetaAprobable, type QualityIssues, type TareaRevision } from '@/lib/recetas/revision'

type RecetaRevision = {
  id: string
  nombre: string
  categoria: string | null
  tipo_plato: string | null
  porciones: number | null
  kcal: number | null
  proteinas: number | null
  carbohidratos: number | null
  grasas: number | null
  imagen_url: string | null
  estado: string | null
  score_calidad: number | null
  nivel_fit: string | null
  tipo_uso: string | null
  apta_cliente: string | null
  quality_issues: QualityIssues | null
  created_at: string | null
  num_ingredientes: number
}

type RespuestaRevision = {
  data: RecetaRevision[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: Record<TareaRevision, number>
  aprobablesIds: string[]
}

const TAREAS: Array<{ id: TareaRevision; label: string }> = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'nuevas_hoy', label: 'Nuevas hoy' },
  { id: 'bloqueos', label: 'Con bloqueos' },
  { id: 'sin_foto', label: 'Sin foto' },
  { id: 'todas', label: 'Todas' },
]

function fechaAlta(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(value))
}

function scoreColor(score: number | null) {
  if (score === null) return 'var(--text-muted)'
  if (score >= 85) return 'var(--success)'
  if (score >= 70) return 'var(--warning)'
  return 'var(--error)'
}

function ChipsCalidad({ issues }: { issues: QualityIssues | null }) {
  const bloqueantes = issues?.bloqueantes ?? []
  const avisos = issues?.avisos ?? []
  if (bloqueantes.length === 0 && avisos.length === 0) {
    return <span className="text-xs" style={{ color: 'var(--success)' }}>Sin incidencias</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {bloqueantes.map(motivo => (
        <span key={`b-${motivo}`} title={motivo} className="max-w-[240px] truncate rounded-full px-2 py-1 text-[11px] font-medium" style={{ color: 'var(--error)', background: 'color-mix(in srgb, var(--error) 12%, transparent)' }}>
          Bloqueo: {motivo}
        </span>
      ))}
      {avisos.map(aviso => (
        <span key={`a-${aviso}`} title={aviso} className="max-w-[240px] truncate rounded-full px-2 py-1 text-[11px] font-medium" style={{ color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 12%, transparent)' }}>
          Aviso: {aviso}
        </span>
      ))}
    </div>
  )
}

export default function RevisarRecetasPage() {
  const { addToast } = useToast()
  const [respuesta, setRespuesta] = useState<RespuestaRevision | null>(null)
  const [loading, setLoading] = useState(true)
  useRestaurarScroll(!loading)
  const [error, setError] = useState<string | null>(null)
  // Tarea, página y filtros en la URL: al abrir una receta y volver, la bandeja reaparece igual
  useRecordarLista('revisar')
  const [tarea, setTarea] = useEstadoUrl<TareaRevision>('tarea', 'pendientes')
  const [paginaRaw, setPaginaRaw] = useEstadoUrl<string>('pagina', '1')
  const pagina = Math.max(1, Number(paginaRaw) || 1)
  const setPagina = (n: number) => setPaginaRaw(String(n))
  const [busqueda, setBusqueda] = useEstadoUrl<string>('q', '')
  const [nivel, setNivel] = useEstadoUrl<string>('nivel', '')
  const [uso, setUso] = useEstadoUrl<string>('uso', '')
  const [apta, setApta] = useEstadoUrl<string>('apta', '')
  const [procesando, setProcesando] = useState<Set<string>>(new Set())
  const [aprobandoLote, setAprobandoLote] = useState(false)

  const parametros = useMemo(() => {
    const params = new URLSearchParams({ tarea, page: String(pagina), pageSize: '50' })
    if (busqueda.trim()) params.set('q', busqueda.trim())
    if (nivel) params.set('nivel', nivel)
    if (uso) params.set('uso', uso)
    if (apta) params.set('apta', apta)
    return params.toString()
  }, [tarea, pagina, busqueda, nivel, uso, apta])

  const cargar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/recetas/revisar?${parametros}`, { cache: 'no-store', signal })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      setRespuesta(json)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'No se pudo cargar la bandeja')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [parametros])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => cargar(controller.signal), 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [cargar])

  function cambiarTarea(value: TareaRevision) {
    setTarea(value)
    setPagina(1)
  }

  async function cambiarEstado(receta: RecetaRevision, estado: 'aprobada' | 'descartada') {
    const bloqueantes = receta.quality_issues?.bloqueantes ?? []
    if (estado === 'aprobada' && bloqueantes.length > 0) {
      addToast({ type: 'warning', title: 'No se puede aprobar', message: bloqueantes.join(' · ') })
      return
    }
    if (estado === 'descartada' && !window.confirm(`¿Descartar “${receta.nombre}”?`)) return

    const anterior = respuesta
    setProcesando(actual => new Set(actual).add(receta.id))
    setRespuesta(actual => actual ? {
      ...actual,
      data: actual.data.filter(item => item.id !== receta.id),
      total: Math.max(0, actual.total - 1),
      counts: {
        ...actual.counts,
        pendientes: receta.estado === 'en_revision' || receta.estado === 'borrador' ? Math.max(0, actual.counts.pendientes - 1) : actual.counts.pendientes,
      },
      aprobablesIds: actual.aprobablesIds.filter(id => id !== receta.id),
    } : actual)

    try {
      const res = await fetch(`/api/recetas/${receta.id}/estado`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error([json.error, ...(json.bloqueantes ?? [])].filter(Boolean).join(': '))
      addToast({ type: 'success', title: estado === 'aprobada' ? 'Receta aprobada' : 'Receta descartada', message: receta.nombre })
      await cargar()
    } catch (err) {
      setRespuesta(anterior)
      addToast({ type: 'error', title: 'No se pudo actualizar', message: err instanceof Error ? err.message : 'Error desconocido' })
    } finally {
      setProcesando(actual => { const next = new Set(actual); next.delete(receta.id); return next })
    }
  }

  async function aprobarAprobables() {
    const ids = respuesta?.aprobablesIds ?? []
    if (ids.length === 0) return
    if (!window.confirm(`Se aprobarán ${ids.length} recetas del filtro actual que pasan el quality gate. ¿Continuar?`)) return
    setAprobandoLote(true)
    try {
      const res = await fetch('/api/recetas/revisar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo aprobar el lote')
      const bloqueadas = Array.isArray(json.bloqueadas) ? json.bloqueadas.length : 0
      addToast({
        type: bloqueadas ? 'warning' : 'success',
        title: `Aprobadas ${json.aprobadas} recetas`,
        message: bloqueadas ? `${bloqueadas} quedaron bloqueadas tras volver a comprobar el quality gate.` : 'El filtro actual se ha actualizado.',
        duration: 6500,
      })
      await cargar()
    } catch (err) {
      addToast({ type: 'error', title: 'Error al aprobar el lote', message: err instanceof Error ? err.message : 'Error desconocido' })
    } finally {
      setAprobandoLote(false)
    }
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-20 border-b" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 94%, transparent)', backdropFilter: 'blur(12px)' }}>
        <div className="mx-auto max-w-7xl px-4 pt-3"><RevisionTabs /></div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pb-4">
          <Link href="/recetas" aria-label="Volver al recetario" className="rounded-lg p-2" style={{ color: 'var(--text-secondary)' }}><ArrowLeft size={20} /></Link>
          <div className="min-w-[180px] flex-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Bandeja de revisión</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{respuesta ? `${respuesta.total} resultados en este filtro` : 'Cargando…'}</p>
          </div>
          <button onClick={() => cargar()} aria-label="Actualizar" className="rounded-xl border p-2.5" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}><RefreshCw size={16} /></button>
          <button onClick={aprobarAprobables} disabled={aprobandoLote || !respuesta?.aprobablesIds.length} className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ color: 'var(--bg)', background: 'var(--primary)' }}>
            {aprobandoLote ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Aprobar aprobables ({respuesta ? respuesta.aprobablesIds.length : '…'})
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Tareas de revisión">
          {TAREAS.map(item => (
            <button key={item.id} onClick={() => cambiarTarea(item.id)} className="shrink-0 rounded-full border px-3 py-2 text-sm font-medium" style={{ borderColor: tarea === item.id ? 'var(--primary)' : 'var(--border)', color: tarea === item.id ? 'var(--primary)' : 'var(--text-secondary)', background: tarea === item.id ? 'var(--primary-bg)' : 'var(--surface)' }}>
              {item.label} ({respuesta?.counts[item.id] ?? '…'})
            </button>
          ))}
        </nav>

        <section className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={busqueda} onChange={event => { setBusqueda(event.target.value); setPagina(1) }} placeholder="Buscar por nombre…" className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
          </div>
          <details className="mt-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Más filtros <ChevronDown size={15} /></summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {([
                ['Nivel fit', nivel, setNivel, NIVELES_FIT],
                ['Tipo de uso', uso, setUso, TIPOS_USO],
                ['Apta para', apta, setApta, APTAS_CLIENTE],
              ] as const).map(([label, value, setter, options]) => (
                <select key={label} value={value} onChange={event => { setter(event.target.value); setPagina(1) }} aria-label={label} className="rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: value ? 'var(--primary)' : 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">{label}: todos</option>
                  {options.map(option => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
                </select>
              ))}
            </div>
          </details>
        </section>

        {error && <div className="flex items-center gap-2 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--error)', color: 'var(--error)', background: 'color-mix(in srgb, var(--error) 8%, var(--surface))' }}><AlertTriangle size={17} />{error}</div>}

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl" style={{ background: 'var(--surface)' }} />)}</div>
        ) : respuesta?.data.length ? (
          <>
            <div className="grid gap-3 2xl:hidden">
              {respuesta.data.map(receta => <RecetaCard key={receta.id} receta={receta} busy={procesando.has(receta.id)} onEstado={cambiarEstado} />)}
            </div>
            <div className="hidden overflow-x-auto rounded-2xl border 2xl:block" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-left text-sm">
                <thead style={{ background: 'var(--surface)' }}><tr className="border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  {['Foto', 'Receta', 'Macros/ración', 'Calidad', 'Estado y alta', 'Acciones'].map(label => <th key={label} className={`px-3 py-3 text-xs font-semibold${label === 'Acciones' ? ' sticky right-0' : ''}`} style={label === 'Acciones' ? { background: 'var(--surface)' } : undefined}>{label}</th>)}
                </tr></thead>
                <tbody>{respuesta.data.map(receta => <RecetaFila key={receta.id} receta={receta} busy={procesando.has(receta.id)} onEstado={cambiarEstado} />)}</tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border py-16 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}><Check className="mx-auto mb-3" style={{ color: 'var(--success)' }} /><p className="font-semibold" style={{ color: 'var(--text)' }}>No hay recetas en este filtro</p></div>
        )}

        {respuesta && respuesta.totalPages > 1 && <div className="flex items-center justify-center gap-3">
          <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Anterior</button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Página {pagina} de {respuesta.totalPages}</span>
          <button disabled={pagina >= respuesta.totalPages} onClick={() => setPagina(pagina + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-30" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Siguiente</button>
        </div>}
      </div>
    </main>
  )
}

function FotoReceta({ receta }: { receta: RecetaRevision }) {
  return <Link href="/recetas/imagenes" title="Abrir revisión de imágenes" className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-muted)' }}>
    {receta.imagen_url ? <Image src={receta.imagen_url} alt="" fill sizes="80px" className="object-cover" /> : <div className="flex flex-col items-center gap-1 text-[10px]"><ImageOff size={18} />Sin foto</div>}
  </Link>
}

function Acciones({ receta, busy, onEstado }: { receta: RecetaRevision; busy: boolean; onEstado: (receta: RecetaRevision, estado: 'aprobada' | 'descartada') => void }) {
  const aprobable = esRecetaAprobable(receta.estado, receta.quality_issues)
  const motivo = receta.quality_issues?.bloqueantes?.join(' · ') || (receta.estado === 'aprobada' ? 'La receta ya está aprobada' : 'Solo se aprueban recetas pendientes')
  return <div className="flex flex-wrap gap-1.5">
    <button disabled={busy || !aprobable} title={aprobable ? 'Aprobar receta' : motivo} onClick={() => onEstado(receta, 'aprobada')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: 'var(--primary)', color: 'var(--bg)' }}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Aprobar</button>
    <button disabled={busy || receta.estado === 'descartada'} onClick={() => onEstado(receta, 'descartada')} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}><Trash2 size={13} />Descartar</button>
    <Link href={`/recetas/${receta.id}?returnTo=${encodeURIComponent(typeof window === 'undefined' ? '/recetas/revisar' : window.location.pathname + window.location.search)}`} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Abrir <ExternalLink size={12} /></Link>
  </div>
}

function RecetaCard({ receta, busy, onEstado }: { receta: RecetaRevision; busy: boolean; onEstado: (receta: RecetaRevision, estado: 'aprobada' | 'descartada') => void }) {
  return <article className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
    <div className="flex gap-3"><FotoReceta receta={receta} /><div className="min-w-0 flex-1"><p className="font-semibold leading-tight" style={{ color: 'var(--text)' }}>{receta.nombre}</p><p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{receta.tipo_plato ?? receta.categoria ?? 'Sin tipo'} · alta {fechaAlta(receta.created_at)}</p><p className="mt-2 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{Math.round(receta.kcal ?? 0)} kcal · P {Math.round(receta.proteinas ?? 0)} · C {Math.round(receta.carbohidratos ?? 0)} · G {Math.round(receta.grasas ?? 0)}</p></div><span className="text-sm font-bold" style={{ color: scoreColor(receta.score_calidad) }}>{receta.score_calidad ?? '—'}</span></div>
    <div className="mt-3"><ChipsCalidad issues={receta.quality_issues} /></div>
    <div className="mt-3 flex items-center justify-between gap-2"><span className="rounded-full px-2 py-1 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>{receta.estado?.replaceAll('_', ' ') ?? 'sin estado'}</span><Acciones receta={receta} busy={busy} onEstado={onEstado} /></div>
  </article>
}

function RecetaFila({ receta, busy, onEstado }: { receta: RecetaRevision; busy: boolean; onEstado: (receta: RecetaRevision, estado: 'aprobada' | 'descartada') => void }) {
  return <tr className="border-b last:border-b-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
    <td className="px-3 py-3"><FotoReceta receta={receta} /></td>
    <td className="min-w-[220px] px-3 py-3"><p className="font-semibold" style={{ color: 'var(--text)' }}>{receta.nombre}</p><p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{receta.tipo_plato ?? receta.categoria ?? 'Sin tipo'} · {receta.num_ingredientes} ingredientes</p></td>
    <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text)' }}>{Math.round(receta.kcal ?? 0)} kcal</b><br />P {Math.round(receta.proteinas ?? 0)} · C {Math.round(receta.carbohidratos ?? 0)} · G {Math.round(receta.grasas ?? 0)}</td>
    <td className="max-w-[310px] px-3 py-3"><div className="mb-1 text-sm font-bold" style={{ color: scoreColor(receta.score_calidad) }}>{receta.score_calidad ?? '—'}/100</div><ChipsCalidad issues={receta.quality_issues} /></td>
    <td className="whitespace-nowrap px-3 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}><span className="rounded-full px-2 py-1" style={{ background: 'var(--surface)' }}>{receta.estado?.replaceAll('_', ' ') ?? 'sin estado'}</span><br /><span className="mt-2 inline-block" style={{ color: 'var(--text-muted)' }}>{fechaAlta(receta.created_at)}</span></td>
    <td className="sticky right-0 px-3 py-3" style={{ background: 'var(--bg)' }}><Acciones receta={receta} busy={busy} onEstado={onEstado} /></td>
  </tr>
}
