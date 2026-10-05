import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta as autorizar, FRANJAS, repartoFranja } from '@/lib/nutricion/semana-dieta'
import { comidasDelDia, DIAS_SEMANA } from '@/lib/nutricion/comidas-dia'
import { materializarComidasRecurrentes } from '@/lib/nutricion/materializar-comidas'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import { tipoPlatoCompatibleConSlot, type SlotComida } from '@/lib/tipos-comida'

type ComidaFila = {
  id: string; nombre: string; dia_semana: string | null; orden: number; receta_id: string | null
  receta: { id: string; nombre: string; imagen_url: string | null; contenido_estado: string | null; verificacion: string | null } | null
  comida_alimentos: { cantidad_gramos: number; alimento: { calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }[]
}

function macros(c: ComidaFila) {
  return (c.comida_alimentos ?? []).reduce((acc, ca) => {
    const a = ca.alimento
    if (!a) return acc
    const f = (ca.cantidad_gramos ?? 0) / 100
    return { kcal: acc.kcal + a.calorias * f, p: acc.p + a.proteinas * f, c: acc.c + a.carbohidratos * f, g: acc.g + a.grasas * f }
  }, { kcal: 0, p: 0, c: 0, g: 0 })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const r = await autorizar(request, clienteId)
  if ('error' in r) return r.error
  const { admin, plan } = r
  if (!plan) return NextResponse.json({ plan: null, dias: [] })

  const url = new URL(request.url)
  const franja = url.searchParams.get('franja') as SlotComida | null
  if (franja) {
    // Selector de recetas para una franja: verificadas primero, con búsqueda opcional
    let q = admin.from('recetas')
      .select('id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tipo_receta, tiempo_prep_min, verificacion, contenido_estado')
      .eq('estado', 'aprobada').gt('kcal', 0).limit(200)
    const texto = url.searchParams.get('q')?.trim()
    if (texto) q = q.ilike('nombre', `%${texto}%`)
    // Modo postres: recetas dulces o de picoteo para añadir como complemento de una comida
    const soloPostres = url.searchParams.get('postres') === '1'
    // Modo platos: cualquier receta aprobada (guarniciones primero) para sumar varios platos a una misma comida
    const todas = url.searchParams.get('todas') === '1'
    if (soloPostres) q = q.or('tipo_plato.eq.Postre,tipo_receta.eq.snack_postre')
    const { data, error } = await q
    if (error) return NextResponse.json({ error: 'Error cargando recetas' }, { status: 500 })
    // Las cantidades se reescalan al asignar, así que importa la PROPORCIÓN de macros, no las kcal
    const kcalObj = plan.kcal_objetivo || 0
    const reparto = (v: number | null) => (kcalObj > 0 && v ? v / kcalObj : null)
    const obj = { p: reparto((plan.proteinas_objetivo ?? 0) * 4), c: reparto((plan.carbohidratos_objetivo ?? 0) * 4), g: reparto((plan.grasas_objetivo ?? 0) * 9) }
    const encaje = (x: { kcal: number; proteinas: number; carbohidratos: number; grasas: number }) => {
      if (!x.kcal) return 9
      const r = { p: (x.proteinas * 4) / x.kcal, c: (x.carbohidratos * 4) / x.kcal, g: (x.grasas * 9) / x.kcal }
      return (obj.p != null ? 2 * Math.abs(r.p - obj.p) : 0) + (obj.c != null ? Math.abs(r.c - obj.c) : 0) + (obj.g != null ? Math.abs(r.g - obj.g) : 0)
    }
    const recetas = (data ?? [])
      .filter(x => soloPostres || todas || tipoPlatoCompatibleConSlot(franja, x.tipo_plato))
      .sort((a, b) => (todas ? Number(b.tipo_receta === 'guarnicion') - Number(a.tipo_receta === 'guarnicion') : 0) || Number(!!b.verificacion) - Number(!!a.verificacion) || encaje(a) - encaje(b))
      .slice(0, 60)
    return NextResponse.json({ recetas })
  }

  const { data: comidas, error } = await admin.from('comidas')
    .select('id, nombre, dia_semana, orden, receta_id, receta:recetas(id, nombre, imagen_url, contenido_estado, verificacion), comida_alimentos(cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas))')
    .eq('plan_id', plan.id)
  if (error) return NextResponse.json({ error: 'Error cargando comidas' }, { status: 500 })

  const filas = (comidas ?? []) as unknown as ComidaFila[]
  const dias = DIAS_SEMANA.map((dia, i) => {
    const delDia = comidasDelDia(filas, i).map(c => {
      const m = macros(c)
      return { id: c.id, nombre: c.nombre, recurrente: !c.dia_semana, receta: c.receta, kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), g: Math.round(m.g) }
    })
    const total = delDia.reduce((a, c) => ({ kcal: a.kcal + c.kcal, p: a.p + c.p, c: a.c + c.c, g: a.g + c.g }), { kcal: 0, p: 0, c: 0, g: 0 })
    return { dia, comidas: delDia, total }
  })
  return NextResponse.json({ plan, dias, franjas: FRANJAS })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const r = await autorizar(request, clienteId)
  if ('error' in r) return r.error
  const { admin, plan } = r
  if (!plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })

  const body = await request.json().catch(() => null) as { dia?: string; franja?: SlotComida; receta_id?: string } | null
  if (!body?.dia || !DIAS_SEMANA.includes(body.dia as typeof DIAS_SEMANA[number]) || !body.franja || !FRANJAS.includes(body.franja) || !body.receta_id) {
    return NextResponse.json({ error: 'Faltan día, franja o receta' }, { status: 400 })
  }

  try {
    await materializarComidasRecurrentes(admin, plan.id)

    const { data: delDia } = await admin.from('comidas').select('id, nombre, orden').eq('plan_id', plan.id).eq('dia_semana', body.dia)
    let comida = (delDia ?? []).find(c => c.nombre === body.franja)
    if (!comida) {
      const { data: nueva, error } = await admin.from('comidas')
        .insert({ plan_id: plan.id, nombre: body.franja, dia_semana: body.dia, orden: FRANJAS.indexOf(body.franja) + 1 })
        .select('id, nombre, orden').single()
      if (error || !nueva) throw new Error('No se pudo crear la comida')
      comida = nueva
    }

    // Reparto según las franjas del plan en toda la semana: así el objetivo de una franja
    // no depende de cuántas comidas tenga ya ese día concreto
    const share = await repartoFranja(admin, plan.id, body.franja)
    const objetivo = (v: number | null) => (v ? v * share : undefined)

    await aplicarRecetaAComida(admin, {
      comidaId: comida.id,
      recetaId: body.receta_id,
      clienteId,
      planId: plan.id,
      comidaSlot: body.franja,
      targetKcal: objetivo(plan.kcal_objetivo),
      targetProteinas: objetivo(plan.proteinas_objetivo),
      targetCarbohidratos: objetivo(plan.carbohidratos_objetivo),
      targetGrasas: objetivo(plan.grasas_objetivo),
      tipoInteraccion: 'asignada_plan',
      reemplazar: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[semana-dieta POST]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo asignar la receta' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const r = await autorizar(request, clienteId)
  if ('error' in r) return r.error
  const { admin, plan } = r
  const comidaId = new URL(request.url).searchParams.get('comida_id')
  if (!plan || !comidaId) return NextResponse.json({ error: 'Falta comida' }, { status: 400 })

  const { data: comida } = await admin.from('comidas').select('id, dia_semana').eq('id', comidaId).eq('plan_id', plan.id).maybeSingle()
  if (!comida) return NextResponse.json({ error: 'Comida no encontrada en el plan' }, { status: 404 })
  if (!comida.dia_semana) return NextResponse.json({ error: 'Es una comida de todos los días: asigna una receta en un día concreto primero' }, { status: 409 })
  await admin.from('comida_alimentos').delete().eq('comida_id', comidaId)
  const { error } = await admin.from('comidas').delete().eq('id', comidaId)
  if (error) return NextResponse.json({ error: 'No se pudo quitar la comida' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
