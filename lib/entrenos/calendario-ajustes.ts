// lib/entrenos/calendario-ajustes.ts
// La plantilla semanal de un plan (sesiones_entrenamiento.dia_semana) se repite cada semana.
// Los ajustes permiten mover, copiar o quitar una sesión en UNA fecha concreta (tabla calendario_entreno_ajustes).

export type TipoAjuste = 'mover' | 'copiar' | 'omitir'

export interface Ajuste {
  id: string
  sesion_id: string
  tipo: TipoAjuste
  fecha_origen: string | null
  fecha: string | null
}

export interface SesionPlantilla {
  id: string
  dia_semana: string | null
}

export interface Ocurrencia<S extends SesionPlantilla> {
  sesion: S
  /** Ajuste que la coloca en este día (mover/copiar); null si viene de la plantilla semanal. */
  ajuste: Ajuste | null
}

const DIAS_POR_INDICE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const MS_DIA = 86_400_000

/** Fecha ISO (AAAA-MM-DD) → Date a mediodía UTC, sin saltos por zona horaria. */
function aDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aDate(iso).getTime() + dias * MS_DIA).toISOString().slice(0, 10)
}

export function diaSemanaDe(iso: string): string {
  return DIAS_POR_INDICE[aDate(iso).getUTCDay()]
}

/** Lunes de la semana de una fecha. */
export function lunesDe(iso: string): string {
  const d = aDate(iso).getUTCDay() // 0 = domingo
  return sumarDias(iso, -((d + 6) % 7))
}

export function diferenciaDias(desde: string, hasta: string): number {
  return Math.round((aDate(hasta).getTime() - aDate(desde).getTime()) / MS_DIA)
}

export function esFechaISO(x: unknown): x is string {
  return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(aDate(x).getTime()) && aDate(x).toISOString().slice(0, 10) === x
}

/**
 * Sesiones que ocurren en una fecha: las de la plantilla semanal (si está activa ese día, es decir,
 * dentro del bloque) menos las movidas/quitadas desde esa fecha, más las movidas/copiadas a ella.
 */
export function ocurrenciasDelDia<S extends SesionPlantilla>(
  fecha: string,
  sesiones: S[],
  ajustes: Ajuste[],
  plantillaActiva: boolean,
): Ocurrencia<S>[] {
  const out: Ocurrencia<S>[] = []
  const dia = diaSemanaDe(fecha)
  const porId = new Map(sesiones.map(s => [s.id, s]))

  if (plantillaActiva) {
    for (const s of sesiones) {
      if (s.dia_semana !== dia) continue
      const suprimida = ajustes.some(a => a.sesion_id === s.id && a.fecha_origen === fecha && (a.tipo === 'mover' || a.tipo === 'omitir'))
      if (!suprimida) out.push({ sesion: s, ajuste: null })
    }
  }
  for (const a of ajustes) {
    if (a.fecha !== fecha || (a.tipo !== 'mover' && a.tipo !== 'copiar')) continue
    const s = porId.get(a.sesion_id)
    if (s) out.push({ sesion: s, ajuste: a })
  }
  return out
}

/** Primera fecha desde `desde` (incluida), dentro de `horizonteDias`, en la que ocurre la sesión. */
export function proximaFechaSesion<S extends SesionPlantilla>(
  sesion: S,
  sesiones: S[],
  ajustes: Ajuste[],
  desde: string,
  plantillaActivaEn: (fecha: string) => boolean,
  horizonteDias = 14,
): string | null {
  for (let i = 0; i < horizonteDias; i++) {
    const f = sumarDias(desde, i)
    if (ocurrenciasDelDia(f, sesiones, ajustes, plantillaActivaEn(f)).some(o => o.sesion.id === sesion.id)) return f
  }
  return null
}

export type Operacion =
  | { op: 'mover'; sesion_id: string; desde: string; hasta: string }
  | { op: 'copiar'; sesion_id: string; hasta: string }
  | { op: 'omitir'; sesion_id: string; desde: string }

export type CambioBD =
  | { accion: 'insertar'; fila: Omit<Ajuste, 'id'> }
  | { accion: 'actualizar'; id: string; cambios: Partial<Pick<Ajuste, 'tipo' | 'fecha'>> }
  | { accion: 'borrar'; id: string }

/**
 * Traduce una operación del calendario a cambios en la tabla de ajustes.
 * Devuelve [] si no hay nada que hacer (mismo día, o la sesión ya está en destino).
 * `ajustes` debe reflejar el estado actual (aplicar antes los cambios de operaciones previas).
 */
export function planificarOperacion<S extends SesionPlantilla>(
  o: Operacion,
  sesiones: S[],
  ajustes: Ajuste[],
  plantillaActivaEn: (fecha: string) => boolean,
): CambioBD[] {
  const estaEn = (fecha: string) => ocurrenciasDelDia(fecha, sesiones, ajustes, plantillaActivaEn(fecha)).some(x => x.sesion.id === o.sesion_id)
  const ajusteEn = (fecha: string) => ajustes.find(a => a.sesion_id === o.sesion_id && a.fecha === fecha && (a.tipo === 'mover' || a.tipo === 'copiar'))

  if (o.op === 'copiar') {
    return estaEn(o.hasta) ? [] : [{ accion: 'insertar', fila: { sesion_id: o.sesion_id, tipo: 'copiar', fecha_origen: null, fecha: o.hasta } }]
  }

  if (o.op === 'omitir') {
    if (!estaEn(o.desde)) return []
    const a = ajusteEn(o.desde)
    if (!a) return [{ accion: 'insertar', fila: { sesion_id: o.sesion_id, tipo: 'omitir', fecha_origen: o.desde, fecha: null } }]
    if (a.tipo === 'copiar') return [{ accion: 'borrar', id: a.id }]
    return [{ accion: 'actualizar', id: a.id, cambios: { tipo: 'omitir', fecha: null } }]
  }

  // mover
  if (o.desde === o.hasta || !estaEn(o.desde) || estaEn(o.hasta)) return []
  const a = ajusteEn(o.desde)
  if (!a) return [{ accion: 'insertar', fila: { sesion_id: o.sesion_id, tipo: 'mover', fecha_origen: o.desde, fecha: o.hasta } }]
  // Devolver una sesión movida a su día original equivale a deshacer el movimiento.
  if (a.tipo === 'mover' && a.fecha_origen === o.hasta) return [{ accion: 'borrar', id: a.id }]
  return [{ accion: 'actualizar', id: a.id, cambios: { fecha: o.hasta } }]
}

/** Aplica en memoria los cambios de BD (para encadenar varias operaciones sin releer la tabla). */
export function aplicarCambios(ajustes: Ajuste[], cambios: CambioBD[], nuevoId: () => string): Ajuste[] {
  let out = [...ajustes]
  for (const c of cambios) {
    if (c.accion === 'insertar') out.push({ id: nuevoId(), ...c.fila })
    else if (c.accion === 'borrar') out = out.filter(a => a.id !== c.id)
    else out = out.map(a => (a.id === c.id ? { ...a, ...c.cambios } : a))
  }
  return out
}
