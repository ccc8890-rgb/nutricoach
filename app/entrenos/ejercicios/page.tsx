'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  Check,
  CircleNotch,
  FloppyDisk,
  ImageSquare,
  MagnifyingGlass,
  SlidersHorizontal,
  VideoCamera,
  WarningCircle,
} from '@phosphor-icons/react'
import { calcularEjercicioQuality } from '@/lib/training/workspace'
import {
  crearExerciseLibraryBatchPlan,
  crearExerciseLibraryCoachGroups,
  crearExerciseLibraryQueue,
  filtrarExerciseLibrary,
  shouldShowExerciseLibraryList,
  type ExerciseLibraryEstadoFilter,
} from '@/lib/training/exercise-library'

interface Ejercicio {
  id: string
  nombre: string
  grupo_muscular: string
  tipo: string
  descripcion?: string
  foto_url?: string | null
  video_url?: string | null
  video_tipo?: string | null
  dificultad_nivel?: number | null
  equipamiento?: string[] | null
  musculos_secundarios?: string[] | null
}

const GRUPOS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Cardio', 'Funcional']
const EQUIPAMIENTO_OPTS = ['Barra', 'Mancuernas', 'Kettlebell', 'Máquina', 'Cable', 'Banda elástica', 'TRX', 'Peso corporal', 'Cuerda', 'Box']
const VIDEO_TIPOS = [
  { value: '', label: 'Detectar' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'vimeo', label: 'Vimeo' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'externo', label: 'Externo' },
]

function hasFoto(e: Ejercicio) {
  return !!e.foto_url
}

function hasVideo(e: Ejercicio) {
  return !!e.video_url
}

function isCompleto(e: Ejercicio) {
  return calcularEjercicioQuality(e).status === 'completo'
}

function coveragePercent(value: number, total: number) {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

function ReadinessBar({ value, tone = 'info' }: { value: number; tone?: 'info' | 'warn' | 'active' }) {
  const color = tone === 'active'
    ? 'var(--semantic-active)'
    : tone === 'warn'
      ? 'var(--semantic-warn)'
      : 'var(--semantic-info)'

  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-subtle)' }}>
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  )
}

function LibrarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map(item => (
          <div key={item} className="h-[88px] animate-pulse rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-72 animate-pulse rounded-3xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
        <div className="h-72 animate-pulse rounded-3xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {[0, 1, 2, 3].map(item => (
          <div key={item} className="h-24 animate-pulse rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  )
}

export default function EjerciciosMediaPage() {
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [grupo, setGrupo] = useState('')
  const [estado, setEstado] = useState<ExerciseLibraryEstadoFilter>('todos')
  const [tipo, setTipo] = useState('')
  const [equipamiento, setEquipamiento] = useState('')
  const [dificultad, setDificultad] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, Partial<Ejercicio>>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const loadEjercicios = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (grupo) params.set('grupo', grupo)

    const res = await fetch(`/api/ejercicios/media?${params.toString()}`)
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      setError(payload?.error ?? 'No se pudo cargar la librería de ejercicios')
      setEjercicios([])
    } else {
      const payload = await res.json()
      setEjercicios(payload.ejercicios ?? [])
    }
    setLoading(false)
  }, [grupo])

  useEffect(() => {
    loadEjercicios()
  }, [loadEjercicios])

  function toggleExpand(id: string, ej: Ejercicio) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }

    setExpandedId(id)
    setError(null)
    if (!form[id]) {
      setForm(prev => ({
        ...prev,
        [id]: {
          foto_url: ej.foto_url ?? '',
          video_url: ej.video_url ?? '',
          video_tipo: ej.video_tipo ?? '',
          dificultad_nivel: ej.dificultad_nivel ?? 3,
          equipamiento: ej.equipamiento ?? [],
          musculos_secundarios: ej.musculos_secundarios ?? [],
        },
      }))
    }
  }

  function updateField(id: string, field: keyof Ejercicio, value: unknown) {
    setForm(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  function toggleEquip(id: string, opt: string) {
    const cur = (form[id]?.equipamiento ?? []) as string[]
    const next = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt]
    updateField(id, 'equipamiento', next)
  }

  async function saveEjercicio(id: string) {
    setSaving(id)
    setError(null)
    const updates = form[id] ?? {}
    const res = await fetch(`/api/ejercicios/${id}/media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    setSaving(null)
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      setError(payload?.error ?? 'No se pudo guardar el ejercicio')
      return
    }

    const savedEjercicio = await res.json()
    setSaved(id)
    setTimeout(() => setSaved(null), 2000)
    setEjercicios(prev => prev.map(e => e.id === id ? { ...e, ...savedEjercicio } : e))
  }

  const stats = useMemo(() => {
    const total = ejercicios.length
    const fotos = ejercicios.filter(hasFoto).length
    const videos = ejercicios.filter(hasVideo).length
    const completos = ejercicios.filter(isCompleto).length
    const scoreMedio = total
      ? Math.round(ejercicios.reduce((acc, e) => acc + calcularEjercicioQuality(e).score, 0) / total)
      : 0

    return [
      { label: 'Ejercicios', value: total.toString(), hint: 'en la vista actual' },
      { label: 'Quality', value: `${scoreMedio}%`, hint: 'media assets' },
      { label: 'Con foto', value: `${coveragePercent(fotos, total)}%`, hint: `${fotos}/${total}` },
      { label: 'Con vídeo', value: `${coveragePercent(videos, total)}%`, hint: `${videos}/${total}` },
      { label: 'Completos', value: `${coveragePercent(completos, total)}%`, hint: `${completos}/${total}` },
    ]
  }, [ejercicios])

  const visibles = useMemo(() => {
    return filtrarExerciseLibrary(ejercicios, { query, grupo, tipo, equipamiento, dificultad, estado }) as Ejercicio[]
  }, [dificultad, ejercicios, equipamiento, estado, grupo, query, tipo])
  const assetQueue = useMemo(() => crearExerciseLibraryQueue(ejercicios), [ejercicios])
  const batchPlan = useMemo(() => crearExerciseLibraryBatchPlan(ejercicios), [ejercicios])
  const coachGroups = useMemo(() => crearExerciseLibraryCoachGroups(ejercicios), [ejercicios])
  const selectedGroup = useMemo(() => coachGroups.find(item => item.grupo === grupo), [coachGroups, grupo])
  const grupoOptions = useMemo(() => Array.from(new Set([...GRUPOS, ...ejercicios.map(e => e.grupo_muscular).filter(Boolean)])).sort(), [ejercicios])
  const tipoOptions = useMemo(() => Array.from(new Set(ejercicios.map(e => e.tipo).filter(Boolean))).sort(), [ejercicios])
  const equipamientoOptions = useMemo(() => Array.from(new Set(ejercicios.flatMap(e => e.equipamiento ?? []).filter(Boolean))).sort(), [ejercicios])
  const dificultadOptions = useMemo(() => Array.from(new Set(ejercicios.map(e => e.dificultad_nivel).filter((item): item is number => item != null))).sort((a, b) => a - b), [ejercicios])
  const filtrosActivos = [query.trim(), grupo, tipo, equipamiento, dificultad, estado !== 'todos' ? estado : ''].filter(Boolean).length
  const showExerciseList = shouldShowExerciseLibraryList({ query, grupo, tipo, equipamiento, dificultad, estado })

  function limpiarFiltros() {
    setQuery('')
    setGrupo('')
    setTipo('')
    setEquipamiento('')
    setDificultad('')
    setEstado('todos')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--text-muted)' }}>
            Biblioteca · Ejecución
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
            Biblioteca de ejercicios
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Revisa ejercicios por grupo, completa configuración útil y deja el material listo para asignar a planes de clientes sin entrar en una biblioteca técnica.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 sm:w-80">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar por nombre, tipo, material..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              className="input search-input w-full text-sm"
            />
          </div>
          {filtrosActivos > 0 && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {stats.map(item => (
            <div
              key={item.label}
              className="rounded-xl border px-4 py-3 transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{item.value}</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{item.hint}</p>
              {item.value.endsWith('%') && <ReadinessBar value={Number(item.value.replace('%', '')) || 0} tone={item.label === 'Completos' ? 'active' : item.label === 'Quality' ? 'info' : 'warn'} />}
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, var(--surface), var(--bg-subtle))' }}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                Workspace por grupos
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                Qué está listo para asignar y qué necesita revisión
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Trabaja por grupos musculares: primero deja vídeos, dificultad y equipamiento en orden; después usa esos ejercicios en builder, plantillas y ajustes IA.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 max-w-md">
                <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Readiness</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{assetQueue.assetReadinessPct}%</p>
                </div>
                <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Completos</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{assetQueue.completos}</p>
                </div>
                <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Prioridad</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{assetQueue.prioritarios.length}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Abrir categoría</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Elige un grupo y evita revisar la lista completa.</p>
                  </div>
                  <select value={grupo} onChange={e => setGrupo(e.target.value)} className="input text-sm sm:w-56">
                    <option value="">Seleccionar grupo</option>
                    {grupoOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {coachGroups.map(item => {
                  const active = grupo === item.grupo
                  return (
                    <button
                      key={item.grupo}
                      type="button"
                      onClick={() => setGrupo(active ? '' : item.grupo)}
                      className="rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                        background: active ? 'var(--semantic-info-bg)' : 'var(--bg)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.grupo}</p>
                        <span className="text-[11px] font-semibold" style={{ color: item.pendientes ? 'var(--semantic-warn)' : 'var(--semantic-active)' }}>
                          {item.readinessPct}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {item.total} ejercicios · {item.listos} listos · {item.pendientes} por revisar
                      </p>
                      <p className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {item.primaryGap}
                      </p>
                      <ReadinessBar value={item.readinessPct} tone={item.pendientes ? 'warn' : 'active'} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                  {selectedGroup ? `Grupo activo: ${selectedGroup.grupo}` : 'Cola prioritaria'}
                </p>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{assetQueue.prioritarios.length} ejercicios</span>
              </div>
              {selectedGroup && (
                <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} weight="duotone" style={{ color: 'var(--semantic-info)' }} />
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Uso operativo</p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Revisa dificultad, equipamiento y vídeo en {selectedGroup.grupo.toLowerCase()} antes de asignar estos ejercicios a clientes o plantillas.
                  </p>
                </div>
              )}
              {batchPlan.batchSize > 0 && (
                <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--semantic-info-border)', background: 'var(--semantic-info-bg)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--semantic-info)' }}>
                        Batch recomendado
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>{batchPlan.focus}</p>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: 'var(--semantic-info-border)', color: 'var(--semantic-info)', background: 'var(--bg)' }}>
                      {batchPlan.estimatedMinutes} min
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{batchPlan.note}</p>
                </div>
              )}
              <div className="mt-3 space-y-2">
                {assetQueue.prioritarios.length > 0 ? assetQueue.prioritarios.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const ejercicio = ejercicios.find(e => e.id === item.id)
                      if (ejercicio) toggleExpand(item.id, ejercicio)
                    }}
                    className="w-full rounded-xl border px-3 py-2 text-left transition-colors"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold" style={{ color: 'var(--text)' }}>{item.nombre}</p>
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--semantic-warn)' }}>{item.score}%</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.reason}</p>
                  </button>
                )) : (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Todos los ejercicios visibles tienen media y metadatos suficientes para sesión móvil.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {!loading && (
        <section className="rounded-2xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Filtros de trabajo</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {visibles.length} de {ejercicios.length} ejercicios visibles{filtrosActivos ? ` · ${filtrosActivos} filtros activos` : ''}
              </p>
            </div>
            {filtrosActivos > 0 && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg)' }}
              >
                Reset
              </button>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <select value={grupo} onChange={e => setGrupo(e.target.value)} className="input text-sm">
              <option value="">Grupo: elegir categoría</option>
              {grupoOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={estado} onChange={e => setEstado(e.target.value as ExerciseLibraryEstadoFilter)} className="input text-sm">
              <option value="todos">Todos los estados</option>
              <option value="por_completar">Por completar</option>
              <option value="sin_video">Falta vídeo</option>
              <option value="sin_foto">Falta foto</option>
              <option value="listos">Listos para asignar</option>
            </select>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="input text-sm">
              <option value="">Todos los tipos</option>
              {tipoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select value={equipamiento} onChange={e => setEquipamiento(e.target.value)} className="input text-sm">
              <option value="">Todo el material</option>
              {equipamientoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select value={dificultad} onChange={e => setDificultad(e.target.value)} className="input text-sm">
              <option value="">Toda dificultad</option>
              {dificultadOptions.map(opt => <option key={opt} value={String(opt)}>Dificultad {opt}</option>)}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              ['todos', 'Todos'],
              ['por_completar', 'Por completar'],
              ['sin_video', 'Falta vídeo'],
              ['sin_foto', 'Falta foto'],
              ['listos', 'Listos'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setEstado(value as ExerciseLibraryEstadoFilter)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: estado === value ? 'var(--accent)' : 'var(--bg)',
                  color: estado === value ? 'var(--bg)' : 'var(--text-secondary)',
                  border: `1px solid ${estado === value ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div
          className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--text)' }}
        >
          <WarningCircle size={16} weight="duotone" className="mt-0.5 shrink-0" style={{ color: 'var(--semantic-alert)' }} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LibrarySkeleton />
      ) : !showExerciseList ? (
        <section className="rounded-3xl border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <SlidersHorizontal size={24} weight="duotone" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--text)' }}>Elige una categoría o usa la búsqueda</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            La librería tiene muchos ejercicios. Para trabajar más rápido, selecciona un grupo muscular, material, dificultad o estado antes de desplegar resultados.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {coachGroups.slice(0, 6).map(item => (
              <button
                key={item.grupo}
                type="button"
                onClick={() => setGrupo(item.grupo)}
                className="rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.grupo}</p>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.total}</span>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.primaryGap}</p>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visibles.map((ej, index) => {
            const prev = visibles[index - 1]
            const showGroupHeader = !grupo && (prev?.grupo_muscular || 'Sin grupo') !== (ej.grupo_muscular || 'Sin grupo')
            const itemForm = form[ej.id] ?? {}
            const fotoPreview = (itemForm.foto_url ?? ej.foto_url ?? '') as string
            const videoPreview = (itemForm.video_url ?? ej.video_url ?? '') as string
            const quality = calcularEjercicioQuality(ej)
            const completo = quality.status === 'completo'

            return (
              <div key={ej.id} className="contents">
                {showGroupHeader && (
                  <div className="col-span-full mt-2 flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{ej.grupo_muscular || 'Sin grupo'}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Bloque operativo para revisar y asignar</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGrupo(ej.grupo_muscular || '')}
                      className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
                    >
                      Filtrar grupo
                    </button>
                  </div>
                )}
                <div
                  className="overflow-hidden rounded-2xl border"
                  style={{ borderColor: completo ? 'var(--semantic-active-border)' : 'var(--border)', background: 'var(--surface)' }}
                >
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => toggleExpand(ej.id, ej)}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                  >
                    {ej.foto_url ? (
                      <div
                        aria-hidden="true"
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url("${ej.foto_url}")` }}
                      />
                    ) : (
                      <ImageSquare size={18} weight="duotone" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{ej.nombre}</p>
                      <span
                        className="hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:inline-flex"
                        style={{
                          background: completo ? 'var(--semantic-active-bg)' : quality.status === 'usable' ? 'var(--semantic-info-bg)' : 'var(--semantic-warn-bg)',
                          color: completo ? 'var(--semantic-active)' : quality.status === 'usable' ? 'var(--semantic-info)' : 'var(--semantic-warn)',
                          borderColor: completo ? 'var(--semantic-active-border)' : quality.status === 'usable' ? 'var(--semantic-info-border)' : 'var(--semantic-warn-border)',
                        }}
                      >
                        {quality.score}% · {quality.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ej.grupo_muscular || 'Sin grupo'} · {ej.tipo || 'Sin tipo'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                        <ImageSquare size={12} /> {ej.foto_url ? 'Foto' : 'Sin foto'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                        <VideoCamera size={12} /> {ej.video_url ? (ej.video_tipo || 'Vídeo') : 'Sin vídeo'}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                        Dificultad {ej.dificultad_nivel ?? '-'}/5
                      </span>
                      {quality.gaps.slice(0, 2).map(gap => (
                        <span key={gap} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                          {gap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {expandedId === ej.id ? <CaretUp size={17} style={{ color: 'var(--text-muted)' }} /> : <CaretDown size={17} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {expandedId === ej.id && (
                  <div className="border-t px-4 py-4" style={{ borderColor: 'var(--border)' }}>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div className="space-y-3">
                        <div
                          className="aspect-video overflow-hidden rounded-xl border"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                        >
                          {fotoPreview ? (
                            <div
                              aria-hidden="true"
                              className="h-full w-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${fotoPreview}")` }}
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <ImageSquare size={22} weight="duotone" />
                              Sin imagen
                            </div>
                          )}
                        </div>

                        {videoPreview && (
                          <a
                            href={videoPreview}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
                            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                          >
                            <VideoCamera size={15} />
                            Abrir vídeo
                            <ArrowSquareOut size={14} />
                          </a>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>URL foto</label>
                            <input
                              type="url"
                              placeholder="https://..."
                              value={(itemForm.foto_url ?? '') as string}
                              onChange={e => updateField(ej.id, 'foto_url', e.target.value)}
                              autoComplete="off"
                              className="input w-full text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tipo de vídeo</label>
                            <select
                              value={(itemForm.video_tipo ?? '') as string}
                              onChange={e => updateField(ej.id, 'video_tipo', e.target.value)}
                              className="input w-full text-sm"
                            >
                              {VIDEO_TIPOS.map(tipo => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>URL vídeo</label>
                          <input
                            type="url"
                            placeholder="https://youtube.com/..."
                            value={(itemForm.video_url ?? '') as string}
                            onChange={e => updateField(ej.id, 'video_url', e.target.value)}
                            autoComplete="off"
                            className="input w-full text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Dificultad</label>
                          <div className="grid grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map(n => {
                              const selected = (itemForm.dificultad_nivel ?? 0) === n
                              return (
                                <button
                                  key={n}
                                  onClick={() => updateField(ej.id, 'dificultad_nivel', n)}
                                  className="h-9 rounded-lg border text-sm font-medium transition-colors"
                                  style={{
                                    borderColor: selected ? 'var(--accent)' : 'var(--border)',
                                    background: selected ? 'var(--accent)' : 'transparent',
                                    color: selected ? '#fff' : 'var(--text)',
                                  }}
                                >
                                  {n}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Equipamiento</label>
                          <div className="flex flex-wrap gap-1.5">
                            {EQUIPAMIENTO_OPTS.map(opt => {
                              const selected = ((itemForm.equipamiento ?? []) as string[]).includes(opt)
                              return (
                                <button
                                  key={opt}
                                  onClick={() => toggleEquip(ej.id, opt)}
                                  className="rounded-full border px-2.5 py-1 text-xs transition-colors"
                                  style={{
                                    borderColor: selected ? 'var(--accent)' : 'var(--border)',
                                    background: selected ? 'var(--accent)' : 'transparent',
                                    color: selected ? '#fff' : 'var(--text)',
                                  }}
                                >
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Músculos secundarios</label>
                          <input
                            type="text"
                            placeholder="Core, Glúteos, Isquios"
                            value={((itemForm.musculos_secundarios ?? []) as string[]).join(', ')}
                            onChange={e => updateField(ej.id, 'musculos_secundarios', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            autoComplete="off"
                            className="input w-full text-sm"
                          />
                        </div>

                        <button
                          onClick={() => saveEjercicio(ej.id)}
                          disabled={saving === ej.id}
                          className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm sm:w-auto"
                        >
                          {saving === ej.id ? (
                            <CircleNotch size={14} className="animate-spin" />
                          ) : saved === ej.id ? (
                            <><Check size={14} /> Guardado</>
                          ) : (
                            <><FloppyDisk size={14} /> Guardar cambios</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            )
          })}

          {visibles.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No se encontraron ejercicios
            </p>
          )}
        </div>
      )}
    </div>
  )
}
