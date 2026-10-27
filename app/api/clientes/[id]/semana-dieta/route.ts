import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta as autorizar, FRANJAS, repartoFranja } from '@/lib/nutricion/semana-dieta'
import { comidasDelDia, DIAS_SEMANA } from '@/lib/nutricion/comidas-dia'
import { objetivosPorDia } from '@/lib/nutricion/objetivo-dia'
import { materializarComidasRecurrentes } from '@/lib/nutricion/materializar-comidas'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import { tipoPlatoCompatibleConSlot, type SlotComida } from '@/lib/tipos-comida'
import { aplicarBusquedaNombre } from '@/lib/recetas/busqueda'

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
    const texto = url.searchParams.get('q')?.trim()
    // Modo postres: recetas dulces o de picoteo para añadir como complemento de una comida
    const soloPostres = url.searchParams.get('postres') === '1'
    // Modo platos: cualquier receta aprobada (guarniciones primero) para sumar varios platos a una misma comida
    const todas = url.searchParams.get('todas') === '1'
    const columnas = 'id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tipo_receta, tiempo_prep_min, verificacion, contenido_estado, familia, tipo_contenido'
    const consulta = (extra: string) => {
      let q = admin.from('recetas').select(columnas + extra).eq('estado', 'aprobada').gt('kcal', 0).limit(1000)
      if (texto) q = aplicarBusquedaNombre(q, texto)
      if (soloPostres) q = q.or('tipo_plato.eq.Postre,tipo_receta.eq.snack_postre')
      return q
    }
    // `proteinas_principales` viene de una migración: si aún no está aplicada, el selector funciona sin esos botones
    let res = await consulta(', proteinas_principales')
    if (res.error) res = await consulta('')
    if (res.error) return NextResponse.json({ error: 'Error cargando recetas' }, { status: 500 })
    const data = res.data as unknown as (Record<string, unknown> & { id: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number; tipo_plato: string | null; tipo_receta: string | null; tipo_contenido: string | null; verificacion: string | null; proteinas_principales?: string[] | null })[] | null
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
      .filter(x => (todas || x.tipo_contenido !== 'elaboracion') && (soloPostres || todas || tipoPlatoCompatibleConSlot(franja, x.tipo_plato)))
      .sort((a, b) => (todas ? Number(b.tipo_receta === 'guarnicion') - Number(a.tipo_receta === 'guarnicion') : 0) || Number(!!b.verificacion) - Number(!!a.verificacion) || encaje(a) - encaje(b))
      .slice(0, 300)

    // Datos para decidir de un vistazo: macros ya ajustados al hueco, repeticiones en el plan y favoritas del cliente
    const dia = url.searchParams.get('dia')
    const od = dia && DIAS_SEMANA.includes(dia as typeof DIAS_SEMANA[number]) ? (await objetivosPorDia(admin, clienteId, plan))[dia] : undefined
    const kcalDia = od?.kcal || kcalObj
    const objetivoHueco = kcalDia > 0 ? kcalDia * (await repartoFranja(admin, plan.id, franja)) : 0
    const [{ data: usadas }, { data: favs }] = await Promise.all([
      admin.from('comidas').select('receta_id').eq('plan_id', plan.id).not('receta_id', 'is', null),
      admin.from('recetas_favoritas_cliente').select('receta_id').eq('cliente_id', clienteId),
    ])
    const usos = new Map<string, number>()
    for (const u of usadas ?? []) usos.set(u.receta_id, (usos.get(u.receta_id) ?? 0) + 1)
    // Variedad del plan: cuántas comidas hay de cada proteína principal
    const idsUsados = [...usos.keys()]
    const { data: protUsadas } = idsUsados.length ? await admin.from('recetas').select('id, proteinas_principales').eq('estado', 'aprobada').in('id', idsUsados) : { data: [] as { id: string; proteinas_principales: string[] | null }[] } // sin la migración devuelve error y data null: variedad queda vacía
    const variedad: Record<string, number> = {}
    for (const r of protUsadas ?? []) for (const p of r.proteinas_principales ?? []) variedad[p] = (variedad[p] ?? 0) + (usos.get(r.id) ?? 0)
    const favoritas = new Set((favs ?? []).map(f => f.receta_id))
    const enriquecidas = recetas.map(x => {
      const f = !soloPostres && !todas && objetivoHueco > 0 && x.kcal > 0 ? objetivoHueco / x.kcal : 1
      return {
        ...x,
        kcal_hueco: Math.round(x.kcal * f), proteinas_hueco: Math.round(x.proteinas * f),
        encaje: Math.round(encaje(x) * 100) / 100,
        usos: usos.get(x.id) ?? 0, favorita: favoritas.has(x.id),
      }
    })
    return NextResponse.json({ recetas: enriquecidas, variedad })
  }

  const [{ data: comidas, error }, { data: cliente, error: clienteError }] = await Promise.all([
    admin.from('comidas')
      .select('id, nombre, dia_semana, orden, receta_id, receta:recetas(id, nombre, imagen_url, contenido_estado, verificacion), comida_alimentos(cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas))')
      .eq('plan_id', plan.id),
    admin.from('clientes').select('comidas_dia').eq('id', clienteId).single(),
  ])
  if (error) return NextResponse.json({ error: 'Error cargando comidas' }, { status: 500 })
  if (clienteError) return NextResponse.json({ error: 'Error cargando cliente' }, { status: 500 })

  const filas = (comidas ?? []) as unknown as ComidaFila[]
  const dias = DIAS_SEMANA.map((dia, i) => {
    const delDia = comidasDelDia(filas, i).map(c => {
      const m = macros(c)
      return { id: c.id, nombre: c.nombre, recurrente: !c.dia_semana, receta: c.receta, kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), g: Math.round(m.g) }
    })
    const total = delDia.reduce((a, c) => ({ kcal: a.kcal + c.kcal, p: a.p + c.p, c: a.c + c.c, g: a.g + c.g }), { kcal: 0, p: 0, c: 0, g: 0 })
    return { dia, comidas: delDia, total }
  })
  return NextResponse.json({ plan, dias, franjas: FRANJAS, objetivos_dia: await objetivosPorDia(admin, clienteId, plan), comidas_dia: cliente?.comidas_dia ?? null })
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
    const od = (await objetivosPorDia(admin, clienteId, plan))[body.dia]
    const objetivo = (v: number | null | undefined) => (v ? v * share : undefined)

    await aplicarRecetaAComida(admin, {
      comidaId: comida.id,
      recetaId: body.receta_id,
      clienteId,
      planId: plan.id,
      comidaSlot: body.franja,
      targetKcal: objetivo(od?.kcal || plan.kcal_objetivo),
      targetProteinas: objetivo(od?.kcal ? od.p : plan.proteinas_objetivo),
      targetCarbohidratos: objetivo(od?.kcal ? od.c : plan.carbohidratos_objetivo),
      targetGrasas: objetivo(od?.kcal ? od.g : plan.grasas_objetivo),
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
