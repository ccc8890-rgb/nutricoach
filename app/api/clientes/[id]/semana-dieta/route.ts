import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { comidasDelDia, DIAS_SEMANA } from '@/lib/nutricion/comidas-dia'
import { materializarComidasRecurrentes } from '@/lib/nutricion/materializar-comidas'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'
import { tipoPlatoCompatibleConSlot, type SlotComida } from '@/lib/tipos-comida'

const FRANJAS: SlotComida[] = ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena']
// Reparto orientativo del objetivo diario por franja; se renormaliza con las franjas que tenga el día
const REPARTO: Record<SlotComida, number> = { 'Desayuno': 0.25, 'Media mañana': 0.1, 'Comida': 0.35, 'Merienda': 0.1, 'Cena': 0.3 }

type ComidaFila = {
  id: string; nombre: string; dia_semana: string | null; orden: number; receta_id: string | null
  receta: { id: string; nombre: string; imagen_url: string | null; contenido_estado: string | null; verificacion: string | null } | null
  comida_alimentos: { cantidad_gramos: number; alimento: { calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }[]
}

async function autorizar(request: NextRequest, clienteId: string) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const admin = createServiceSupabase()
  const auth = await autorizarCoachCliente(admin, { userId: user.id, clienteId })
  if (!auth.ok) return { error: NextResponse.json({ error: auth.mensaje }, { status: auth.status }) }
  const { data: plan } = await admin.from('planes_nutricion')
    .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  return { admin, plan }
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
      .select('id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tipo_plato, tiempo_prep_min, verificacion, contenido_estado')
      .eq('estado', 'aprobada').gt('kcal', 0).limit(200)
    const texto = url.searchParams.get('q')?.trim()
    if (texto) q = q.ilike('nombre', `%${texto}%`)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: 'Error cargando recetas' }, { status: 500 })
    const recetas = (data ?? [])
      .filter(x => tipoPlatoCompatibleConSlot(franja, x.tipo_plato))
      .sort((a, b) => Number(!!b.verificacion) - Number(!!a.verificacion) || a.nombre.localeCompare(b.nombre))
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

    const franjasDia = new Set([...(delDia ?? []).map(c => c.nombre), body.franja])
    const repartoTotal = [...franjasDia].reduce((s, f) => s + (REPARTO[f as SlotComida] ?? 0.2), 0)
    const share = REPARTO[body.franja] / repartoTotal
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
