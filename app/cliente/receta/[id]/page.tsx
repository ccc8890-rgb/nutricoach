'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { fetchJson, claveReceta } from '@/lib/cliente/cache-swr'
import { propsImagenReceta } from '@/lib/cliente/imagen-receta'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Clock, Loader2, AlertTriangle, UtensilsCrossed, PlayCircle } from 'lucide-react'
import { MacroRing } from '@/components/premium/MacroRing'
import { IngredientChecklist } from '@/components/premium/IngredientChecklist'
import { StepByStep } from '@/components/premium/StepByStep'
import type { Racion } from '@/lib/nutricion/racion'
import { quitarCifras } from '@/lib/nutricion/quitar-cifras'
import { SelectorRaciones, escalarGramos } from '@/components/premium/SelectorRaciones'

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

// Las cantidades de los pasos son las de la receta ENTERA (p. ej. «1 kg de carne» para 5 raciones) y no
// coinciden con la ración del cliente: se quitan y se remite a su lista de ingredientes.
export default function RecetaClientePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const codigo = searchParams.get('codigo')
  const returnTo = searchParams.get('returnTo') || '/cliente'

  const [cocinarPara, setCocinarPara] = useState(1)
  const [racionesVista, setRacionesVista] = useState<number | null>(null)
  // Caché compartida con el portal (persistente): al reabrir una receta el detalle y la foto salen al instante.
  // `montado` evita desajuste de hidratación: la caché solo existe en el cliente.
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const { data, error: errorSwr, isLoading } = useSWR<{
    receta: RecetaDetalle
    ingredientes?: IngredienteConAlimento[]
    racion?: Racion | null
  }>(codigo ? claveReceta(codigo, id, searchParams.get('comida')) : null, fetchJson)
  const receta = data?.receta ?? null
  const ingredientes = data?.ingredientes ?? []
  const racion = data?.racion ?? null
  const loading = !montado || (Boolean(codigo) && isLoading && !data)
  const error = !codigo ? 'Falta el código del plan.' : errorSwr ? 'No se pudo cargar la receta.' : ''

  const porciones = Math.max(1, Number(receta?.porciones ?? 1))
  const k = racion ? cocinarPara : 1
  // Con ración: la lista es la del cliente (cantidades ya escaladas a su comida), multiplicada si cocina varias
  // Sin ración de un plan (recetario): el cliente elige para cuántas raciones cocina y se recalcula
  const nVista = racionesVista ?? porciones
  const factorVista = nVista / porciones
  const ingredientesFormato = racion
    ? racion.plato.ingredientes.map((ing, i) => ({ id: `r${i}`, nombre: ing.nombre, cantidad: `${Math.round(ing.gramos * k)}g` }))
    : ingredientes.map(ing => ({
        id: ing.id,
        nombre: ing.alimento?.nombre ?? ing.nombre_libre ?? 'Ingrediente',
        cantidad: `${escalarGramos(ing.cantidad_gramos, factorVista)}g`,
      }))
  const cantidadesDistintas = racion
    ? porciones > 1 || (receta?.kcal ? Math.abs(racion.plato.kcal / receta.kcal - 1) > 0.1 : false)
    : nVista !== porciones
  const pasos = parsePasos(receta?.instrucciones).map(p => cantidadesDistintas ? { ...p, content: quitarCifras(p.content), title: p.title ? quitarCifras(p.title) : p.title } : p)

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
                <Image {...propsImagenReceta(receta.imagen_url, receta.nombre)} className="w-full h-full object-cover" priority />
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

            {racion ? (
              <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tu ración · {racion.franja}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text)' }}>{racion.total.kcal} <span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>kcal</span></p>
                <p className="text-sm mt-1 font-data" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#30D158' }}>P {racion.total.p} g</span> · <span style={{ color: '#FF9F0A' }}>C {racion.total.c} g</span> · <span style={{ color: '#64D2FF' }}>G {racion.total.g} g</span>
                </p>
                {racion.complementos.length > 0 && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Incluye el plato ({racion.plato.kcal} kcal) y, además: {racion.complementos.map(c => `${c.nombre} ${c.gramos} g`).join(', ')}.
                  </p>
                )}
                {porciones > 1 && (
                  <p className="text-sm mt-3" style={{ color: 'var(--text)' }}>
                    Esta receta está pensada para <strong>{porciones} raciones</strong>. Tú comes <strong>1 ración</strong>: la lista de ingredientes de abajo ya es la tuya.
                  </p>
                )}
                {porciones > 1 && (
                  <div className="mt-3">
                    <p className="text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>¿Cuánto vas a cocinar?</p>
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      {[1, porciones].map(n => (
                        <button key={n} onClick={() => setCocinarPara(n)} className="flex-1 px-3 py-2 text-xs font-semibold"
                          style={{ background: cocinarPara === n ? 'var(--primary)' : 'transparent', color: cocinarPara === n ? 'var(--bg)' : 'var(--text-muted)' }}>
                          {n === 1 ? 'Solo mi ración' : `${n} raciones (batch cooking)`}
                        </button>
                      ))}
                    </div>
                    {cocinarPara > 1 && (
                      <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                        Te salen {cocinarPara} raciones iguales a la tuya: come 1 y guarda las otras {cocinarPara - 1} en táper (nevera o congelador).
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-center py-2">
                  <MacroRing
                    kcal={receta.kcal ?? 0}
                    proteinas={receta.proteinas ?? 0}
                    carbohidratos={receta.carbohidratos ?? 0}
                    grasas={receta.grasas ?? 0}
                  />
                </div>
                <p className="text-center text-[11px] -mt-1" style={{ color: 'var(--text-muted)' }}>Valores por ración</p>
                <SelectorRaciones original={porciones} valor={nVista} onChange={setRacionesVista} kcalRacion={receta.kcal} />
              </>
            )}

            {ingredientesFormato.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  {racion ? `Cantidades para ${k === 1 ? 'tu ración' : `${k} raciones`}.` : `Cantidades para ${nVista} ${nVista === 1 ? 'ración' : 'raciones'}.`}
                </p>
                <IngredientChecklist ingredientes={ingredientesFormato} />
              </div>
            )}

            {cantidadesDistintas && pasos.length > 0 && (
              <p className="text-xs rounded-2xl px-4 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                Los pasos no llevan cantidades: usa siempre las de la lista de ingredientes de arriba, que están ajustadas {racion ? 'a tu ración' : `a ${nVista} ${nVista === 1 ? 'ración' : 'raciones'}`}.
              </p>
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
