import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { inferirSlotComida, tipoPlatoCompatibleConSlot, tiposPermitidosPorSlot } from '@/lib/tipos-comida'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string; comidaId: string }> }
) {
  const { codigo, comidaId } = await params
  const db = createServiceSupabase()

  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id, cliente_id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .single()

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const { data: comida } = await db
    .from('comidas')
    .select('id, nombre, receta_id, alternativas_receta_ids, kcal_target, proteinas_target')
    .eq('id', comidaId)
    .eq('plan_id', plan.id)
    .single()

  if (!comida) return NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 })

  const slot = inferirSlotComida(comida.nombre)
  const tiposPermitidos = tiposPermitidosPorSlot(slot)

  let alternativaIds: string[] = (comida.alternativas_receta_ids ?? []).filter((id: string) => id !== comida.receta_id)

  if (alternativaIds.length > 0) {
    const { data: existentes } = await db
      .from('recetas')
      .select('id, tipo_plato')
      .in('id', alternativaIds)
    const compatibles = new Set((existentes ?? [])
      .filter(r => tipoPlatoCompatibleConSlot(slot, r.tipo_plato))
      .map(r => r.id))
    alternativaIds = alternativaIds.filter(id => compatibles.has(id))
  }

  if (alternativaIds.length < 3) {
    const { data: onboarding } = await db
      .from('onboarding_responses')
      .select('restricciones')
      .eq('cliente_id', plan.cliente_id)
      .maybeSingle()

    const restricciones: string[] = onboarding?.restricciones ?? []
    const targetKcal = Number(comida.kcal_target ?? 0)
    const targetProt = Number(comida.proteinas_target ?? 0)

    const { data: recetas } = await db
      .from('recetas')
      .select('id, kcal, proteinas, intolerancias, tipo_plato')
      .eq('estado', 'aprobada')
      .in('tipo_plato', tiposPermitidos.length ? tiposPermitidos : ['Comida', 'Cena', 'Desayuno', 'Merienda', 'Snack', 'Postre'])
      .gt('kcal', 0)
      .limit(120)

    const nuevas = (recetas ?? [])
      .filter(r => r.id !== comida.receta_id && !alternativaIds.includes(r.id))
      .filter(r => tipoPlatoCompatibleConSlot(slot, r.tipo_plato))
      .filter(r => {
        if (!restricciones.length) return true
        const intolerancias: string[] = r.intolerancias ?? []
        return !restricciones.some(res => intolerancias.includes(res))
      })
      .map(r => ({
        id: r.id,
        dist:
          (targetKcal > 0 ? Math.abs(Number(r.kcal) - targetKcal) / targetKcal : 0) +
          (targetProt > 0 ? Math.abs(Number(r.proteinas ?? 0) - targetProt) / targetProt : 0),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3 - alternativaIds.length)
      .map(r => r.id)

    alternativaIds = [...alternativaIds, ...nuevas]

    if (alternativaIds.length > 0) {
      await db.from('comidas').update({ alternativas_receta_ids: alternativaIds }).eq('id', comidaId)
    }
  }

  if (alternativaIds.length === 0) return NextResponse.json({ alternativas: [] })

  const { data: recetas } = await db
    .from('recetas')
    .select('id, nombre, imagen_url, url_origen, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min, tipo_plato')
    .in('id', alternativaIds.slice(0, 3))

  const orden = new Map(alternativaIds.map((id, index) => [id, index]))
  const alternativas = (recetas ?? [])
    .sort((a, b) => (orden.get(a.id) ?? 99) - (orden.get(b.id) ?? 99))
    .filter(r => tipoPlatoCompatibleConSlot(slot, r.tipo_plato))
    .map(r => ({
      id: r.id,
      nombre: r.nombre,
      imagen_url: r.imagen_url,
      tiene_foto_real: !!r.url_origen,
      kcal: r.kcal,
      proteinas: r.proteinas,
      carbohidratos: r.carbohidratos,
      grasas: r.grasas,
      tiempo_prep_min: r.tiempo_prep_min,
    }))

  return NextResponse.json({ alternativas })
}
