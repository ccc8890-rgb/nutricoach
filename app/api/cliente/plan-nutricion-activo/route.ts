import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * Bug real (revisión 27-09-2026): app/cliente/page.tsx pedía el plan de
 * nutrición activo directamente desde el cliente Supabase del navegador con
 * un join anidado de 3 niveles (planes_nutricion → comidas →
 * comida_alimentos → alimentos). RLS corta ese join en silencio — sin
 * error, sin 403, simplemente `comidas: []` — así que TODO cliente real
 * veía su plan de dieta activo pero con 0 comidas y todas las macros a
 * cero. Mismo patrón ya documentado para las tablas de entrenamiento:
 * cualquier query que cruce ≥2 tablas con RLS activo va por una API route
 * con service role, nunca por un join anidado desde el cliente.
 */
export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: plan, error } = await admin
    .from('planes_nutricion')
    .select(`
      *,
      comidas(
        *,
        alimentos:comida_alimentos(*, alimento:alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas, fibra)),
        receta:recetas(id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min)
      )
    `)
    .eq('cliente_id', clienteData.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ plan: plan ?? null })
}
