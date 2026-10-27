// Capa «Estudio» de la ficha (cocina profesional): rendimiento, tiempos, mise en place, porcionado, conservación, equipo, variantes, origen.
// Se guarda en recetas.estudio (jsonb). Coste, alérgenos y dificultad NO se duplican aquí: ya existen en la ficha.

export const UNIDADES_RENDIMIENTO = ['g', 'ml', 'unidades', 'raciones'] as const
export type UnidadRendimiento = (typeof UNIDADES_RENDIMIENTO)[number]

export type Estudio = {
  rendimiento?: { cantidad: number; unidad: UnidadRendimiento }
  tiempo_activo_min?: number
  tiempo_total_min?: number
  mise_en_place?: string
  porcionado?: string
  conservacion?: { ambiente_h?: number; nevera_dias?: number; congelador_meses?: number; notas?: string }
  equipo?: string
  variantes?: string
  origen?: string
}

const MAX_TEXTO = 1000
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
const texto = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim().slice(0, MAX_TEXTO)
  return t || undefined
}

/** Se queda con lo válido de lo que venga de la base de datos o del formulario; devuelve {} si no hay nada aprovechable. */
export function validarEstudio(raw: unknown): Estudio {
  if (!esObjeto(raw)) return {}
  const e: Estudio = {}
  const r = raw.rendimiento
  if (esObjeto(r)) {
    const cantidad = numero(r.cantidad)
    if (cantidad !== undefined && cantidad > 0 && (UNIDADES_RENDIMIENTO as readonly unknown[]).includes(r.unidad)) e.rendimiento = { cantidad, unidad: r.unidad as UnidadRendimiento }
  }
  const activo = numero(raw.tiempo_activo_min); if (activo !== undefined) e.tiempo_activo_min = activo
  const total = numero(raw.tiempo_total_min); if (total !== undefined) e.tiempo_total_min = total
  for (const k of ['mise_en_place', 'porcionado', 'equipo', 'variantes', 'origen'] as const) { const t = texto(raw[k]); if (t) e[k] = t }
  if (esObjeto(raw.conservacion)) {
    const c = raw.conservacion
    const cons: NonNullable<Estudio['conservacion']> = {}
    const amb = numero(c.ambiente_h); if (amb !== undefined) cons.ambiente_h = amb
    const nev = numero(c.nevera_dias); if (nev !== undefined) cons.nevera_dias = nev
    const con = numero(c.congelador_meses); if (con !== undefined) cons.congelador_meses = con
    const notas = texto(c.notas); if (notas) cons.notas = notas
    if (Object.keys(cons).length) e.conservacion = cons
  }
  return e
}

export const estudioVacio = (e: Estudio | null | undefined): boolean => !e || Object.keys(e).length === 0

const formato = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: n >= 10 ? 0 : 1 })

/** Rendimiento para el número de raciones que se está viendo (el selector de la ficha escala todo igual). */
export function rendimientoEscalado(e: Estudio, factor: number): string | null {
  if (!e.rendimiento) return null
  return `${formato(e.rendimiento.cantidad * (factor > 0 ? factor : 1))} ${e.rendimiento.unidad}`
}

export function resumenConservacion(c: Estudio['conservacion'] | undefined): string | null {
  if (!c) return null
  const partes: string[] = []
  if (c.ambiente_h !== undefined) partes.push(`ambiente ${formato(c.ambiente_h)} h`)
  if (c.nevera_dias !== undefined) partes.push(`nevera ${formato(c.nevera_dias)} ${c.nevera_dias === 1 ? 'día' : 'días'}`)
  if (c.congelador_meses !== undefined) partes.push(`congelador ${formato(c.congelador_meses)} ${c.congelador_meses === 1 ? 'mes' : 'meses'}`)
  let salida = partes.join(' · ')
  if (salida) salida = salida[0].toUpperCase() + salida.slice(1)
  if (c.notas) salida = salida ? `${salida} · ${c.notas}` : c.notas
  return salida || null
}

// ── Formulario del editor (todo texto) ──
export type FormEstudio = {
  rendimiento_cantidad: string; rendimiento_unidad: string; tiempo_activo_min: string; tiempo_total_min: string
  mise_en_place: string; porcionado: string; ambiente_h: string; nevera_dias: string; congelador_meses: string; conservacion_notas: string
  equipo: string; variantes: string; origen: string
}

export function formularioDeEstudio(e: Estudio | null | undefined): FormEstudio {
  const s = (n: number | undefined) => (n === undefined ? '' : String(n))
  return {
    rendimiento_cantidad: s(e?.rendimiento?.cantidad), rendimiento_unidad: e?.rendimiento?.unidad ?? '',
    tiempo_activo_min: s(e?.tiempo_activo_min), tiempo_total_min: s(e?.tiempo_total_min),
    mise_en_place: e?.mise_en_place ?? '', porcionado: e?.porcionado ?? '',
    ambiente_h: s(e?.conservacion?.ambiente_h), nevera_dias: s(e?.conservacion?.nevera_dias), congelador_meses: s(e?.conservacion?.congelador_meses), conservacion_notas: e?.conservacion?.notas ?? '',
    equipo: e?.equipo ?? '', variantes: e?.variantes ?? '', origen: e?.origen ?? '',
  }
}

const aNumero = (v: string): number | undefined => {
  const t = v.trim().replace(',', '.')
  return t === '' ? undefined : Number(t)
}

export function estudioDeFormulario(f: FormEstudio): Estudio {
  return validarEstudio({
    rendimiento: { cantidad: aNumero(f.rendimiento_cantidad), unidad: f.rendimiento_unidad },
    tiempo_activo_min: aNumero(f.tiempo_activo_min), tiempo_total_min: aNumero(f.tiempo_total_min),
    mise_en_place: f.mise_en_place, porcionado: f.porcionado,
    conservacion: { ambiente_h: aNumero(f.ambiente_h), nevera_dias: aNumero(f.nevera_dias), congelador_meses: aNumero(f.congelador_meses), notas: f.conservacion_notas },
    equipo: f.equipo, variantes: f.variantes, origen: f.origen,
  })
}
