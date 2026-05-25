'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ImageOff,
  Images,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'

type FiltroImagen = 'pendientes' | 'sin_imagen' | 'sospechosas' | 'ai' | 'scraped' | 'aprobadas' | 'rechazadas' | 'todas'

type RecetaImagen = {
  id: string
  nombre: string
  descripcion?: string | null
  imagen_url?: string | null
  categoria?: string | null
  tipo_plato?: string | null
  estado?: string | null
  fuente_tipo?: string | null
  url_origen?: string | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  premium_chef?: boolean | null
  objetivos?: string[] | null
  deportes?: string[] | null
  momentos?: string[] | null
  estilos?: string[] | null
  imagen_origen?: string | null
  imagen_estado?: string | null
  imagen_quality_score?: number | null
  imagen_realismo_score?: number | null
  imagen_match_receta_score?: number | null
  imagen_needs_review?: boolean | null
  imagen_review_notes?: string | null
  imagen_estilo_preset?: string | null
  created_at?: string | null
}

type ImagenesResponse = {
  recetas: RecetaImagen[]
  stats: {
    total: number
    pendientes: number
    sin_imagen: number
    ai: number
    scraped: number
    aprobadas: number
    sospechosas: number
  }
  filtro: FiltroImagen
}

const filtros: Array<{ id: FiltroImagen; label: string; detail: string; icon: React.ElementType }> = [
  { id: 'pendientes', label: 'Pendientes', detail: 'Requieren ojo humano', icon: AlertTriangle },
  { id: 'sospechosas', label: 'Sospechosas', detail: 'Baja calidad o realismo', icon: ShieldCheck },
  { id: 'sin_imagen', label: 'Sin imagen', detail: 'Necesitan asset', icon: ImageOff },
  { id: 'ai', label: 'IA', detail: 'Riesgo de aspecto artificial', icon: Sparkles },
  { id: 'scraped', label: 'Scrapeadas', detail: 'Fuente real', icon: Images },
  { id: 'aprobadas', label: 'Aprobadas', detail: 'Listas para cliente', icon: CheckCircle2 },
  { id: 'rechazadas', label: 'Rechazadas', detail: 'No usar', icon: XCircle },
  { id: 'todas', label: 'Todas', detail: 'Vista completa', icon: Search },
]

function scoreColor(score?: number | null) {
  const value = Number(score ?? 0)
  if (value >= 75) return '#059669'
  if (value >= 55) return '#d97706'
  return '#dc2626'
}

function origenLabel(value?: string | null) {
  if (value === 'scraped') return 'real/scraped'
  if (value === 'uploaded') return 'subida'
  if (value === 'ai') return 'IA'
  if (value === 'missing') return 'sin imagen'
  return 'desconocida'
}

function ImagenCard({
  receta,
  onUpdate,
}: {
  receta: RecetaImagen
  onUpdate: (id: string, patch: Partial<RecetaImagen>) => Promise<void>
}) {
  const [notes, setNotes] = useState(receta.imagen_review_notes ?? '')
  const [saving, setSaving] = useState(false)
  const quality = receta.imagen_quality_score ?? 0
  const realismo = receta.imagen_realismo_score ?? 0
  const match = receta.imagen_match_receta_score ?? 0

  async function act(patch: Record<string, unknown>) {
    setSaving(true)
    try {
      await onUpdate(receta.id, patch)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="grid gap-0 md:grid-cols-[260px_1fr]">
        <Link href={`/recetas/${receta.id}`} className="relative block min-h-[260px] bg-zinc-100">
          {receta.imagen_url ? (
            <img src={receta.imagen_url} alt={receta.nombre} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>
              <ImageOff size={34} />
              <span className="text-xs font-semibold">Sin imagen</span>
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.88)', color: '#1C1C1E' }}>
              {origenLabel(receta.imagen_origen)}
            </span>
            {receta.premium_chef && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.88)', color: '#1C1C1E' }}>
                Chef healthy
              </span>
            )}
          </div>
        </Link>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                {receta.categoria ?? receta.tipo_plato ?? 'Receta'} · {receta.imagen_estado ?? 'pendiente'}
              </p>
              <Link href={`/recetas/${receta.id}`} className="mt-1 block text-lg font-semibold leading-tight hover:underline" style={{ color: 'var(--text)' }}>
                {receta.nombre}
              </Link>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {receta.descripcion ?? 'Sin descripción corta.'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                disabled={saving}
                onClick={() => act({ imagen_estado: 'aprobada', imagen_quality_score: Math.max(quality, 82), imagen_realismo_score: Math.max(realismo, 82), imagen_match_receta_score: Math.max(match, 78), imagen_review_notes: notes })}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
                style={{ background: '#059669', color: '#fff' }}
              >
                <CheckCircle2 size={14} />
                Aprobar
              </button>
              <button
                disabled={saving}
                onClick={() => act({ imagen_estado: 'rechazada', imagen_needs_review: true, imagen_review_notes: notes || 'Rechazada visualmente: requiere sustituir o regenerar.' })}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-60"
                style={{ borderColor: 'rgba(220,38,38,0.3)', color: '#dc2626', background: 'rgba(220,38,38,0.08)' }}
              >
                <XCircle size={14} />
                Rechazar
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['Calidad', quality],
              ['Realismo', realismo],
              ['Coincide', match],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: scoreColor(Number(value)) }}>{Number(value) || 0}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`, background: scoreColor(Number(value)) }} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas visuales: parece IA, mala luz, no coincide con ingredientes, recorte raro..."
              className="min-h-[74px] resize-none rounded-xl border p-3 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <button
              disabled={saving}
              onClick={() => act({ imagen_estado: 'revisar', imagen_needs_review: true, imagen_review_notes: notes })}
              className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
            >
              Guardar nota
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function RecetasImagenesPage() {
  const [data, setData] = useState<ImagenesResponse | null>(null)
  const [filtro, setFiltro] = useState<FiltroImagen>('pendientes')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(nextFiltro = filtro) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ filtro: nextFiltro, limit: '120' })
      if (query.trim()) params.set('q', query.trim())
      const res = await fetch(`/api/recetas/imagenes?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar revisión visual')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(filtro)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  async function updateRecipe(id: string, patch: Partial<RecetaImagen>) {
    const res = await fetch(`/api/recetas/${id}/imagen`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'No se pudo actualizar la imagen')
    await load(filtro)
  }

  const stats = data?.stats
  const cards = useMemo(() => data?.recetas ?? [], [data])

  return (
    <main className="min-h-screen layout-main p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              <Images size={16} />
              Recetario inteligente
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: 'var(--text)' }}>
              Control visual de recetas
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed md:text-base" style={{ color: 'var(--text-muted)' }}>
              Revisa qué imágenes parecen reales, cuáles son sospechosas y cuáles necesitan sustitución antes de llegar a la app del cliente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load(filtro)}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
            >
              <RefreshCw size={15} />
              Actualizar
            </button>
            <Link
              href="/recetas/cobertura"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              <ChefHat size={15} />
              Cobertura
            </Link>
          </div>
        </header>

        {stats && (
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ['Pendientes', stats.pendientes],
              ['Sospechosas', stats.sospechosas],
              ['Sin imagen', stats.sin_imagen],
              ['IA', stats.ai],
              ['Reales', stats.scraped],
              ['Aprobadas', stats.aprobadas],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-2xl border p-3 md:p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {filtros.map(item => {
                const Icon = item.icon
                const active = filtro === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setFiltro(item.id)}
                    className="flex min-h-[74px] items-start gap-2 rounded-xl border p-2 text-left transition-transform active:scale-[0.98]"
                    style={active
                      ? { borderColor: 'rgba(163,230,53,0.42)', background: 'rgba(163,230,53,0.10)', color: '#A3E635' }
                      : { borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    <Icon size={15} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-xs font-semibold leading-tight">{item.label}</span>
                      <span className="mt-1 block text-[11px] leading-tight" style={{ color: active ? '#A3E635' : 'var(--text-muted)' }}>{item.detail}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') load(filtro) }}
                placeholder="Buscar receta por nombre"
                className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </div>
            <button
              onClick={() => load(filtro)}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              Buscar
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={18} />
              Cargando revisión visual
            </div>
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <Images className="mx-auto" size={34} style={{ color: 'var(--text-muted)' }} />
            <p className="mt-3 text-base font-semibold" style={{ color: 'var(--text)' }}>No hay recetas en este filtro</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Cambia de filtro o busca otra receta.</p>
          </div>
        ) : (
          <section className="space-y-4">
            {cards.map(receta => (
              <ImagenCard key={receta.id} receta={receta} onUpdate={updateRecipe} />
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
