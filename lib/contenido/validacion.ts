import { esEstadoPieza, type EstadoPieza } from './estados'
import { IDS_PLANOS } from './escaleta'
import { normalizarEnlace } from './enlace'

export type CambiosPieza = {
  titulo?: string
  enlace_referencia?: string | null
  notas?: string | null
  gancho?: string | null
  estado?: EstadoPieza
  fecha_grabacion?: string | null
  fecha_publicacion?: string | null
  receta_id?: string | null
  plan_id?: string | null
  planos_hechos?: string[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const LIMITES = { titulo: 200, enlace_referencia: 500, notas: 2000, gancho: 200 } as const

/** Valida el cuerpo de las rutas de piezas y devuelve solo los campos permitidos. */
export function limpiarCambios(body: unknown): { ok: true; cambios: CambiosPieza } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Cuerpo no válido' }
  const b = body as Record<string, unknown>
  const c: CambiosPieza = {}

  if ('titulo' in b) {
    const v = b.titulo
    if (typeof v !== 'string' || !v.trim() || v.trim().length > LIMITES.titulo) return { ok: false, error: 'Título no válido' }
    c.titulo = v.trim()
  }
  for (const k of ['enlace_referencia', 'notas', 'gancho'] as const) {
    if (!(k in b)) continue
    const v = b[k]
    if (v === null || v === '') { c[k] = null; continue }
    if (typeof v !== 'string' || v.trim().length > LIMITES[k]) return { ok: false, error: `${k} no válido` }
    // El enlace se pinta como <a href>: solo http(s)
    if (k === 'enlace_referencia' && normalizarEnlace(v) === null) return { ok: false, error: 'El enlace debe empezar por http:// o https://' }
    c[k] = v.trim()
  }
  if ('estado' in b) {
    if (!esEstadoPieza(b.estado)) return { ok: false, error: 'Estado no válido' }
    c.estado = b.estado
  }
  for (const k of ['fecha_grabacion', 'fecha_publicacion'] as const) {
    if (!(k in b)) continue
    const v = b[k]
    if (v === null) { c[k] = null; continue }
    if (typeof v !== 'string' || !FECHA.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) return { ok: false, error: `${k} no válida` }
    c[k] = v
  }
  for (const k of ['receta_id', 'plan_id'] as const) {
    if (!(k in b)) continue
    const v = b[k]
    if (v === null) { c[k] = null; continue }
    if (typeof v !== 'string' || !UUID.test(v)) return { ok: false, error: `${k} no válido` }
    c[k] = v
  }
  if ('planos_hechos' in b) {
    const v = b.planos_hechos
    if (!Array.isArray(v) || !v.every(x => typeof x === 'string' && IDS_PLANOS.includes(x))) return { ok: false, error: 'Planos no válidos' }
    c.planos_hechos = [...new Set(v as string[])]
  }
  return { ok: true, cambios: c }
}
