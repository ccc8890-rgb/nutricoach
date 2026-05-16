import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { procesarFeedback } from '@/lib/personalizacion/actualizar-perfil'

export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const {
    cliente_id,
    accion,
    razon,
    tipo_comida,
    comida_nombre,
    comida_ingredientes,
    macros_objetivo,
  } = body

  if (!cliente_id || !accion || !comida_nombre) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const ingredientes: string[] = (comida_ingredientes ?? []).map(
    (i: { nombre: string }) => i.nombre
  )

  try {
    await procesarFeedback(cliente_id, {
      accion,
      razon: razon ?? null,
      ingredientes,
      tipoComida: tipo_comida ?? 'comida',
      comidaNombre: comida_nombre,
      comidaIngredientes: comida_ingredientes ?? [],
      macrosObjetivo: macros_objetivo ?? { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
    })
  } catch {
    return NextResponse.json({ error: 'Error al guardar feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
