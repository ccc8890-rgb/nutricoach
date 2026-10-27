// lib/metodos/esquema.ts
// Reglas puras de la biblioteca de métodos: validación de lo que escribe Carlos, huella contra duplicados,
// qué estados se pueden recorrer y qué fichas ve cada filtro. Sin acceso a la base de datos.
import { createHash } from 'node:crypto'
import { BLOQUES_SESION } from '@/lib/training/session-blocks'
import { coincidePalabras, palabrasDeBusqueda, sinTildes } from '@/lib/recetas/busqueda'
import {
  TIPOS_METODO, MODALIDADES, NIVELES, OBJETIVOS, MATERIALES, CONFIANZAS,
  type BloqueMetodo, type CamposMetodo, type EjercicioMetodo, type EstadoMetodo, type Metodo, type TipoEventoMetodo,
} from './constantes'

const MAX_TITULO = 160
const MAX_TEXTO = 4000
const MAX_TAGS = 12
const MAX_TAG = 40
const MAX_BLOQUES = 12
const MAX_EJERCICIOS = 40
const PARAMETROS_RUIDO = /^(utm_|igsh$|igshid$|fbclid$|si$|feature$|ref$)/i

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string }
const fallo = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** URL sin esquema, `www`, parámetros de seguimiento ni barra final; conserva `v` de YouTube. Null si no es una URL http(s). */
export function normalizarUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url.trim()) return null
  let u: URL
  try { u = new URL(url.trim()) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const params = [...u.searchParams.entries()].filter(([k]) => !PARAMETROS_RUIDO.test(k)).sort(([a], [b]) => a.localeCompare(b))
  const consulta = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : ''
  const ruta = u.pathname.replace(/\/+$/, '')
  return `${u.hostname.replace(/^www\./, '').toLowerCase()}${ruta}${consulta}`
}

/** Identidad de una ficha para detectar duplicados: URL normalizada + autor, o autor + título si no hay URL. */
export function huellaMetodo(c: { autor: string | null; url_origen: string | null; titulo: string }): string {
  const autor = sinTildes(c.autor ?? '').trim()
  const url = normalizarUrl(c.url_origen)
  const base = url ? `${url}|${autor}` : `${autor}|${sinTildes(c.titulo).replace(/\s+/g, ' ').trim()}`
  return createHash('sha1').update(base).digest('hex')
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const enLista = <T extends string>(lista: readonly T[], v: unknown): v is T => typeof v === 'string' && (lista as readonly string[]).includes(v)

function textoOpcional(v: unknown, campo: string, max = MAX_TEXTO): Resultado<string | null> {
  if (v === null || v === undefined || v === '') return { ok: true, valor: null }
  if (typeof v !== 'string') return fallo(`«${campo}» debe ser texto`)
  const t = v.trim()
  if (t.length > max) return fallo(`«${campo}» es demasiado largo (máx. ${max} caracteres)`)
  return { ok: true, valor: t || null }
}

function urlOpcional(v: unknown, campo: string): Resultado<string | null> {
  const t = textoOpcional(v, campo, 2000)
  if (!t.ok || t.valor === null) return t
  return normalizarUrl(t.valor) ? t : fallo(`«${campo}» debe ser un enlace http(s) válido`)
}

function entero(v: unknown, campo: string, min: number, max: number): Resultado<number | null> {
  if (v === null || v === undefined || v === '') return { ok: true, valor: null }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return fallo(`«${campo}» debe ser un número entero entre ${min} y ${max}`)
  return { ok: true, valor: v }
}

function validarEjercicio(v: unknown): Resultado<EjercicioMetodo> {
  if (!esObjeto(v)) return fallo('Un ejercicio no es válido')
  const texto = typeof v.texto_original === 'string' ? v.texto_original.trim() : ''
  if (!texto) return fallo('Cada ejercicio necesita un nombre')
  if (texto.length > 200) return fallo('El nombre de un ejercicio es demasiado largo')
  const series = entero(v.series, 'series', 1, 20); if (!series.ok) return series
  const dur = entero(v.duracion_seg, 'duración', 1, 7200); if (!dur.ok) return dur
  const pausa = entero(v.pausa_seg, 'pausa', 0, 900); if (!pausa.ok) return pausa
  const reps = textoOpcional(v.reps, 'repeticiones', 40); if (!reps.ok) return reps
  const inten = textoOpcional(v.intensidad, 'intensidad', 80); if (!inten.ok) return inten
  const nota = textoOpcional(v.nota, 'nota', 400); if (!nota.ok) return nota
  const id = typeof v.ejercicio_id === 'string' && v.ejercicio_id ? v.ejercicio_id : null
  return { ok: true, valor: { texto_original: texto, ejercicio_id: id, series: series.valor, reps: reps.valor, duracion_seg: dur.valor, pausa_seg: pausa.valor, intensidad: inten.valor, nota: nota.valor } }
}

function validarEstructura(v: unknown): Resultado<BloqueMetodo[]> {
  if (!Array.isArray(v)) return fallo('«estructura» debe ser una lista de bloques')
  if (v.length > MAX_BLOQUES) return fallo(`Una sesión admite como máximo ${MAX_BLOQUES} bloques`)
  const bloques: BloqueMetodo[] = []
  for (const b of v) {
    if (!esObjeto(b) || !enLista(BLOQUES_SESION, b.tipo)) return fallo('Un bloque no es válido')
    if (!Array.isArray(b.ejercicios)) return fallo('Un bloque necesita una lista de ejercicios')
    if (b.ejercicios.length > MAX_EJERCICIOS) return fallo(`Un bloque admite como máximo ${MAX_EJERCICIOS} ejercicios`)
    const ejercicios: EjercicioMetodo[] = []
    for (const e of b.ejercicios) {
      const r = validarEjercicio(e)
      if (!r.ok) return r
      ejercicios.push(r.valor)
    }
    bloques.push({ tipo: b.tipo, ejercicios })
  }
  return { ok: true, valor: bloques }
}

/**
 * Valida lo que Carlos manda al crear o editar. Solo devuelve campos editables: `estado`, `coach_id`, `huella`, `disponible_ia` e `id`
 * se ignoran aunque vengan en el cuerpo (los cambian solo las rutas de estado y de IA). En `editar` el cuerpo es parcial.
 */
export function validarMetodo(entrada: unknown, modo: 'crear' | 'editar'): Resultado<Partial<CamposMetodo>> {
  if (!esObjeto(entrada)) return fallo('Cuerpo no válido')
  const e = entrada
  const out: Partial<CamposMetodo> = {}
  const tiene = (k: string) => k in e && e[k] !== undefined

  if (modo === 'crear' || tiene('tipo')) { if (!enLista(TIPOS_METODO, e.tipo)) return fallo('Tipo no válido'); out.tipo = e.tipo }
  if (modo === 'crear' || tiene('titulo')) {
    const t = typeof e.titulo === 'string' ? e.titulo.trim() : ''
    if (!t) return fallo('El título es obligatorio')
    if (t.length > MAX_TITULO) return fallo(`El título admite como máximo ${MAX_TITULO} caracteres`)
    out.titulo = t
  }
  if (modo === 'crear' || tiene('modalidad')) { if (!enLista(MODALIDADES, e.modalidad)) return fallo('Modalidad no válida'); out.modalidad = e.modalidad }
  if (tiene('objetivo')) { if (e.objetivo !== null && !enLista(OBJETIVOS, e.objetivo)) return fallo('Objetivo no válido'); out.objetivo = e.objetivo as CamposMetodo['objetivo'] }
  if (tiene('nivel')) { if (e.nivel !== null && !enLista(NIVELES, e.nivel)) return fallo('Nivel no válido'); out.nivel = e.nivel as CamposMetodo['nivel'] }
  if (tiene('confianza')) { if (!enLista(CONFIANZAS, e.confianza)) return fallo('Confianza no válida'); out.confianza = e.confianza }
  if (tiene('material')) {
    if (!Array.isArray(e.material) || !e.material.every(m => enLista(MATERIALES, m))) return fallo('Material no válido')
    out.material = [...new Set(e.material as CamposMetodo['material'])]
  }
  if (tiene('tags')) {
    if (!Array.isArray(e.tags) || !e.tags.every(t => typeof t === 'string')) return fallo('Etiquetas no válidas')
    const tags = [...new Set((e.tags as string[]).map(t => t.trim()).filter(Boolean))]
    if (tags.length > MAX_TAGS) return fallo(`Como máximo ${MAX_TAGS} etiquetas`)
    if (tags.some(t => t.length > MAX_TAG)) return fallo(`Cada etiqueta admite como máximo ${MAX_TAG} caracteres`)
    out.tags = tags
  }
  if (tiene('duracion_min')) { const d = entero(e.duracion_min, 'duración', 1, 600); if (!d.ok) return d; out.duracion_min = d.valor }
  if (tiene('estructura')) { const s = validarEstructura(e.estructura); if (!s.ok) return s; out.estructura = s.valor }
  for (const [campo, etiqueta, max] of [['resumen', 'resumen', MAX_TEXTO], ['autor', 'autor', 120], ['plataforma', 'plataforma', 60], ['notas_coach', 'notas', MAX_TEXTO]] as const) {
    if (tiene(campo)) { const t = textoOpcional(e[campo], etiqueta, max); if (!t.ok) return t; out[campo] = t.valor }
  }
  for (const campo of ['url_origen', 'video_url', 'miniatura_url'] as const) {
    if (tiene(campo)) { const u = urlOpcional(e[campo], campo); if (!u.ok) return u; out[campo] = u.valor }
  }
  // «duracion_min: 0» o negativa cae en entero(): 1 es el mínimo
  if (modo === 'editar' && Object.keys(out).length === 0) return fallo('No hay nada que cambiar')
  return { ok: true, valor: out }
}

/** Huella de la ficha después de aplicar una edición: un campo borrado (null) cuenta como borrado, no se recupera el valor anterior. */
export function huellaTrasEdicion(actual: Pick<Metodo, 'autor' | 'url_origen' | 'titulo'>, cambios: Partial<CamposMetodo>): string {
  return huellaMetodo({
    autor: 'autor' in cambios ? cambios.autor ?? null : actual.autor,
    url_origen: 'url_origen' in cambios ? cambios.url_origen ?? null : actual.url_origen,
    titulo: cambios.titulo ?? actual.titulo,
  })
}

/** Una ficha solo se aprueba con modalidad, procedencia y, si es una sesión, con al menos un ejercicio. */
export function puedeAprobar(m: Pick<Metodo, 'tipo' | 'titulo' | 'modalidad' | 'autor' | 'url_origen' | 'estructura'>): { ok: true } | { ok: false; motivo: string } {
  if (!m.titulo?.trim()) return { ok: false, motivo: 'La ficha necesita un título antes de aprobarla.' }
  if (!m.modalidad) return { ok: false, motivo: 'Elige una modalidad antes de aprobar la ficha.' }
  if (!m.autor?.trim() && !normalizarUrl(m.url_origen)) return { ok: false, motivo: 'Indica el autor o el enlace de origen: toda ficha aprobada necesita procedencia.' }
  if (m.tipo === 'sesion' && !(m.estructura ?? []).some(b => b.ejercicios.length > 0)) return { ok: false, motivo: 'Una sesión necesita al menos un ejercicio para poder aprobarse.' }
  return { ok: true }
}

const TRANSICIONES: Partial<Record<EstadoMetodo, Partial<Record<EstadoMetodo, TipoEventoMetodo>>>> = {
  en_revision: { aprobada: 'aprobada', descartada: 'descartada' },
  aprobada: { en_revision: 'reabierta', descartada: 'descartada' },
  descartada: { en_revision: 'reabierta' },
}

/** Cambios de estado permitidos (`con_agente` queda reservado para una fase posterior: nada transiciona a él todavía). */
export function transicionMetodo(desde: EstadoMetodo, hacia: EstadoMetodo): { ok: boolean; evento?: TipoEventoMetodo } {
  const evento = TRANSICIONES[desde]?.[hacia]
  return evento ? { ok: true, evento } : { ok: false }
}

/** La marca «disponible para la IA» solo puede estar activa en fichas aprobadas. */
export function disponibleIaPermitido(estado: EstadoMetodo, pedido: boolean): boolean {
  return pedido && estado === 'aprobada'
}

export interface FilaFiltrable {
  titulo: string
  resumen: string | null
  autor: string | null
  tags: string[]
  tipo: string
  modalidad: string
  nivel: string | null
  confianza: string
  disponible_ia: boolean
}
export interface FiltrosMetodos { q?: string; tipo?: string; modalidad?: string; nivel?: string; confianza?: string; autor?: string; soloIa?: boolean }

/** Filtro en memoria: texto por palabras sueltas sin tildes (título, resumen, autor y etiquetas) y filtros exactos combinados con «y». */
export function filtrarMetodos<T extends FilaFiltrable>(lista: T[], f: FiltrosMetodos): T[] {
  const palabras = palabrasDeBusqueda(f.q)
  const autor = f.autor ? sinTildes(f.autor).trim() : ''
  return lista.filter(m =>
    (!f.tipo || m.tipo === f.tipo) &&
    (!f.modalidad || m.modalidad === f.modalidad) &&
    (!f.nivel || m.nivel === f.nivel) &&
    (!f.confianza || m.confianza === f.confianza) &&
    (!f.soloIa || m.disponible_ia) &&
    (!autor || sinTildes(m.autor ?? '').includes(autor)) &&
    coincidePalabras([m.titulo, m.resumen, m.autor, ...(m.tags ?? [])].filter(Boolean).join(' '), palabras),
  )
}
