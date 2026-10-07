import type { SupabaseClient } from '@supabase/supabase-js'
import { estadoIconoReceta, type EstadoPieza } from './estados'
import { normalizarEnlace } from './enlace'

export const SELECT_PIEZA = '*, receta:recetas(id, nombre, imagen_url, tiempo_prep_min, estado, verificacion)'

/** Receta del recetario cuyo `url_origen` coincide con el enlace (ignorando parámetros, www y barra final). */
export async function buscarRecetaPorEnlace(db: SupabaseClient, enlace: string): Promise<{ id: string; nombre: string } | null> {
  const clave = normalizarEnlace(enlace)
  if (!clave) return null
  const { data } = await db.from('recetas').select('id, nombre, url_origen').ilike('url_origen', `%${clave}%`).limit(20)
  const r = (data ?? []).find(x => x.url_origen && normalizarEnlace(x.url_origen) === clave)
  return r ? { id: r.id, nombre: r.nombre } : null
}

/** Recalcula `recetas.contenido_estado` (caché del icono del planificador) a partir de las piezas de la receta. */
export async function sincronizarIconoReceta(db: SupabaseClient, coachId: string, recetaId: string | null) {
  if (!recetaId) return
  const { data } = await db.from('piezas_contenido').select('estado').eq('coach_id', coachId).eq('receta_id', recetaId)
  const icono = estadoIconoReceta((data ?? []).map(p => p.estado as EstadoPieza))
  await db.from('recetas').update({ contenido_estado: icono }).eq('id', recetaId)
}

/** Programa recetas del recetario para grabar en `fecha`: promueve su pieza pendiente o crea una. Devuelve cuántas piezas tocó. */
export async function anadirRecetasATanda(db: SupabaseClient, coachId: string, fecha: string, recetaIds: string[]): Promise<number> {
  if (recetaIds.length === 0) return 0
  const { data: recetas } = await db.from('recetas').select('id, nombre').in('id', recetaIds)
  const { data: existentes } = await db.from('piezas_contenido').select('id, receta_id, estado')
    .eq('coach_id', coachId).in('receta_id', recetaIds).in('estado', ['idea', 'documentada', 'para_grabar'])
  let n = 0
  for (const rec of recetas ?? []) {
    const pieza = (existentes ?? []).find(p => p.receta_id === rec.id)
    const { error } = pieza
      ? await db.from('piezas_contenido').update({ estado: 'para_grabar', fecha_grabacion: fecha, updated_at: new Date().toISOString() }).eq('id', pieza.id)
      : await db.from('piezas_contenido').insert({ coach_id: coachId, receta_id: rec.id, titulo: rec.nombre, estado: 'para_grabar', fecha_grabacion: fecha })
    if (!error) n++
    await sincronizarIconoReceta(db, coachId, rec.id)
  }
  return n
}

/** El plan de dieta existe y su cliente es de este coach (los `plan_id` llegan del navegador). */
export async function planEsDelCoach(db: SupabaseClient, planId: string, coachId: string): Promise<boolean> {
  const { data: plan } = await db.from('planes_nutricion').select('cliente_id').eq('id', planId).limit(1)
  if (!plan?.length) return false
  const { data: cliente } = await db.from('clientes').select('id').eq('id', plan[0].cliente_id).eq('coach_id', coachId).limit(1)
  return !!cliente?.length
}
