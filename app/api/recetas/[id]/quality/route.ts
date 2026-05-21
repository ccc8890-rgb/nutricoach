import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

type IssueSeverity = 'bloqueante' | 'revisar' | 'aviso'

const RANGOS_KCAL: Record<string, { min: number; max: number }> = {
  Desayuno: { min: 150, max: 700 },
  Almuerzo: { min: 100, max: 600 },
  Comida: { min: 100, max: 900 },
  Merienda: { min: 80, max: 500 },
  Cena: { min: 100, max: 850 },
  Snack: { min: 50, max: 500 },
}

function issue(severity: IssueSeverity, codigo: string, mensaje: string) {
  return { severity, codigo, mensaje }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = createApiSupabase(request)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const srv = createServiceSupabase()
    const [{ data: receta }, { data: ingredientes }] = await Promise.all([
      srv
        .from('recetas')
        .select('id, nombre, tipo_plato, porciones, kcal_por_porcion, kcal')
        .eq('id', id)
        .single(),
      srv
        .from('receta_ingredientes')
        .select('id, alimento_id, nombre_libre, cantidad_gramos, alimentos(id,nombre,calorias,proteinas,carbohidratos,grasas)')
        .eq('receta_id', id)
        .order('cantidad_gramos', { ascending: false }),
    ])

    if (!receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })

    const issues = []
    const ings = ingredientes || []
    if (ings.length < 3) issues.push(issue('aviso', 'pocos_ingredientes', `Solo tiene ${ings.length} ingrediente${ings.length === 1 ? '' : 's'}.`))

    const sinAlimento = ings.filter(i => !i.alimento_id)
    if (sinAlimento.length > 0) issues.push(issue('bloqueante', 'ingredientes_sin_alimento', `${sinAlimento.length} ingrediente${sinAlimento.length === 1 ? '' : 's'} sin alimento vinculado.`))

    const cantidadInvalida = ings.filter(i => !Number.isFinite(Number(i.cantidad_gramos)) || Number(i.cantidad_gramos) <= 0)
    if (cantidadInvalida.length > 0) issues.push(issue('bloqueante', 'cantidad_invalida', `${cantidadInvalida.length} ingrediente${cantidadInvalida.length === 1 ? '' : 's'} sin cantidad válida.`))

    const alimentoIds = ings.map(i => i.alimento_id).filter(Boolean)
    const { data: precios } = alimentoIds.length
      ? await srv.from('mejores_precios_por_alimento').select('alimento_id').in('alimento_id', alimentoIds)
      : { data: [] as Array<{ alimento_id: string }> }
    const conPrecio = new Set((precios || []).map(p => p.alimento_id))
    const conAlimento = ings.filter(i => i.alimento_id)
    const sinPrecio = conAlimento.filter(i => !conPrecio.has(i.alimento_id))
    const coberturaPct = conAlimento.length > 0 ? Math.round(((conAlimento.length - sinPrecio.length) / conAlimento.length) * 100) : 0
    if (conAlimento.length > 0 && coberturaPct < 80) {
      issues.push(issue('revisar', 'cobertura_precio_baja', `Cobertura de precios ${coberturaPct}%. Faltan ${sinPrecio.length} ingrediente${sinPrecio.length === 1 ? '' : 's'} con precio.`))
    }

    const porciones = receta.porciones || 1
    const kcalPorPorcion = receta.kcal_por_porcion || ((receta.kcal || 0) / porciones)
    const rango = receta.tipo_plato ? RANGOS_KCAL[receta.tipo_plato] : null
    if (rango && kcalPorPorcion > 0) {
      if (kcalPorPorcion < rango.min) issues.push(issue('revisar', 'kcal_bajas', `${Math.round(kcalPorPorcion)} kcal por porción para ${receta.tipo_plato}.`))
      if (kcalPorPorcion > rango.max) issues.push(issue('revisar', 'kcal_altas', `${Math.round(kcalPorPorcion)} kcal por porción para ${receta.tipo_plato}.`))
    }

    return NextResponse.json({
      ok: !issues.some(i => i.severity === 'bloqueante' || i.severity === 'revisar'),
      cobertura_pct: coberturaPct,
      ingredientes_sin_precio: sinPrecio.length,
      issues,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[API recetas/quality]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
