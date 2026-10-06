import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { auditarRecetaProfesional } from '@/lib/recetas/auditoria'
import { inicioFinDiaMadridUtc, normalizarTareaRevision, type TareaRevision } from '@/lib/recetas/revision'

export const dynamic = 'force-dynamic'

async function requireUser(request: NextRequest) {
  const auth = createApiSupabase(request)
  const { data: { user } } = await auth.auth.getUser()
  return user
}

function filtrosTexto(searchParams: URLSearchParams) {
  return {
    q: searchParams.get('q')?.trim() ?? '',
    nivel: searchParams.get('nivel')?.trim() ?? '',
    uso: searchParams.get('uso')?.trim() ?? '',
    apta: searchParams.get('apta')?.trim() ?? '',
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '50'), 1), 100)
    const tarea = normalizarTareaRevision(searchParams.get('tarea'))
    const filtros = filtrosTexto(searchParams)
    const offset = (page - 1) * pageSize
    const { inicio, fin } = inicioFinDiaMadridUtc()
    const supabase = createServiceSupabase()

    const aplicarTarea = <T extends {
      in: (column: string, values: string[]) => T
      gte: (column: string, value: string) => T
      lt: (column: string, value: string) => T
      not: (column: string, operator: string, value: string) => T
      or: (filters: string) => T
    }>(query: T, value: TareaRevision): T => {
      if (value === 'pendientes') return query.in('estado', ['en_revision', 'borrador'])
      if (value === 'nuevas_hoy') return query.gte('created_at', inicio).lt('created_at', fin)
      if (value === 'bloqueos') return query.in('estado', ['en_revision', 'borrador']).not('quality_issues->bloqueantes', 'eq', '[]')
      if (value === 'sin_foto') return query.or('imagen_url.is.null,imagen_url.eq.')
      return query
    }

    const aplicarAvanzados = <T extends {
      ilike: (column: string, value: string) => T
      eq: (column: string, value: string) => T
    }>(query: T): T => {
      let result = query
      if (filtros.q) result = result.ilike('nombre', `%${filtros.q}%`)
      if (filtros.nivel) result = result.eq('nivel_fit', filtros.nivel)
      if (filtros.uso) result = result.eq('tipo_uso', filtros.uso)
      if (filtros.apta) result = result.eq('apta_cliente', filtros.apta)
      return result
    }

    let query = supabase.from('recetas').select(`
      id, nombre, categoria, tipo_plato, porciones,
      kcal, proteinas, carbohidratos, grasas,
      imagen_url, estado, score_calidad, nivel_fit, tipo_uso, apta_cliente,
      quality_estado_sugerido, quality_issues, quality_actualizado_at, created_at
    `, { count: 'exact' })
    query = aplicarAvanzados(aplicarTarea(query, tarea))
    const { data: recetas, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const contar = async (value: TareaRevision) => {
      let countQuery = supabase.from('recetas').select('id', { count: 'exact', head: true })
      countQuery = aplicarAvanzados(aplicarTarea(countQuery, value))
      const { count: total, error: countError } = await countQuery
      if (countError) throw countError
      return total ?? 0
    }

    const [pendientes, nuevasHoy, bloqueos, sinFoto, todas] = await Promise.all([
      contar('pendientes'), contar('nuevas_hoy'), contar('bloqueos'), contar('sin_foto'), contar('todas'),
    ])

    let aprobablesQuery = supabase
      .from('recetas')
      .select('id')
      .in('estado', ['en_revision', 'borrador'])
      .or('quality_issues->bloqueantes.eq.[],quality_issues.is.null')
    aprobablesQuery = aplicarAvanzados(aplicarTarea(aprobablesQuery, tarea))
    const { data: aprobables, error: aprobablesError } = await aprobablesQuery.order('created_at', { ascending: false }).limit(250)
    if (aprobablesError) return NextResponse.json({ error: aprobablesError.message }, { status: 500 })

    const recetaIds = (recetas ?? []).map(r => r.id)
    let ingredientesCount: Record<string, number> = {}
    if (recetaIds.length > 0) {
      const { data: ingredientes } = await supabase.from('receta_ingredientes').select('receta_id, id').in('receta_id', recetaIds)
      ingredientesCount = (ingredientes ?? []).reduce<Record<string, number>>((acc, item) => {
        acc[item.receta_id] = (acc[item.receta_id] ?? 0) + 1
        return acc
      }, {})
    }

    return NextResponse.json({
      data: (recetas ?? []).map(r => ({ ...r, num_ingredientes: ingredientesCount[r.id] ?? 0 })),
      total: count ?? 0,
      page,
      pageSize,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
      counts: { pendientes, nuevas_hoy: nuevasHoy, bloqueos, sin_foto: sinFoto, todas },
      aprobablesIds: (aprobables ?? []).map(r => r.id),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : []
    if (ids.length === 0) return NextResponse.json({ error: 'No hay recetas para aprobar' }, { status: 400 })
    if (ids.length > 250) return NextResponse.json({ error: 'Máximo 250 recetas por lote' }, { status: 400 })

    const supabase = createServiceSupabase()
    const { data: recetas, error } = await supabase.from('recetas').select('id, nombre, estado').in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bloqueadas: Array<{ id: string; nombre: string; motivos: string[] }> = []
    const aprobables: string[] = []
    for (const receta of recetas ?? []) {
      const audit = await auditarRecetaProfesional(supabase, receta.id, 'revision_lote_quality', 'api_recetas_revisar')
      const motivos = [...audit.score.bloqueantes]
      if (motivos.length > 0) bloqueadas.push({ id: receta.id, nombre: receta.nombre, motivos })
      else aprobables.push(receta.id)
    }

    if (aprobables.length > 0) {
      const { error: updateError } = await supabase.from('recetas').update({ estado: 'aprobada' }).in('id', aprobables)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      await Promise.all(aprobables.map(id => auditarRecetaProfesional(supabase, id, 'aprobada_lote', 'api_recetas_revisar')))
    }

    return NextResponse.json({ ok: bloqueadas.length === 0, aprobadas: aprobables.length, bloqueadas })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
