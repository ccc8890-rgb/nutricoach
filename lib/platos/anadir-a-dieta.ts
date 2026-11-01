// lib/platos/anadir-a-dieta.ts
// «Mis platos»: un plato APROBADO pasa a ser una comida del plan del cliente, con sus ingredientes en gramos (como las comidas que genera la IA).
import type { SupabaseClient } from '@supabase/supabase-js'
import { FRANJAS } from '@/lib/nutricion/semana-dieta'
import { materializarComidasRecurrentes } from '@/lib/nutricion/materializar-comidas'
import type { EntradaDieta } from './dieta'

export class ErrorPlatoDieta extends Error {
  constructor(public codigo: 'no_aprobado' | 'sin_plan' | 'sin_ingredientes', mensaje: string) { super(mensaje) }
}

export async function anadirPlatoADieta(db: SupabaseClient, p: { platoId: string } & EntradaDieta): Promise<{ comidaId: string }> {
  const { data: plato } = await db.from('platos_cliente').select('id, cliente_id, estado, porciones').eq('id', p.platoId).maybeSingle()
  if (!plato || plato.estado !== 'aprobado') throw new ErrorPlatoDieta('no_aprobado', 'Solo se puede añadir a la dieta un plato aprobado')

  const { data: plan } = await db.from('planes_nutricion').select('id').eq('cliente_id', plato.cliente_id).eq('activo', true).maybeSingle()
  if (!plan) throw new ErrorPlatoDieta('sin_plan', 'El cliente no tiene plan de dieta activo')

  const { data: lineas } = await db.from('platos_cliente_ingredientes').select('alimento_id, cantidad_gramos').eq('plato_id', p.platoId)
  const validas = (lineas ?? []).filter(l => l.alimento_id && Number(l.cantidad_gramos) > 0)
  if (validas.length === 0 || validas.length !== (lineas ?? []).length) throw new ErrorPlatoDieta('sin_ingredientes', 'El plato tiene ingredientes sin enlazar')

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

  const factor = p.raciones / Number(plato.porciones || 1)
  const filas = validas.map(l => ({ comida_id: comidaId!, alimento_id: l.alimento_id as string, cantidad_gramos: Math.round(Number(l.cantidad_gramos) * factor * 10) / 10 }))
  const { error: errAl } = await db.from('comida_alimentos').insert(filas)
  if (errAl) throw new Error('No se pudieron añadir los ingredientes')
  await db.from('comidas').update({ receta_id: null, plato_cliente_id: p.platoId }).eq('id', comidaId)
  return { comidaId: comidaId! }
}
