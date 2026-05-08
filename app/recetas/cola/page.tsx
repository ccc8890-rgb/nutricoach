'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Globe, CheckCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Receta {
  id: string
  nombre: string
  imagen_url?: string | null
  fuente_tipo?: string | null
  autor_original?: string | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  categoria?: string | null
  created_at: string
  estado: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const created = new Date(dateStr).getTime()
  const diffMs = now - created
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'hoy'
  if (diffDays === 1) return 'ayer'
  if (diffDays < 7) return `hace ${diffDays} días`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks === 1) return 'hace 1 semana'
  return `hace ${diffWeeks} semanas`
}

function FuenteBadge({ fuente }: { fuente?: string | null }) {
  if (!fuente) return null
  let bg = ''
  let text = ''
  let icon = null
  switch (fuente) {
    case 'instagram':
      bg = '#FDF2F8'
      text = '#BE185D'
      icon = <Globe size={12} />
      break
    case 'tiktok':
      bg = '#1a1a1a'
      text = '#ffffff'
      icon = <Globe size={12} />
      break
    case 'youtube':
      bg = '#FF0000'
      text = '#ffffff'
      icon = <Globe size={12} />
      break
    case 'web':
      bg = '#e5e7eb'
      text = '#6b7280'
      icon = <Globe size={12} />
      break
    case 'ia_generada':
      bg = 'var(--primary-bg)'
      text = 'var(--primary)'
      icon = <Globe size={12} />
      break
    default:
      bg = '#e5e7eb'
      text = '#6b7280'
      icon = <Globe size={12} />
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bg, color: text }}
    >
      {icon}
      {fuente}
    </span>
  )
}

function MacroBadge({ label, value }: { label: string; value?: number | null }) {
  if (!value || value <= 0) return null
  return (
    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
      {label} {value}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="h-36 rounded-t-xl bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-5 w-12 rounded bg-gray-200" />
          <div className="h-5 w-12 rounded bg-gray-200" />
          <div className="h-5 w-12 rounded bg-gray-200" />
        </div>
        <div className="flex gap-2 pt-2">
          <div className="h-8 flex-1 rounded bg-gray-200" />
          <div className="h-8 flex-1 rounded bg-gray-200" />
          <div className="h-8 w-16 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default function ColaPage() {
  const { addToast } = useToast()
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [orden, setOrden] = useState<'reciente' | 'antiguo'>('reciente')

  const fetchRecetas = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('recetas')
      .select('*')
      .eq('coach_id', user.id)
      .in('estado', ['borrador', 'en_revision'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
    } else {
      setRecetas(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRecetas()
  }, [fetchRecetas])

  const handleEstado = async (id: string, nuevoEstado: string) => {
    setLoadingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/recetas/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!res.ok) {
        console.error('Error al cambiar estado')
        return
      }
      // Quitar la card con animación
      const card = document.getElementById(`receta-card-${id}`)
      if (card) {
        card.style.transition = 'opacity 300ms, height 300ms'
        card.style.opacity = '0'
        card.style.height = '0'
        card.style.overflow = 'hidden'
        setTimeout(() => {
          setRecetas((prev) => prev.filter((r) => r.id !== id))
        }, 300)
      } else {
        setRecetas((prev) => prev.filter((r) => r.id !== id))
      }
    } catch (err) {
      console.error(err)
      addToast({ type: 'error', title: 'Error', message: 'No se pudo cambiar el estado' })
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="p-6" style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
        <div className="mb-6">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  // Filtrar por fecha y ordenar
  const recetasFiltradas = recetas
    .filter(r => {
      if (!fechaDesde && !fechaHasta) return true
      if (!r.created_at) return !fechaDesde && !fechaHasta
      const f = new Date(r.created_at)
      if (fechaDesde && f < new Date(fechaDesde)) return false
      if (fechaHasta && f > new Date(fechaHasta + 'T23:59:59')) return false
      return true
    })
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime()
      const db = new Date(b.created_at).getTime()
      return orden === 'reciente' ? db - da : da - db
    })

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Cola de revisión
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {recetasFiltradas.length} recetas pendientes
            </p>
          </div>
          <Link
            href="/recetas"
            className="inline-block text-sm underline"
            style={{ color: 'var(--primary)' }}
          >
            ← Volver al recetario
          </Link>
        </div>

        {/* Filtro por fecha + ordenación */}
        <div className="flex items-center gap-3 text-sm flex-wrap mt-4">
          <span style={{ color: 'var(--text-secondary)' }}>Creada entre</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="input text-xs py-1 px-2 rounded border max-w-[150px]"
            style={{ color: 'var(--text)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>y</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="input text-xs py-1 px-2 rounded border max-w-[150px]"
            style={{ color: 'var(--text)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          />
          {(fechaDesde || fechaHasta) && (
            <button
              onClick={() => { setFechaDesde(''); setFechaHasta('') }}
              className="text-xs underline hover:no-underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Limpiar
            </button>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <span style={{ color: 'var(--text-muted)' }}>Ordenar</span>
            <select
              value={orden}
              onChange={e => setOrden(e.target.value as 'reciente' | 'antiguo')}
              className="input text-xs py-1 px-2 rounded border"
              style={{ color: 'var(--text)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <option value="reciente">Más reciente</option>
              <option value="antiguo">Más antiguo</option>
            </select>
          </div>
        </div>
      </div>

      {recetasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle size={64} style={{ color: 'var(--primary)' }} />
          <p className="mt-4 text-lg font-medium" style={{ color: 'var(--text)' }}>
            Todo al día — no hay recetas pendientes
          </p>
          <Link
            href="/recetas/nueva"
            className="mt-4 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Crear nueva receta
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recetasFiltradas.map((receta) => {
            const isPending = loadingIds.has(receta.id)
            return (
              <div
                key={receta.id}
                id={`receta-card-${receta.id}`}
                className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--surface)',
                }}
              >
                {/* Imagen */}
                {receta.imagen_url ? (
                  <img
                    src={receta.imagen_url}
                    alt={receta.nombre}
                    className="h-36 w-full object-cover"
                  />
                ) : (
                  <div
                    className="h-36 w-full flex items-center justify-center text-4xl"
                    style={{ backgroundColor: 'var(--surface)' }}
                  >
                    🍽️
                  </div>
                )}

                {/* Contenido */}
                <div className="p-4 space-y-2">
                  {/* Badge fuente */}
                  <div className="flex items-center gap-2">
                    <FuenteBadge fuente={receta.fuente_tipo} />
                    {receta.categoria && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: 'var(--primary-bg)',
                          color: 'var(--primary)',
                        }}
                      >
                        {receta.categoria}
                      </span>
                    )}
                  </div>

                  {/* Nombre */}
                  <h3
                    className="font-semibold text-base leading-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    {receta.nombre}
                  </h3>

                  {/* Autor original */}
                  {receta.autor_original && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {receta.autor_original}
                    </p>
                  )}

                  {/* Macros */}
                  <div className="flex flex-wrap gap-1">
                    <MacroBadge label="Kcal" value={receta.kcal} />
                    <MacroBadge label="P" value={receta.proteinas} />
                    <MacroBadge label="C" value={receta.carbohidratos} />
                    <MacroBadge label="G" value={receta.grasas} />
                  </div>

                  {/* Fecha */}
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(receta.created_at)}
                  </p>

                  {/* Acciones */}
                  <div className="flex gap-2 pt-2">
                    <button
                      disabled={isPending}
                      onClick={() => handleEstado(receta.id, 'aprobada')}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        '✓'
                      )}{' '}
                      Aprobar
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleEstado(receta.id, 'descartada')}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: '#EF4444' }}
                    >
                      {isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        '✗'
                      )}{' '}
                      Descartar
                    </button>
                    <Link
                      href={`/recetas/${receta.id}`}
                      className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
                      style={{
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      → Ver
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
