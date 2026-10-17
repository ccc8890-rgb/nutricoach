// Edición rápida de una receta: solo campos sin efecto en macros. Ingredientes, gramos, raciones y estado quedan fuera.
export type CamposEditables = Partial<{ nombre: string; descripcion: string; tiempo_prep_min: number; categoria: string; tags: string[] }>

export function limpiarCamposEditables(body: unknown): { ok: true; cambios: CamposEditables } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const cambios: CamposEditables = {}
  if ('nombre' in b) {
    const n = typeof b.nombre === 'string' ? b.nombre.trim() : ''
    if (n.length < 1 || n.length > 120) return { ok: false, error: 'El nombre debe tener entre 1 y 120 caracteres' }
    cambios.nombre = n
  }
  if ('descripcion' in b) {
    if (typeof b.descripcion !== 'string') return { ok: false, error: 'Descripción no válida' }
    cambios.descripcion = b.descripcion.trim().slice(0, 1000)
  }
  if ('tiempo_prep_min' in b) {
    const t = b.tiempo_prep_min
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 0 || t > 1440) return { ok: false, error: 'El tiempo debe ser un número entero de minutos (0-1440)' }
    cambios.tiempo_prep_min = t
  }
  if ('categoria' in b) {
    if (typeof b.categoria !== 'string' || b.categoria.trim().length > 60) return { ok: false, error: 'Categoría no válida' }
    cambios.categoria = b.categoria.trim()
  }
  if ('tags' in b) {
    if (!Array.isArray(b.tags)) return { ok: false, error: 'Etiquetas no válidas' }
    const tags = b.tags.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean)
    if (tags.length > 20 || tags.some(x => x.length > 40)) return { ok: false, error: 'Máximo 20 etiquetas de 40 caracteres' }
    cambios.tags = tags
  }
  if (Object.keys(cambios).length === 0) return { ok: false, error: 'No hay cambios que guardar' }
  return { ok: true, cambios }
}
