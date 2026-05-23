'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Search, Video, Image as ImageIcon, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react'

interface Ejercicio {
  id: string
  nombre: string
  grupo_muscular: string
  tipo: string
  descripcion?: string
  foto_url?: string
  video_url?: string
  video_tipo?: string
  dificultad_nivel?: number
  equipamiento?: string[]
  musculos_secundarios?: string[]
}

const GRUPOS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Cardio', 'Funcional']
const EQUIPAMIENTO_OPTS = ['Barra', 'Mancuernas', 'Kettlebell', 'Máquina', 'Cable', 'Banda elástica', 'TRX', 'Peso corporal', 'Cuerda', 'Box']

export default function EjerciciosMediaPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [grupo, setGrupo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, Partial<Ejercicio>>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadEjercicios()
  }, [query, grupo])

  async function loadEjercicios() {
    setLoading(true)
    let q = supabase
      .from('ejercicios')
      .select('id, nombre, grupo_muscular, tipo, descripcion, foto_url, video_url, video_tipo, dificultad_nivel, equipamiento, musculos_secundarios')
      .order('nombre')
      .limit(100)

    if (query.trim()) q = q.ilike('nombre', `%${query.trim()}%`)
    if (grupo) q = q.eq('grupo_muscular', grupo)

    const { data } = await q
    setEjercicios(data ?? [])
    setLoading(false)
  }

  function toggleExpand(id: string, ej: Ejercicio) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
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
          }
        }))
      }
    }
  }

  function updateField(id: string, field: string, value: unknown) {
    setForm(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  function toggleEquip(id: string, opt: string) {
    const cur = (form[id]?.equipamiento ?? []) as string[]
    const next = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt]
    updateField(id, 'equipamiento', next)
  }

  async function saveEjercicio(id: string) {
    setSaving(id)
    const updates = form[id] ?? {}
    const res = await fetch(`/api/ejercicios/${id}/media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setSaving(null)
    if (res.ok) {
      setSaved(id)
      setTimeout(() => setSaved(null), 2000)
      setEjercicios(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    }
  }

  const hasMedia = (e: Ejercicio) => !!(e.foto_url || e.video_url)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Librería de ejercicios</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Gestiona fotos, vídeos y dificultad de cada ejercicio</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar ejercicio…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            className="input search-input w-full text-sm"
          />
        </div>
        <select
          value={grupo}
          onChange={e => setGrupo(e.target.value)}
          className="input text-sm"
          style={{ minWidth: 130 }}
        >
          <option value="">Todos los grupos</option>
          {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Stats */}
      {!loading && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {ejercicios.filter(hasMedia).length}/{ejercicios.length} con media
        </p>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : (
        <div className="space-y-2">
          {ejercicios.map(ej => (
            <div key={ej.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              {/* Row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggleExpand(ej.id, ej)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ej.nombre}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {ej.grupo_muscular || '—'} · {ej.tipo || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {ej.video_url && <Video size={14} className="text-purple-400" />}
                  {ej.foto_url && <ImageIcon size={14} className="text-blue-400" />}
                  {ej.dificultad_nivel && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                      {'★'.repeat(ej.dificultad_nivel)}
                    </span>
                  )}
                </div>
                {expandedId === ej.id ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
              </button>

              {/* Editor expandido */}
              {expandedId === ej.id && (
                <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
                  {/* Foto URL */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>URL Foto</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={(form[ej.id]?.foto_url ?? '') as string}
                      onChange={e => updateField(ej.id, 'foto_url', e.target.value)}
                      autoComplete="off"
                      className="input w-full text-sm"
                    />
                    {form[ej.id]?.foto_url && (
                      <img src={form[ej.id]!.foto_url as string} alt="" className="mt-1 rounded-lg h-28 object-cover w-full" />
                    )}
                  </div>

                  {/* Video URL */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>URL Vídeo (YouTube, Vimeo, etc.)</label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/..."
                      value={(form[ej.id]?.video_url ?? '') as string}
                      onChange={e => updateField(ej.id, 'video_url', e.target.value)}
                      autoComplete="off"
                      className="input w-full text-sm"
                    />
                  </div>

                  {/* Dificultad */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Dificultad</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => updateField(ej.id, 'dificultad_nivel', n)}
                          className="w-9 h-9 rounded-lg text-sm font-medium border transition-colors"
                          style={{
                            borderColor: (form[ej.id]?.dificultad_nivel ?? 0) === n ? 'var(--accent)' : 'var(--border)',
                            background: (form[ej.id]?.dificultad_nivel ?? 0) === n ? 'var(--accent)' : 'transparent',
                            color: (form[ej.id]?.dificultad_nivel ?? 0) === n ? '#fff' : 'var(--text)',
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Equipamiento */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Equipamiento</label>
                    <div className="flex flex-wrap gap-1.5">
                      {EQUIPAMIENTO_OPTS.map(opt => {
                        const selected = ((form[ej.id]?.equipamiento ?? []) as string[]).includes(opt)
                        return (
                          <button
                            key={opt}
                            onClick={() => toggleEquip(ej.id, opt)}
                            className="px-2.5 py-1 rounded-full text-xs border transition-colors"
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

                  {/* Músculos secundarios */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Músculos secundarios (separados por coma)</label>
                    <input
                      type="text"
                      placeholder="Ej: Core, Glúteos"
                      value={((form[ej.id]?.musculos_secundarios ?? []) as string[]).join(', ')}
                      onChange={e => updateField(ej.id, 'musculos_secundarios', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      autoComplete="off"
                      className="input w-full text-sm"
                    />
                  </div>

                  {/* Guardar */}
                  <button
                    onClick={() => saveEjercicio(ej.id)}
                    disabled={saving === ej.id}
                    className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
                  >
                    {saving === ej.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : saved === ej.id ? (
                      '✓ Guardado'
                    ) : (
                      <><Save size={14} /> Guardar</>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}

          {ejercicios.length === 0 && (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
              No se encontraron ejercicios
            </p>
          )}
        </div>
      )}
    </div>
  )
}
