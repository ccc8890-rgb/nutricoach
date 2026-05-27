import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { normalizarRecetasGeneradas } from '@/lib/recetas/importar-lote'

export async function POST(request: NextRequest) {
  const auth = createApiSupabase(request)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const recetas = normalizarRecetasGeneradas(body.recetas ?? body)
  if (recetas.length === 0) {
    return NextResponse.json({ error: 'No hay recetas válidas para importar' }, { status: 400 })
  }

  const db = createServiceSupabase()
  const creadas: Array<{ id: string; nombre: string }> = []

  for (const receta of recetas) {
    const { ingredientes, imagen_prompt, nota_adherencia, ...recetaBase } = receta
    const { data, error } = await db
      .from('recetas')
      .insert({
        ...recetaBase,
        coach_id: user.id,
        estado: 'en_revision',
        fuente: 'ia_lote_deepseek',
        fuente_tipo: 'ia_generada',
        taxonomia_version: 2,
        taxonomia_actualizada_at: new Date().toISOString(),
        imagen_estado: 'sin_imagen',
        imagen_origen: 'missing',
        imagen_needs_review: true,
        imagen_prompt_base: imagen_prompt,
        imagen_review_notes: nota_adherencia
          ? `Nota de adherencia: ${nota_adherencia}`
          : 'Receta generada por lote IA. Requiere imagen realista o revisión antes de aprobar.',
      })
      .select('id, nombre')
      .single()

    if (error || !data) {
      return NextResponse.json({
        error: error?.message || 'No se pudo insertar una receta',
        creadas,
      }, { status: 500 })
    }

    creadas.push({ id: data.id, nombre: data.nombre })

    if (ingredientes.length > 0) {
      const { error: ingredientesError } = await db
        .from('receta_ingredientes')
        .insert(ingredientes.map(ing => ({
          receta_id: data.id,
          alimento_id: null,
          nombre_libre: ing.nombre_libre,
          cantidad_gramos: ing.cantidad_gramos,
          orden: ing.orden,
        })))

      if (ingredientesError) {
        return NextResponse.json({
          error: `Receta creada, pero fallaron ingredientes: ${ingredientesError.message}`,
          creadas,
        }, { status: 500 })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    creadas,
    total: creadas.length,
    aviso: 'Recetas guardadas en revisión. Requieren quality gate y aprobación manual.',
  })
}
