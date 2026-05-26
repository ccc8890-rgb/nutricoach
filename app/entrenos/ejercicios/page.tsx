'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Save,
  Search,
  Video,
} from 'lucide-react'

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
  return hasFoto(e) && hasVideo(e) && (e.equipamiento?.length ?? 0) > 0 && !!e.dificultad_nivel
}

function coveragePercent(value: number, total: number) {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

export default function EjerciciosMediaPage() {
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [grupo, setGrupo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, Partial<Ejercicio>>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const loadEjercicios = useCallback(async () => {
    setLoading(true)
    setError(null)

    let q = supabase
      .from('ejercicios')
      .select('id, nombre, grupo_muscular, tipo, descripcion, foto_url, video_url, video_tipo, dificultad_nivel, equipamiento, musculos_secundarios')
      .order('nombre')
      .limit(120)

    if (query.trim()) q = q.ilike('nombre', `%${query.trim()}%`)
    if (grupo) q = q.eq('grupo_muscular', grupo)

    const { data, error: fetchError } = await q
    if (fetchError) {
      setError(fetchError.message)
      setEjercicios([])
    } else {
      setEjercicios(data ?? [])
    }
    setLoading(false)
  }, [grupo, query, supabase])

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

    return [
      { label: 'Ejercicios', value: total.toString(), hint: 'en la vista actual' },
      { label: 'Con foto', value: `${coveragePercent(fotos, total)}%`, hint: `${fotos}/${total}` },
      { label: 'Con vídeo', value: `${coveragePercent(videos, total)}%`, hint: `${videos}/${total}` },
      { label: 'Completos', value: `${coveragePercent(completos, total)}%`, hint: `${completos}/${total}` },
    ]
  }, [ejercicios])

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal" style={{ color: 'var(--text)' }}>
            Librería multimedia de ejercicios
          </h1>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>
            Fotos, vídeos, dificultad y material para que el coach y el cliente entiendan cada sesión sin fricción.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar ejercicio"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              className="input search-input w-full text-sm"
            />
          </div>
          <select value={grupo} onChange={e => setGrupo(e.target.value)} className="input text-sm sm:w-48">
            <option value="">Todos los grupos</option>
            {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {stats.map(item => (
            <div
              key={item.label}
              className="rounded-xl border px-4 py-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{item.value}</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{item.hint}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--text)' }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {ejercicios.map(ej => {
            const itemForm = form[ej.id] ?? {}
            const fotoPreview = (itemForm.foto_url ?? ej.foto_url ?? '') as string
            const videoPreview = (itemForm.video_url ?? ej.video_url ?? '') as string
            const completo = isCompleto(ej)

            return (
              <div
                key={ej.id}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
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
                      <ImageIcon size={18} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{ej.nombre}</p>
                      {completo && (
                        <span
                          className="hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex"
                          style={{ background: 'rgba(34, 197, 94, 0.12)', color: 'rgb(22, 163, 74)' }}
                        >
                          Completo
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ej.grupo_muscular || 'Sin grupo'} · {ej.tipo || 'Sin tipo'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                        <ImageIcon size={12} /> {ej.foto_url ? 'Foto' : 'Sin foto'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                        <Video size={12} /> {ej.video_url ? (ej.video_tipo || 'Vídeo') : 'Sin vídeo'}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                        Dificultad {ej.dificultad_nivel ?? '-'}/5
                      </span>
                    </div>
                  </div>

                  {expandedId === ej.id ? <ChevronUp size={17} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={17} style={{ color: 'var(--text-muted)' }} />}
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
                              <ImageIcon size={22} />
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
                            <Video size={15} />
                            Abrir vídeo
                            <ExternalLink size={14} />
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
                            <Loader2 size={14} className="animate-spin" />
                          ) : saved === ej.id ? (
                            <><Check size={14} /> Guardado</>
                          ) : (
                            <><Save size={14} /> Guardar cambios</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {ejercicios.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No se encontraron ejercicios
            </p>
          )}
        </div>
      )}
    </div>
  )
}
