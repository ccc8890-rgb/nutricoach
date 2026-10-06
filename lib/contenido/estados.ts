export const ESTADOS_PIEZA = ['idea', 'documentada', 'para_grabar', 'grabada', 'editada', 'programada', 'publicada'] as const
export type EstadoPieza = typeof ESTADOS_PIEZA[number]

/** Estados en los que el vídeo ya está grabado. */
export const ESTADOS_GRABADOS: readonly EstadoPieza[] = ['grabada', 'editada', 'programada', 'publicada']

export const ETIQUETA_ESTADO: Record<EstadoPieza, string> = {
  idea: 'Idea',
  documentada: 'Documentada',
  para_grabar: 'Para grabar',
  grabada: 'Grabada',
  editada: 'Editada',
  programada: 'Programada',
  publicada: 'Publicada',
}

export function esEstadoPieza(v: unknown): v is EstadoPieza {
  return typeof v === 'string' && (ESTADOS_PIEZA as readonly string[]).includes(v)
}

export type IconoReceta = 'para_grabar' | 'grabada' | null

/** Valor de `recetas.contenido_estado` (caché del icono) según los estados de sus piezas. Lo pendiente manda. */
export function estadoIconoReceta(estados: EstadoPieza[]): IconoReceta {
  if (estados.includes('para_grabar')) return 'para_grabar'
  if (estados.some(e => ESTADOS_GRABADOS.includes(e))) return 'grabada'
  return null
}

export type AccionIcono = {
  crear: EstadoPieza | null
  actualizar: { id: string; estado: EstadoPieza }[]
  borrar: string[]
}

/** Qué hacer con las piezas de una receta cuando el planificador cambia su icono a `destino`. */
export function planificarIcono(piezas: { id: string; estado: EstadoPieza }[], destino: IconoReceta): AccionIcono {
  const nada: AccionIcono = { crear: null, actualizar: [], borrar: [] }
  if (destino === 'para_grabar') {
    if (piezas.some(p => p.estado === 'para_grabar')) return nada
    const promovible = piezas.find(p => p.estado === 'idea' || p.estado === 'documentada')
    if (promovible) return { ...nada, actualizar: [{ id: promovible.id, estado: 'para_grabar' }] }
    return { ...nada, crear: 'para_grabar' }
  }
  if (destino === 'grabada') {
    const pendientes = piezas.filter(p => p.estado === 'para_grabar')
    if (pendientes.length > 0) return { ...nada, actualizar: pendientes.map(p => ({ id: p.id, estado: 'grabada' as const })) }
    if (piezas.some(p => ESTADOS_GRABADOS.includes(p.estado))) return nada
    return { ...nada, crear: 'grabada' }
  }
  return { ...nada, borrar: piezas.filter(p => p.estado === 'para_grabar' || p.estado === 'grabada').map(p => p.id) }
}
