'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { fetchJson, claveReceta } from '@/lib/cliente/cache-swr'
import FotoReceta from '@/components/PortalCliente/FotoReceta'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertTriangle, UtensilsCrossed, PlayCircle } from '@/components/icons/lucide'
import { BotonFavorita } from '@/components/PortalCliente/BotonFavorita'
import MacroTriangulo from '@/components/PortalCliente/MacroTriangulo'
import { IngredientChecklist } from '@/components/premium/IngredientChecklist'
import { StepByStep } from '@/components/premium/StepByStep'
import type { Racion } from '@/lib/nutricion/racion'
import { parsePasos, ordenarPorFases } from '@/lib/recetas/pasos'
import { quitarCifras } from '@/lib/nutricion/quitar-cifras'
import { formatoCantidad } from '@/lib/recetas/equivalencia'
import CompartirSesion from '@/components/training/CompartirSesion'
import { dibujarPlatoTernario } from '@/lib/entrenos/tarjeta-story'
import { SelectorRaciones } from '@/components/premium/SelectorRaciones'
import { resumenAptitud } from '@/lib/recetas-constants'

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
  categoria?: string | null
  tipo_coccion?: string | null
  dificultad?: string | null
  intolerancias?: string[] | null
}

interface IngredienteConAlimento {
  id: string
  nombre_libre?: string | null
  elaboracion_id?: string | null
  cantidad_gramos: number
  cantidad_original?: number | null
  unidad_display?: string | null
  grupo?: string | null
  es_opcional?: boolean | null
  alimento?: { nombre: string } | null
}

/** Copia local de app/recetas/[id]/page.tsx — mismo parseo, sin las
 * dependencias de coach de esa página (quality gate, edición, precios). */
// Las cantidades de los pasos son las de la receta ENTERA (p. ej. «1 kg de carne» para 5 raciones) y no
// coinciden con la ración del cliente: se quitan y se remite a su lista de ingredientes.
export default function RecetaClientePage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const codigo = searchParams.get('codigo')
  const returnTo = searchParams.get('returnTo') || '/cliente'

  const [cocinarPara, setCocinarPara] = useState(1)
  const [racionesVista, setRacionesVista] = useState<number | null>(null)
  const [seccion, setSeccion] = useState<'ingredientes' | 'preparacion'>('ingredientes')
  // Caché compartida con el portal (persistente): al reabrir una receta el detalle y la foto salen al instante.
  // `montado` evita desajuste de hidratación: la caché solo existe en el cliente.
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const { data, error: errorSwr, isLoading } = useSWR<{
    receta: RecetaDetalle
    ingredientes?: IngredienteConAlimento[]
    racion?: Racion | null
    salsas?: { id: string; nombre: string; kcal: number | null }[]
  }>(codigo ? claveReceta(codigo, id, searchParams.get('comida')) : null, fetchJson)
  const receta = data?.receta ?? null
  const ingredientes = data?.ingredientes ?? []
  const racion = data?.racion ?? null
  const salsas = data?.salsas ?? []
  const loading = !montado || (Boolean(codigo) && isLoading && !data)
  const error = !codigo ? 'Falta el código del plan.' : errorSwr ? 'No se pudo cargar la receta.' : ''

  const porciones = Math.max(1, Number(receta?.porciones ?? 1))
  const k = racion ? cocinarPara : 1
  // Con ración: la lista es la del cliente (cantidades ya escaladas a su comida), multiplicada si cocina varias
  // Sin ración de un plan (recetario): el cliente elige para cuántas raciones cocina y se recalcula
  const nVista = racionesVista ?? porciones
  const factorVista = nVista / porciones
  // Con «tu ración» la lista viene del plan (sin fase): la fase se recupera por el nombre del ingrediente de la receta
  const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const grupoPorNombre = new Map<string, string>()
  for (const ing of ingredientes) {
    if (!ing.grupo) continue
    for (const n of [ing.alimento?.nombre, ing.nombre_libre]) if (n) grupoPorNombre.set(normalizar(n), ing.grupo)
  }
  const ingredientesBase = racion
    ? racion.plato.ingredientes.map((ing, i) => ({ id: `r${i}`, nombre: ing.nombre, cantidad: `${Math.round(ing.gramos * k)}g`, grupo: grupoPorNombre.get(normalizar(ing.nombre)) ?? null }))
    : ingredientes.map(ing => ({
        id: ing.id,
        nombre: ing.es_opcional ? (ing.nombre_libre ?? ing.alimento?.nombre ?? 'Ingrediente') : (ing.alimento?.nombre ?? ing.nombre_libre ?? 'Ingrediente'),
        opcional: Boolean(ing.es_opcional),
        cantidad: formatoCantidad(ing.cantidad_gramos, factorVista, ing.cantidad_original, ing.unidad_display, ing.alimento?.nombre ?? ing.nombre_libre),
        grupo: ing.grupo ?? null,
        // Elaboración enlazada (masa, salsa…): el nombre abre su preparación
        href: ing.elaboracion_id ? `/cliente/receta/${ing.elaboracion_id}` : undefined,
      }))
  const ingredientesFormato = ordenarPorFases(ingredientesBase, parsePasos(receta?.instrucciones))
  const cantidadesDistintas = racion
    ? porciones > 1 || (receta?.kcal ? Math.abs(racion.plato.kcal / receta.kcal - 1) > 0.1 : false)
    : nVista !== porciones
  const pasos = parsePasos(receta?.instrucciones).map(p => cantidadesDistintas ? { ...p, content: quitarCifras(p.content), title: p.title ? quitarCifras(p.title) : p.title } : p)

  // Datos de la receta en el mismo lenguaje editorial que el coach, en versión corta para móvil
  const { aptaPara, contiene } = resumenAptitud(receta?.intolerancias)
  const datosReceta = ([['Plato', receta?.categoria], ['Cocción', receta?.tipo_coccion], ['Dificultad', receta?.dificultad]] as const).filter(([, v]) => Boolean(v)) as unknown as [string, string][]
  const rotulo = 'font-data text-[10px] font-medium uppercase tracking-[0.14em]'
  const linea = { borderColor: 'var(--editorial-rule, var(--border))' }
  const punto = (color: string) => <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} aria-hidden />
  const datosFicha = (datosReceta.length > 0 || aptaPara.length > 0 || contiene.length > 0) ? (
    <dl className="flex flex-col divide-y border-y text-sm" style={{ ...linea, color: 'var(--text-secondary)' }}>
      {datosReceta.length > 0 && (
        <div className="flex gap-x-6 py-2.5" style={linea}>
          {datosReceta.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex flex-col">
              <dt className={rotulo} style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{etiqueta}</dt>
              <dd className="mt-0.5">{valor}</dd>
            </div>
          ))}
        </div>
      )}
      {aptaPara.length > 0 && (
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3 py-2.5" style={linea}>
          <dt className={rotulo} style={{ color: 'var(--text-muted)' }}>Apta para</dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1">{aptaPara.map(t => <span key={t}>{punto('rgb(34,197,94)')}{t}</span>)}</dd>
        </div>
      )}
      {contiene.length > 0 && (
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3 py-2.5" style={linea}>
          <dt className={rotulo} style={{ color: 'var(--text-muted)' }}>Contiene</dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1">{contiene.map(t => <span key={t}>{punto('rgb(239,68,68)')}{t}</span>)}</dd>
        </div>
      )}
    </dl>
  ) : null

  return (
    <div className="client-recipe-editorial min-h-screen pb-8" style={{ background: 'var(--bg)' }}>
      <div
        className="cliente-cabecera-fija sticky top-0 z-10 px-4 pb-3"
        style={{
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
          <p className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: 'var(--text)' }}>{receta?.nombre ?? 'Receta'}</p>
          {receta && (
              <CompartirSesion icono generar={(tema) => dibujarPlatoTernario({
                nombre: receta.nombre,
                kcal: racion?.total.kcal ?? receta.kcal ?? 0,
                p: racion?.total.p ?? receta.proteinas ?? 0,
                c: racion?.total.c ?? receta.carbohidratos ?? 0,
                g: racion?.total.g ?? receta.grasas ?? 0,
                detalle: null,
              }, tema)} />
          )}
          {receta && codigo && (
            <BotonFavorita
              codigo={codigo}
              receta={{ id: receta.id, nombre: receta.nombre, imagen_url: receta.imagen_url ?? null, kcal: receta.kcal ?? null, proteinas: receta.proteinas ?? null, categoria: receta.categoria ?? null }}
              className="shrink-0 !h-10 !w-10"
            />
          )}
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
                <FotoReceta src={receta.imagen_url} alt={receta.nombre} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UtensilsCrossed size={40} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
            </div>

            <div>
              <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{receta.nombre}</h1>
              {/* Solo llega si el coach ha activado el vídeo para este cliente */}
              {receta.url_origen && /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/.test(receta.url_origen) && (
                <a href={receta.url_origen} target="_blank" rel="noopener noreferrer"
                  className="font-data mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                  style={{ color: 'var(--text-muted)' }}>
                  <PlayCircle size={14} /> Vídeo original
                </a>
              )}
            </div>

            {racion ? (
              <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tu ración · {racion.franja}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text)' }}>{racion.total.kcal} <span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>kcal</span></p>
                <div className="mt-3"><MacroTriangulo kcal={racion.total.kcal} p={racion.total.p} c={racion.total.c} g={racion.total.g} mostrarKcal={false} sinMarco /></div>
                {racion.complementos.length > 0 && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Incluye el plato ({racion.plato.kcal} kcal) y, además: {racion.complementos.map(c => `${c.nombre} ${c.gramos} g`).join(', ')}.
                  </p>
                )}
                {porciones > 1 && (
                  <div className="mt-3">
                    <p className="font-data mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Cocinar para</p>
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
                <MacroTriangulo kcal={receta.kcal ?? 0} p={receta.proteinas ?? 0} c={receta.carbohidratos ?? 0} g={receta.grasas ?? 0} />
                {datosFicha}
                <SelectorRaciones original={porciones} valor={nVista} onChange={setRacionesVista} kcalRacion={receta.kcal} />
              </>
            )}
            {racion && datosFicha}

            {(ingredientesFormato.length > 0 || pasos.length > 0) && (
              <div className="flex flex-col gap-3">
                {/* Una sola lista a la vez: la receta no se hace larguísima con scroll */}
                <div className="flex overflow-hidden" role="tablist" aria-label="Ingredientes o preparación" style={{ border: '1px solid var(--border)' }}>
                  {([
                    ['ingredientes', 'Ingredientes', ingredientesFormato.length],
                    ['preparacion', 'Preparación', pasos.length],
                  ] as const).filter(([, , n]) => n > 0).map(([clave, etiqueta]) => (
                    <button key={clave} role="tab" aria-selected={seccion === clave} onClick={() => setSeccion(clave)}
                      className="flex-1 px-3 py-2.5 text-xs font-semibold"
                      style={{ background: seccion === clave ? 'var(--primary)' : 'transparent', color: seccion === clave ? 'var(--bg)' : 'var(--text-muted)' }}>
                      {etiqueta}
                    </button>
                  ))}
                </div>

                {seccion === 'ingredientes' && ingredientesFormato.length > 0 && (
                  <div>
                    <IngredientChecklist ingredientes={ingredientesFormato} sinCabecera />
                  </div>
                )}

                {(seccion === 'preparacion' || ingredientesFormato.length === 0) && pasos.length > 0 && (
                  <>
                    {cantidadesDistintas && (
                      <p className="text-xs rounded-2xl px-4 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        Los pasos no llevan cantidades: usa siempre las de la lista de ingredientes, que están ajustadas {racion ? 'a tu ración' : `a ${nVista} ${nVista === 1 ? 'ración' : 'raciones'}`}.
                      </p>
                    )}
                    {receta.descripcion && (
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{receta.descripcion}</p>
                    )}
                    <StepByStep pasos={pasos} sinCabecera />
                  </>
                )}
              </div>
            )}

            {salsas.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>Va bien con</p>
                {salsas.map(s => (
                  <Link key={s.id} href={`/cliente/receta/${s.id}?codigo=${codigo}&returnTo=${encodeURIComponent(`/cliente/receta/${id}?codigo=${codigo}`)}`} prefetch={false}
                    className="flex items-center justify-between px-4 py-3 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <span>{s.nombre}</span>
                    {s.kcal ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.round(s.kcal)} kcal/ración</span> : null}
                  </Link>
                ))}
              </div>
            )}

            {receta.consejos && (seccion === 'preparacion' || ingredientesFormato.length === 0) && (
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
