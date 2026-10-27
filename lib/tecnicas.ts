// Técnicas de cocina como fichas propias (archivo de cocina): validación y formato. Tabla `tecnicas`, enlaces en `receta_tecnicas`.
import { FAMILIAS_TECNICA } from './recetas-constants'

export const ESTADOS_TECNICA = ['en_revision', 'aprobada', 'descartada'] as const
export type EstadoTecnica = (typeof ESTADOS_TECNICA)[number]
export const NIVELES_TECNICA = ['Fácil', 'Medio', 'Difícil', 'Avanzado'] as const
export type NivelTecnica = (typeof NIVELES_TECNICA)[number]

export type ParametrosTecnica = {
  temperatura_c?: number; tiempo_activo_min?: number; tiempo_total_min?: number
  proporciones?: string; nivel?: NivelTecnica; equipo?: string
}

export type Tecnica = {
  nombre: string; familia: (typeof FAMILIAS_TECNICA)[number] | null
  descripcion: string | null; principio: string | null; pasos: string | null; errores_tipicos: string | null
  variantes: string | null; seguridad: string | null; origen: string | null
  parametros: ParametrosTecnica; tags: string[]; url_origen: string | null; autor_original: string | null; estado: EstadoTecnica
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const texto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const num = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined)

export const parametrosVacios = (p: ParametrosTecnica | null | undefined): boolean => !p || Object.keys(p).length === 0

function validarParametros(raw: unknown): ParametrosTecnica {
  if (!esObjeto(raw)) return {}
  const p: ParametrosTecnica = {}
  const t = num(raw.temperatura_c, -200, 500); if (t !== undefined) p.temperatura_c = t
  const a = num(raw.tiempo_activo_min, 0, 100_000); if (a !== undefined) p.tiempo_activo_min = a
  const tt = num(raw.tiempo_total_min, 0, 100_000); if (tt !== undefined) p.tiempo_total_min = tt
  const pr = texto(raw.proporciones, 200); if (pr) p.proporciones = pr
  if ((NIVELES_TECNICA as readonly unknown[]).includes(raw.nivel)) p.nivel = raw.nivel as NivelTecnica
  const eq = texto(raw.equipo, 300); if (eq) p.equipo = eq
  return p
}

/** Valida y limpia lo que llega del formulario o de una API. El nombre es obligatorio; familia y estado, si vienen, deben ser válidos. */
export function validarTecnica(raw: unknown): { ok: true; tecnica: Tecnica } | { ok: false; motivo: string } {
  if (!esObjeto(raw)) return { ok: false, motivo: 'datos no válidos' }
  const nombre = texto(raw.nombre, 200)
  if (!nombre) return { ok: false, motivo: 'falta el nombre' }
  const familia = raw.familia === undefined || raw.familia === null || raw.familia === '' ? null : raw.familia
  if (familia !== null && !(FAMILIAS_TECNICA as readonly unknown[]).includes(familia)) return { ok: false, motivo: 'familia no válida' }
  const estado = raw.estado === undefined ? 'en_revision' : raw.estado
  if (!(ESTADOS_TECNICA as readonly unknown[]).includes(estado)) return { ok: false, motivo: 'estado no válido' }
  const vistos = new Set<string>()
  const tags = (Array.isArray(raw.tags) ? raw.tags : []).map(t => texto(t, 40)).filter((t): t is string => !!t).filter(t => { const k = t.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true }).slice(0, 20)
  return {
    ok: true,
    tecnica: {
      nombre, familia: familia as Tecnica['familia'], descripcion: texto(raw.descripcion, 2000), principio: texto(raw.principio, 3000), pasos: texto(raw.pasos, 10000),
      errores_tipicos: texto(raw.errores_tipicos, 3000), variantes: texto(raw.variantes, 3000), seguridad: texto(raw.seguridad, 2000), origen: texto(raw.origen, 300),
      parametros: validarParametros(raw.parametros), tags, url_origen: texto(raw.url_origen, 500), autor_original: texto(raw.autor_original, 200), estado: estado as EstadoTecnica,
    },
  }
}

const formato = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: n >= 10 ? 0 : 1 })
const duracion = (m: number) => (m >= 120 ? `${formato(m / 60)} h` : `${formato(m)} min`)

/** «90 °C · 12 h · Medio» para tarjetas y cabecera de la ficha. */
export function resumenParametros(p: ParametrosTecnica | null | undefined): string | null {
  if (!p) return null
  const partes: string[] = []
  if (p.temperatura_c !== undefined) partes.push(`${formato(p.temperatura_c)} °C`)
  if (p.tiempo_total_min !== undefined) partes.push(duracion(p.tiempo_total_min))
  else if (p.tiempo_activo_min !== undefined) partes.push(`Activo ${duracion(p.tiempo_activo_min)}`)
  if (p.proporciones) partes.push(p.proporciones)
  if (p.nivel) partes.push(p.nivel)
  return partes.length ? partes.join(' · ') : null
}

// ── Formulario (todo texto) ──
export type FormTecnica = {
  nombre: string; familia: string; descripcion: string; principio: string; pasos: string; errores_tipicos: string; variantes: string; seguridad: string; origen: string
  temperatura_c: string; tiempo_activo_min: string; tiempo_total_min: string; proporciones: string; nivel: string; equipo: string
  tags: string; url_origen: string; autor_original: string; estado: string
}
export const FORMULARIO_TECNICA_VACIO: FormTecnica = {
  nombre: '', familia: '', descripcion: '', principio: '', pasos: '', errores_tipicos: '', variantes: '', seguridad: '', origen: '',
  temperatura_c: '', tiempo_activo_min: '', tiempo_total_min: '', proporciones: '', nivel: '', equipo: '', tags: '', url_origen: '', autor_original: '', estado: 'en_revision',
}

const aNumero = (v: string): number | undefined => { const t = v.trim().replace(',', '.'); return t === '' ? undefined : Number(t) }

export function tecnicaDeFormulario(f: FormTecnica) {
  return validarTecnica({
    nombre: f.nombre, familia: f.familia, descripcion: f.descripcion, principio: f.principio, pasos: f.pasos, errores_tipicos: f.errores_tipicos,
    variantes: f.variantes, seguridad: f.seguridad, origen: f.origen, url_origen: f.url_origen, autor_original: f.autor_original, estado: f.estado,
    parametros: { temperatura_c: aNumero(f.temperatura_c), tiempo_activo_min: aNumero(f.tiempo_activo_min), tiempo_total_min: aNumero(f.tiempo_total_min), proporciones: f.proporciones, nivel: f.nivel, equipo: f.equipo },
    tags: f.tags.split(',').map(t => t.trim()),
  })
}

export function formularioDeTecnica(t: Partial<Tecnica> | null | undefined): FormTecnica {
  const s = (n: number | undefined) => (n === undefined ? '' : String(n))
  const p = t?.parametros
  return {
    nombre: t?.nombre ?? '', familia: t?.familia ?? '', descripcion: t?.descripcion ?? '', principio: t?.principio ?? '', pasos: t?.pasos ?? '',
    errores_tipicos: t?.errores_tipicos ?? '', variantes: t?.variantes ?? '', seguridad: t?.seguridad ?? '', origen: t?.origen ?? '',
    temperatura_c: s(p?.temperatura_c), tiempo_activo_min: s(p?.tiempo_activo_min), tiempo_total_min: s(p?.tiempo_total_min),
    proporciones: p?.proporciones ?? '', nivel: p?.nivel ?? '', equipo: p?.equipo ?? '',
    tags: (t?.tags ?? []).join(', '), url_origen: t?.url_origen ?? '', autor_original: t?.autor_original ?? '', estado: t?.estado ?? 'en_revision',
  }
}
