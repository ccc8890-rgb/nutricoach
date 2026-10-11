import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { categoriaDePlantilla } from '@/lib/entrenos/biblioteca-categorias'

/** Sesiones base de las plantillas del coach, para añadirlas desde el calendario. */
export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()
  const { data, error } = await admin
    .from('plantillas_entrenamiento')
    .select('id, nombre, tipo, sport_modality, sesiones:plantilla_sesiones(id, nombre, orden, duracion_estimada_min, fase_bloque, pasos, ejercicios:plantilla_sesion_ejercicios(id))')
    .eq('coach_id', user.id)
    .eq('activo', true)
  if (error) return NextResponse.json({ error: 'No se pudo cargar la biblioteca' }, { status: 500 })

  const sesiones = (data ?? []).flatMap(p => {
    const categoria = categoriaDePlantilla(p.sport_modality as string | null, p.tipo as string | null)
    return ((p.sesiones ?? []) as { id: string; nombre: string; orden: number | null; duracion_estimada_min: number | null; fase_bloque: string | null; pasos: unknown; ejercicios: { id: string }[] | null }[])
      .map(s => ({
        id: s.id,
        nombre: s.nombre,
        categoria,
        plantilla: p.nombre as string,
        duracion_min: s.duracion_estimada_min,
        n_ejercicios: s.ejercicios?.length ?? 0,
        con_pasos: !!s.pasos,
      }))
  })
  return NextResponse.json({ sesiones })
}
