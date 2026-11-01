// lib/platos/estado.ts
// «Mis platos»: estados, transiciones y qué versión de un plato se enseña. Lógica pura (sin BD).

export type EstadoPlato = 'borrador' | 'pendiente' | 'aprobado' | 'devuelto'

export const MAX_ANALISIS_POR_DIA = 10
export const MAX_FOTO_BYTES = 8 * 1024 * 1024
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

export type VistaPlato = {
  nombre: string
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  ingredientes: { nombre_libre: string; cantidad_gramos: number }[]
  estimado: boolean
}

const TRANSICIONES: Record<'cliente' | 'coach', Partial<Record<EstadoPlato, EstadoPlato[]>>> = {
  // Editar un plato aprobado o devuelto lo manda de nuevo a revisión
  cliente: { borrador: ['pendiente'], devuelto: ['pendiente'], aprobado: ['pendiente'] },
  // El coach solo ve lo enviado: nunca los borradores
  coach: { pendiente: ['aprobado', 'devuelto'] },
}

export function transicionPermitida(de: EstadoPlato, a: EstadoPlato, actor: 'cliente' | 'coach'): boolean {
  return TRANSICIONES[actor][de]?.includes(a) ?? false
}

/**
 * Lo que ve el cliente en su recetario: lo aprobado manda. Si el cliente lo ha editado y está otra vez pendiente,
 * se sigue enseñando la versión aprobada (snapshot). Borradores y pendientes sin versión aprobada no se enseñan.
 */
export function vistaPublica(p: VistaPlato & { estado: EstadoPlato; aprobado_snapshot: VistaPlato | null }): VistaPlato | null {
  if (p.estado === 'aprobado') {
    return { nombre: p.nombre, kcal: p.kcal, proteinas: p.proteinas, carbohidratos: p.carbohidratos, grasas: p.grasas, ingredientes: p.ingredientes, estimado: p.estimado }
  }
  if (p.estado === 'pendiente' && p.aprobado_snapshot) return p.aprobado_snapshot
  return null
}

/** Un plato solo se aprueba con todas sus líneas enlazadas a un alimento: las macros salen de ahí. */
export function puedeAprobar(p: { lineas: { alimento_id: string | null; cantidad_gramos: number }[] }): { ok: true } | { ok: false; motivo: string } {
  if (p.lineas.length === 0) return { ok: false, motivo: 'El plato no tiene ingredientes' }
  const sinEnlace = p.lineas.filter(l => !l.alimento_id).length
  if (sinEnlace > 0) return { ok: false, motivo: `${sinEnlace} ingrediente(s) sin enlazar a un alimento` }
  return { ok: true }
}
