// Núcleo puro del revisor de recetas: lo que dice el modelo se valida aquí antes de usarse, y solo ciertas correcciones se aplican solas.
import { createHash } from 'node:crypto'
import { FAMILIAS_ELABORACION, FAMILIAS_PLATO } from '../../recetas-constants'
import { camposAlCambiarTipo, type TipoContenido } from '../clasificacion'

export type Veredicto = 'lista' | 'revisar' | 'corregir'
export type Hallazgo = { campo: string; gravedad: 'alta' | 'media' | 'baja'; descripcion: string; sugerencia: string }
export type Correccion = { campo: 'tipo_contenido' | 'familia'; valor: string; segura: boolean }
export type RevisionAgente = {
  tipo_contenido: TipoContenido; familia: string | null; confianza: number; veredicto: Veredicto
  resumen: string; hallazgos: Hallazgo[]; correcciones: Correccion[]
}

export type FichaParaRevisar = {
  id: string; nombre: string; estado: string; tipo_contenido: string; familia: string | null; categoria: string | null
  tipo_plato: string | null; tipo_receta: string | null; descripcion: string | null; instrucciones: string | null; consejos: string | null
  porciones: number | null; kcal: number | null; proteinas: number | null; carbohidratos: number | null; grasas: number | null
  tags: string[] | null; url_origen: string | null
  ingredientes: { nombre: string; alimento: string | null; gramos: number; kcal100: number | null }[]
  hallazgos_deterministas: string[]
  usada_en_recetas: number
}

const MAX_HALLAZGOS = 20
export const CONFIANZA_MINIMA_AUTO = 0.85
const GRAVEDADES = ['alta', 'media', 'baja'] as const
const VEREDICTOS: Veredicto[] = ['lista', 'revisar', 'corregir']
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function validarRevision(raw: unknown): { ok: true; revision: RevisionAgente } | { ok: false; motivo: string } {
  if (!esObjeto(raw)) return { ok: false, motivo: 'la respuesta no es un objeto' }
  const tipo = raw.tipo_contenido
  if (tipo !== 'plato' && tipo !== 'elaboracion') return { ok: false, motivo: 'tipo_contenido no válido' }
  const familia = raw.familia === null || raw.familia === undefined ? null : texto(raw.familia, 80)
  const validas: readonly string[] = tipo === 'plato' ? FAMILIAS_PLATO : FAMILIAS_ELABORACION
  if (familia === null && tipo === 'elaboracion') return { ok: false, motivo: 'una elaboración necesita familia' }
  if (familia !== null && !validas.includes(familia)) return { ok: false, motivo: `familia «${familia}» no válida para ${tipo}` }
  const confianza = raw.confianza
  if (typeof confianza !== 'number' || !Number.isFinite(confianza) || confianza < 0 || confianza > 1) return { ok: false, motivo: 'confianza fuera de rango' }
  if (typeof raw.veredicto !== 'string' || !VEREDICTOS.includes(raw.veredicto as Veredicto)) return { ok: false, motivo: 'veredicto no válido' }
  if (!Array.isArray(raw.hallazgos)) return { ok: false, motivo: 'faltan hallazgos' }

  const hallazgos: Hallazgo[] = []
  for (const h of raw.hallazgos) {
    if (!esObjeto(h)) continue
    const gravedad = (GRAVEDADES as readonly string[]).includes(h.gravedad as string) ? (h.gravedad as Hallazgo['gravedad']) : 'baja'
    const descripcion = texto(h.descripcion, 400)
    if (!descripcion) continue
    hallazgos.push({ campo: texto(h.campo, 60) || 'general', gravedad, descripcion, sugerencia: texto(h.sugerencia, 400) })
    if (hallazgos.length >= MAX_HALLAZGOS) break
  }

  const correcciones: Correccion[] = []
  for (const c of Array.isArray(raw.correcciones) ? raw.correcciones : []) {
    if (!esObjeto(c) || (c.campo !== 'tipo_contenido' && c.campo !== 'familia') || typeof c.valor !== 'string') return { ok: false, motivo: 'corrección no permitida' }
    correcciones.push({ campo: c.campo, valor: c.valor.trim().slice(0, 80), segura: c.segura === true })
  }
  return { ok: true, revision: { tipo_contenido: tipo, familia, confianza, veredicto: raw.veredicto as Veredicto, resumen: texto(raw.resumen, 600), hallazgos, correcciones } }
}

/**
 * Campos que el agente puede escribir solo. Nada de estado, ingredientes, cantidades, pasos ni macros.
 * Solo: ficha en revisión, confianza alta, corrección marcada como segura; familia dentro del mismo tipo o de plato a elaboración.
 * De elaboración a plato nunca (puede estar en uso): queda como sugerencia.
 */
export function correccionesAplicables(rev: RevisionAgente, ficha: Pick<FichaParaRevisar, 'estado' | 'tipo_contenido' | 'familia' | 'categoria' | 'nombre' | 'usada_en_recetas'>): Record<string, unknown> {
  if (ficha.estado !== 'en_revision' || rev.confianza < CONFIANZA_MINIMA_AUTO) return {}
  const segura = (campo: Correccion['campo'], valor: string | null) => valor !== null && rev.correcciones.some(c => c.segura && c.campo === campo && c.valor === valor)
  const tipoCambia = rev.tipo_contenido !== ficha.tipo_contenido && segura('tipo_contenido', rev.tipo_contenido)
  if (tipoCambia) {
    if (rev.tipo_contenido !== 'elaboracion' || !segura('familia', rev.familia)) return {}
    return camposAlCambiarTipo({ nombre: ficha.nombre, tipo: 'elaboracion', familia: rev.familia, categoria: ficha.categoria, tipoRecetaActual: null })
  }
  if (rev.tipo_contenido === ficha.tipo_contenido && rev.familia !== ficha.familia && segura('familia', rev.familia)) return { familia: rev.familia }
  return {}
}

/** Huella del contenido revisable (y de la nota de Carlos): si no cambia, no se vuelve a pagar una revisión. */
export function hashFicha(f: FichaParaRevisar, nota?: string | null): string {
  const canonico = {
    nombre: f.nombre, tipo_contenido: f.tipo_contenido, familia: f.familia, categoria: f.categoria, tipo_plato: f.tipo_plato,
    descripcion: f.descripcion, instrucciones: f.instrucciones, consejos: f.consejos, porciones: f.porciones,
    kcal: f.kcal, proteinas: f.proteinas, carbohidratos: f.carbohidratos, grasas: f.grasas,
    tags: [...(f.tags ?? [])].sort(),
    ingredientes: [...f.ingredientes].sort((a, b) => (a.nombre + a.gramos).localeCompare(b.nombre + b.gramos)).map(i => [i.nombre, i.alimento, i.gramos]),
    nota: nota ?? null,
  }
  return createHash('sha256').update(JSON.stringify(canonico)).digest('hex')
}
