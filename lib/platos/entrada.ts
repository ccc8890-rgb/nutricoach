// lib/platos/entrada.ts
// «Mis platos»: validación pura de lo que envía el cliente (edición, foto) y vista congelada para el snapshot de aprobación.
import { MAX_FOTO_BYTES, TIPOS_FOTO, type VistaPlato } from './estado'

export const TIPOS_COMIDA = ['Desayuno', 'Comida', 'Cena', 'Snack', 'Otro'] as const
export type TipoComida = (typeof TIPOS_COMIDA)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type LineaEntrada = { nombre_libre: string; cantidad_gramos: number; alimento_id: string | null }
export type EdicionPlato = { nombre?: string; tipo_comida?: TipoComida; porciones?: number; pasos?: string; nota_cliente?: string; lineas?: LineaEntrada[] }

export function validarEdicion(body: unknown): { ok: true; valor: EdicionPlato } | { ok: false; motivo: string } {
  if (!body || typeof body !== 'object') return { ok: false, motivo: 'Cuerpo no válido' }
  const o = body as Record<string, unknown>
  const v: EdicionPlato = {}

  if (o.nombre !== undefined) {
    const n = typeof o.nombre === 'string' ? o.nombre.trim() : ''
    if (n.length < 1 || n.length > 80) return { ok: false, motivo: 'Nombre no válido' }
    v.nombre = n
  }
  if (o.tipo_comida !== undefined) {
    if (!(TIPOS_COMIDA as readonly unknown[]).includes(o.tipo_comida)) return { ok: false, motivo: 'Tipo de comida no válido' }
    v.tipo_comida = o.tipo_comida as TipoComida
  }
  if (o.porciones !== undefined) {
    const p = Number(o.porciones)
    if (!Number.isFinite(p) || p <= 0 || p > 12) return { ok: false, motivo: 'Raciones no válidas' }
    v.porciones = p
  }
  if (o.pasos !== undefined) {
    if (typeof o.pasos !== 'string' || o.pasos.length > 3000) return { ok: false, motivo: 'Pasos no válidos' }
    v.pasos = o.pasos
  }
  if (o.nota_cliente !== undefined) {
    if (typeof o.nota_cliente !== 'string' || o.nota_cliente.length > 500) return { ok: false, motivo: 'Nota no válida' }
    v.nota_cliente = o.nota_cliente
  }
  if (o.lineas !== undefined) {
    if (!Array.isArray(o.lineas) || o.lineas.length > 25) return { ok: false, motivo: 'Máximo 25 ingredientes' }
    const lineas: LineaEntrada[] = []
    for (const l of o.lineas) {
      const nombre = typeof l?.nombre_libre === 'string' ? l.nombre_libre.trim() : ''
      const g = Number(l?.cantidad_gramos)
      if (nombre.length < 2 || nombre.length > 80) return { ok: false, motivo: 'Ingrediente no válido' }
      if (!Number.isFinite(g) || g < 0 || g > 2000) return { ok: false, motivo: `Cantidad no válida para «${nombre}»` }
      const id = l?.alimento_id ?? null
      if (id !== null && (typeof id !== 'string' || !UUID.test(id))) return { ok: false, motivo: 'Alimento no válido' }
      lineas.push({ nombre_libre: nombre, cantidad_gramos: Math.round(g * 10) / 10, alimento_id: id })
    }
    v.lineas = lineas
  }
  return { ok: true, valor: v }
}

export function fotoValida(tipo: string, bytes: number): { ok: true } | { ok: false; motivo: string } {
  if (!(TIPOS_FOTO as readonly string[]).includes(tipo)) return { ok: false, motivo: 'Formato de imagen no permitido' }
  if (bytes <= 0) return { ok: false, motivo: 'El archivo está vacío' }
  if (bytes > MAX_FOTO_BYTES) return { ok: false, motivo: 'La foto supera los 8 MB' }
  return { ok: true }
}

export function construirVista(
  p: { nombre: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number; estimado: boolean },
  lineas: { nombre_libre: string; cantidad_gramos: number }[],
): VistaPlato {
  return {
    nombre: p.nombre, kcal: p.kcal, proteinas: p.proteinas, carbohidratos: p.carbohidratos, grasas: p.grasas, estimado: p.estimado,
    ingredientes: lineas.map(l => ({ nombre_libre: l.nombre_libre, cantidad_gramos: l.cantidad_gramos })),
  }
}
