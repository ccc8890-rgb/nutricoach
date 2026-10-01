'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Clock, Loader2, AlertTriangle, UtensilsCrossed, PlayCircle } from 'lucide-react'
import { MacroRing } from '@/components/premium/MacroRing'
import { IngredientChecklist } from '@/components/premium/IngredientChecklist'
import { StepByStep } from '@/components/premium/StepByStep'

interface RecetaDetalle {
  id: string
  nombre: string
  imagen_url?: string | null
  descripcion?: string | null
  instrucciones?: string | null
  url_origen?: string | null
  consejos?: string | null
  porciones?: number
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  tiempo_prep_min?: number | null
}

interface IngredienteConAlimento {
  id: string
  nombre_libre?: string | null
  cantidad_gramos: number
  alimento?: { nombre: string } | null
}

/** Copia local de app/recetas/[id]/page.tsx — mismo parseo, sin las
 * dependencias de coach de esa página (quality gate, edición, precios). */
function parsePasos(text: string | null | undefined): { number: number; content: string; title?: string }[] {
  if (!text) return []
  const lines = text.split('\n').filter(l => l.trim())
  const numbered = lines.filter(l => /^\s*(?:Paso\s*)?\d+[.)\-:]/.test(l))
  if (numbered.length >= 2) {
    return numbered.map((l, i) => {
      const clean = l.replace(/^\s*(?:Paso\s*)?\d+[.)\-:]\s*/, '').trim()
      const colonIdx = clean.indexOf(':')
      if (colonIdx > 0 && colonIdx < 40) {
        return { number: i + 1, title: clean.slice(0, colonIdx).trim(), content: clean.slice(colonIdx + 1).trim() }
      }
      return { number: i + 1, content: clean }
    })
  }
  return lines.map((l, i) => ({ number: i + 1, content: l.trim() }))
}

export default function RecetaClientePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const codigo = searchParams.get('codigo')
  const returnTo = searchParams.get('returnTo') || '/cliente'

  const [receta, setReceta] = useState<RecetaDetalle | null>(null)
  const [ingredientes, setIngredientes] = useState<IngredienteConAlimento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!codigo) { setError('Falta el código del plan.'); setLoading(false); return }
    fetch(`/api/cliente/${codigo}/recetas/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar la receta.')
        return r.json()
      })
      .then(data => {
        setReceta(data.receta)
        setIngredientes(data.ingredientes ?? [])
      })
      .catch(() => setError('No se pudo cargar la receta.'))
      .finally(() => setLoading(false))
  }, [codigo, id])

  const pasos = parsePasos(receta?.instrucciones)
  const ingredientesFormato = ingredientes.map(ing => ({
    id: ing.id,
    nombre: ing.alimento?.nombre ?? ing.nombre_libre ?? 'Ingrediente',
    cantidad: `${ing.cantidad_gramos}g`,
  }))

  return (
    <div className="min-h-screen pb-8" style={{ background: 'var(--bg)' }}>
      <div
        className="sticky top-0 z-10 px-4 pt-safe pb-3"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <Link
            href={returnTo}
            replace
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </Link>
          <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{receta?.nombre ?? 'Receta'}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-4 pt-4 flex flex-col gap-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : error || !receta ? (
          <div className="rounded-3xl p-5 flex items-center gap-2 text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--semantic-alert)' }} />
            {error || 'Receta no encontrada.'}
          </div>
        ) : (
          <>
            <div className="w-full aspect-square rounded-3xl overflow-hidden" style={{ background: 'var(--surface)' }}>
              {receta.imagen_url ? (
                <Image src={receta.imagen_url} alt={receta.nombre} width={512} height={512} className="w-full h-full object-cover" priority />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UtensilsCrossed size={40} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
            </div>

            <div>
              <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{receta.nombre}</h1>
              {receta.descripcion && (
                <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>{receta.descripcion}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {receta.tiempo_prep_min ? (
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {receta.tiempo_prep_min} min</span>
                ) : null}
                {receta.porciones ? <span>{receta.porciones} {receta.porciones === 1 ? 'porción' : 'porciones'}</span> : null}
              </div>
              {/* Solo llega si el coach ha activado el vídeo para este cliente */}
              {receta.url_origen && /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/.test(receta.url_origen) && (
                <a href={receta.url_origen} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <PlayCircle size={15} /> Ver vídeo original
                </a>
              )}
            </div>

            <div className="flex justify-center py-2">
              <MacroRing
                kcal={receta.kcal ?? 0}
                proteinas={receta.proteinas ?? 0}
                carbohidratos={receta.carbohidratos ?? 0}
                grasas={receta.grasas ?? 0}
              />
            </div>

            {ingredientesFormato.length > 0 && (
              <IngredientChecklist ingredientes={ingredientesFormato} />
            )}

            {pasos.length > 0 && <StepByStep pasos={pasos} />}

            {receta.consejos && (
              <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Consejos</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{receta.consejos}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
