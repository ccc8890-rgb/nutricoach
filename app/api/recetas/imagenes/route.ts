import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

type FiltroImagen = 'pendientes' | 'sin_imagen' | 'sospechosas' | 'ai' | 'scraped' | 'aprobadas' | 'rechazadas' | 'todas'

function normalizarFiltro(value: string | null): FiltroImagen {
  const allowed: FiltroImagen[] = ['pendientes', 'sin_imagen', 'sospechosas', 'ai', 'scraped', 'aprobadas', 'rechazadas', 'todas']
  return allowed.includes(value as FiltroImagen) ? value as FiltroImagen : 'pendientes'
}

export async function GET(request: NextRequest) {
  const auth = createApiSupabase(request)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filtro = normalizarFiltro(searchParams.get('filtro'))
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 80), 1), 200)

  const db = createServiceSupabase()
  let query = db
    .from('recetas')
    .select(`
      id, nombre, descripcion, imagen_url, categoria, tipo_plato, estado, fuente_tipo, url_origen,
      kcal, proteinas, carbohidratos, grasas, premium_chef, objetivos, deportes, momentos, estilos,
      imagen_origen, imagen_estado, imagen_quality_score, imagen_realismo_score, imagen_match_receta_score,
      imagen_needs_review, imagen_review_notes, imagen_reviewed_at, imagen_estilo_preset, created_at, coach_id
    `)
    .or(`coach_id.eq.${user.id},coach_id.is.null`)
    .order('imagen_needs_review', { ascending: false })
    .order('imagen_quality_score', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    query = query.ilike('nombre', `%${q}%`)
  }

  if (filtro === 'pendientes') query = query.eq('imagen_needs_review', true)
  if (filtro === 'sin_imagen') query = query.or('imagen_url.is.null,imagen_url.eq.')
  if (filtro === 'sospechosas') query = query.or('imagen_quality_score.lt.55,imagen_realismo_score.lt.55,imagen_match_receta_score.lt.55,imagen_estado.eq.revisar')
  if (filtro === 'ai') query = query.eq('imagen_origen', 'ai')
  if (filtro === 'scraped') query = query.eq('imagen_origen', 'scraped')
  if (filtro === 'aprobadas') query = query.eq('imagen_estado', 'aprobada')
  if (filtro === 'rechazadas') query = query.eq('imagen_estado', 'rechazada')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const recetas = data ?? []
  const stats = {
    total: recetas.length,
    pendientes: recetas.filter(r => r.imagen_needs_review).length,
    sin_imagen: recetas.filter(r => !r.imagen_url).length,
    ai: recetas.filter(r => r.imagen_origen === 'ai').length,
    scraped: recetas.filter(r => r.imagen_origen === 'scraped').length,
    aprobadas: recetas.filter(r => r.imagen_estado === 'aprobada').length,
    sospechosas: recetas.filter(r =>
      Number(r.imagen_quality_score ?? 100) < 55 ||
      Number(r.imagen_realismo_score ?? 100) < 55 ||
      Number(r.imagen_match_receta_score ?? 100) < 55 ||
      r.imagen_estado === 'revisar'
    ).length,
  }

  return NextResponse.json({ recetas, stats, filtro })
}
