import {
  agruparEjerciciosPorBloque,
  etiquetaBloqueSesion,
  normalizarBloqueSesion,
  type TipoBloqueSesion,
} from './session-blocks'

export function crearGruposEditorSesion<T extends { orden: number; bloque?: unknown }>(items: T[]) {
  return agruparEjerciciosPorBloque(items).map(grupo => ({
    ...grupo,
    label: etiquetaBloqueSesion(grupo.bloque),
  }))
}

export function combinarOrdenBloque<T extends { id: string; orden: number; bloque?: unknown }>(
  items: T[],
  bloque: TipoBloqueSesion,
  idsOrdenados: string[],
) {
  const porId = new Map(items.map(item => [item.id, item]))
  const sustitutos = idsOrdenados
    .map(id => porId.get(id))
    .filter((item): item is T => Boolean(item))
  let cursor = 0

  return [...items]
    .sort((a, b) => a.orden - b.orden)
    .map(item => normalizarBloqueSesion(item.bloque) === bloque ? sustitutos[cursor++] ?? item : item)
    .map((item, orden) => ({ ...item, orden }))
}

export function crearGuardiaActualizacionBloque() {
  const activos = new Set<string>()
  return {
    iniciar(id: string) {
      if (activos.has(id)) return false
      activos.add(id)
      return true
    },
    finalizar(id: string) {
      activos.delete(id)
    },
    estaGuardando(id: string) {
      return activos.has(id)
    },
  }
}
