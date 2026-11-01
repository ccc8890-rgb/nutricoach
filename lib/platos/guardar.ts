// lib/platos/guardar.ts
// «Mis platos»: acceso a datos. Toda lectura/escritura de un plato del cliente pasa por aquí con el cliente_id delante,
// de modo que un plato ajeno es indistinguible de uno inexistente.
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularMacrosPlato } from './macros'
import { enlazarSoloExistente, type AlimentoCache } from './enlazar'
import type { EstadoPlato } from './estado'
import type { LineaEntrada } from './entrada'

export type PlatoFila = {
  id: string; cliente_id: string; nombre: string; tipo_comida: string; nota_cliente: string | null; estado: EstadoPlato
  foto_original_url: string | null; foto_limpia_url: string | null; porciones: number; pasos: string | null
  kcal: number; proteinas: number; carbohidratos: number; grasas: number; incompleto: boolean; estimado: boolean
  ia_modelo: string | null; nota_coach: string | null; aprobado_snapshot: unknown | null; aprobado_at: string | null
  created_at: string; updated_at: string
}
export type LineaFila = { id: string; nombre_libre: string; alimento_id: string | null; cantidad_gramos: number; orden: number }

const COLUMNAS = 'id, cliente_id, nombre, tipo_comida, nota_cliente, estado, foto_original_url, foto_limpia_url, porciones, pasos, kcal, proteinas, carbohidratos, grasas, incompleto, estimado, ia_modelo, nota_coach, aprobado_snapshot, aprobado_at, created_at, updated_at'

/** Un plato SOLO se carga junto con su cliente: si no es suyo, devuelve null (la ruta responde 404). */
export async function cargarPlatoDeCliente(db: SupabaseClient, clienteId: string, platoId: string): Promise<PlatoFila | null> {
  const { data } = await db.from('platos_cliente').select(COLUMNAS).eq('id', platoId).eq('cliente_id', clienteId).maybeSingle()
  return (data as PlatoFila | null) ?? null
}

export async function listarPlatosDeCliente(db: SupabaseClient, clienteId: string, estados?: EstadoPlato[]): Promise<PlatoFila[]> {
  let q = db.from('platos_cliente').select(COLUMNAS).eq('cliente_id', clienteId).order('updated_at', { ascending: false }).limit(200)
  if (estados?.length) q = q.in('estado', estados)
  const { data } = await q
  return (data as PlatoFila[] | null) ?? []
}

export async function cargarLineas(db: SupabaseClient, platoId: string): Promise<LineaFila[]> {
  const { data } = await db.from('platos_cliente_ingredientes').select('id, nombre_libre, alimento_id, cantidad_gramos, orden').eq('plato_id', platoId).order('orden')
  return (data as LineaFila[] | null) ?? []
}

export async function alimentosCache(db: SupabaseClient): Promise<AlimentoCache[]> {
  const cols = 'id, nombre, calorias, proteinas, carbohidratos, grasas, fibra'
  const base = await db.from('alimentos').select(cols).eq('es_base', true).limit(3000)
  if (!base.error && base.data?.length) return base.data as AlimentoCache[]
  const todo = await db.from('alimentos').select(cols).limit(3000)
  return (todo.data as AlimentoCache[] | null) ?? []
}

/** Sustituye las líneas del plato. Conserva el enlace manual del coach (mismo alimento_id ya presente); el resto se enlaza por nombre. */
export async function guardarLineas(db: SupabaseClient, clienteId: string, platoId: string, lineas: LineaEntrada[], cache: AlimentoCache[]): Promise<void> {
  const existentes = await cargarLineas(db, platoId)
  const idsConocidos = new Set(existentes.map(l => l.alimento_id).filter((x): x is string => !!x))
  const filas: { plato_id: string; nombre_libre: string; alimento_id: string | null; cantidad_gramos: number; orden: number }[] = []
  for (const [i, l] of lineas.entries()) {
    let alimentoId = l.alimento_id && idsConocidos.has(l.alimento_id) ? l.alimento_id : null
    if (!alimentoId) alimentoId = (await enlazarSoloExistente(db, l.nombre_libre, cache))?.alimento_id ?? null
    filas.push({ plato_id: platoId, nombre_libre: l.nombre_libre, alimento_id: alimentoId, cantidad_gramos: l.cantidad_gramos, orden: i })
  }
  await db.from('platos_cliente_ingredientes').delete().eq('plato_id', platoId)
  if (filas.length) await db.from('platos_cliente_ingredientes').insert(filas)
  await recalcularYGuardar(db, clienteId, platoId)
}

export async function recalcularYGuardar(db: SupabaseClient, clienteId: string, platoId: string): Promise<void> {
  const { data } = await db.from('platos_cliente_ingredientes')
    .select('cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas)').eq('plato_id', platoId)
  const lineas = ((data ?? []) as unknown as { cantidad_gramos: number; alimento: unknown }[]).map(l => ({
    cantidad_gramos: Number(l.cantidad_gramos),
    alimento: (Array.isArray(l.alimento) ? l.alimento[0] : l.alimento) as { calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null ?? null,
  }))
  const m = calcularMacrosPlato(lineas)
  await db.from('platos_cliente').update({ kcal: m.kcal, proteinas: m.proteinas, carbohidratos: m.carbohidratos, grasas: m.grasas, incompleto: m.incompleto, updated_at: new Date().toISOString() })
    .eq('id', platoId).eq('cliente_id', clienteId)
}

export async function contarAnalisisUltimas24h(db: SupabaseClient, clienteId: string): Promise<number> {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await db.from('platos_analisis_log').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId).gte('created_at', desde)
  return count ?? 0
}
