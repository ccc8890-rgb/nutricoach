// lib/platos/anadir-a-dieta.ts
// «Mis platos»: un plato APROBADO pasa a ser una comida del plan del cliente, con sus ingredientes en gramos (como las comidas que genera la IA).
import type { SupabaseClient } from '@supabase/supabase-js'
import { FRANJAS } from '@/lib/nutricion/semana-dieta'
import { materializarComidasRecurrentes } from '@/lib/nutricion/materializar-comidas'
import { factorDeActualizacion, lineasParaDieta, type EntradaDieta } from './dieta'

export class ErrorPlatoDieta extends Error {
  constructor(public codigo: 'no_aprobado' | 'sin_plan' | 'sin_ingredientes', mensaje: string) { super(mensaje) }
}

export async function anadirPlatoADieta(db: SupabaseClient, p: { platoId: string } & EntradaDieta): Promise<{ comidaId: string }> {
  const { data: plato } = await db.from('platos_cliente').select('id, cliente_id, estado, porciones').eq('id', p.platoId).maybeSingle()
  if (!plato || plato.estado !== 'aprobado') throw new ErrorPlatoDieta('no_aprobado', 'Solo se puede añadir a la dieta un plato aprobado')

  const { data: plan } = await db.from('planes_nutricion').select('id').eq('cliente_id', plato.cliente_id).eq('activo', true).maybeSingle()
  if (!plan) throw new ErrorPlatoDieta('sin_plan', 'El cliente no tiene plan de dieta activo')

  const { data: lineas } = await db.from('platos_cliente_ingredientes').select('alimento_id, cantidad_gramos').eq('plato_id', p.platoId)
  const calculo = lineasParaDieta(lineas ?? [], p.raciones, Number(plato.porciones || 1))
  if (!calculo.ok) throw new ErrorPlatoDieta('sin_ingredientes', calculo.motivo)

  await materializarComidasRecurrentes(db, plan.id)
  const { data: delDia } = await db.from('comidas').select('id, nombre').eq('plan_id', plan.id).eq('dia_semana', p.dia)
  let comidaId = (delDia ?? []).find(c => c.nombre === p.franja)?.id as string | undefined
  if (!comidaId) {
    const { data: nueva, error } = await db.from('comidas')
      .insert({ plan_id: plan.id, nombre: p.franja, dia_semana: p.dia, orden: FRANJAS.indexOf(p.franja) + 1 })
      .select('id').single()
    if (error || !nueva) throw new Error('No se pudo crear la comida')
    comidaId = nueva.id
  } else {
    await db.from('comida_alimentos').delete().eq('comida_id', comidaId)
  }

  const { error: errAl } = await db.from('comida_alimentos').insert(calculo.filas.map(f => ({ comida_id: comidaId!, ...f })))
  if (errAl) throw new Error('No se pudieron añadir los ingredientes')
  await db.from('comidas').update({ receta_id: null, plato_cliente_id: p.platoId }).eq('id', comidaId)
  return { comidaId: comidaId! }
}

/**
 * El coach ha aprobado una versión nueva de un plato que ya está en la dieta: se reescriben esas comidas con los ingredientes nuevos,
 * conservando las raciones que tenía cada una. `gramosVersionAnterior` = suma de gramos de la versión aprobada antes de este cambio.
 */
export async function actualizarComidasDePlato(db: SupabaseClient, platoId: string, gramosVersionAnterior: number): Promise<number> {
  const { data: comidas } = await db.from('comidas').select('id').eq('plato_cliente_id', platoId)
  if (!comidas?.length) return 0
  const { data: plato } = await db.from('platos_cliente').select('porciones').eq('id', platoId).maybeSingle()
  const { data: lineas } = await db.from('platos_cliente_ingredientes').select('alimento_id, cantidad_gramos').eq('plato_id', platoId)
  let actualizadas = 0
  for (const c of comidas) {
    const { data: actuales } = await db.from('comida_alimentos').select('cantidad_gramos').eq('comida_id', c.id)
    const gramosComida = (actuales ?? []).reduce((n, a) => n + Number(a.cantidad_gramos || 0), 0)
    const factor = factorDeActualizacion(gramosComida, gramosVersionAnterior, Number(plato?.porciones || 1))
    const nuevas = lineasParaDieta(lineas ?? [], factor * Number(plato?.porciones || 1), Number(plato?.porciones || 1))
    if (!nuevas.ok) continue
    await db.from('comida_alimentos').delete().eq('comida_id', c.id)
    await db.from('comida_alimentos').insert(nuevas.filas.map(f => ({ comida_id: c.id, ...f })))
    actualizadas++
  }
  return actualizadas
}
