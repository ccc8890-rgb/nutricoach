import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { SUPERMERCADO_REFERENCIA, estimarPrecioReferenciaKg } from '@/lib/precios-referencia'

const PAGE_SIZE = 1000

type QueryLike<T> = {
  range(from: number, to: number): Promise<{ data: T[] | null; error: { message: string } | null }>
  not(column: string, operator: string, value: unknown): QueryLike<T>
  gt(column: string, value: unknown): QueryLike<T>
  eq(column: string, value: unknown): QueryLike<T>
}

type AlimentoRow = { id: string; nombre: string; categoria: string | null }
type RecetaRow = { id: string; nombre: string }
type PrecioRow = { alimento_id: string | null; supermercado_nombre?: string | null }
type IngredienteRow = {
  id: string
  receta_id: string
  alimento_id: string | null
  cantidad_gramos: number | null
  nombre_libre: string | null
  alimentos: AlimentoRow | AlimentoRow[] | null
  recetas: RecetaRow | RecetaRow[] | null
}
type ReferenciaRow = { id: string }

async function selectAll<T>(srv: ReturnType<typeof createServiceSupabase>, table: string, columns: string, filters: (q: QueryLike<T>) => QueryLike<T> = q => q) {
  const rows: T[] = []
  let from = 0
  while (true) {
    const query = srv.from(table).select(columns) as unknown as QueryLike<T>
    const { data, error } = await filters(query).range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

export async function GET(request: NextRequest) {
  try {
    const auth = createApiSupabase(request)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const srv = createServiceSupabase()
    const [precios, ingredientes, referencias] = await Promise.all([
      selectAll<PrecioRow>(srv, 'mejores_precios_por_alimento', 'alimento_id, supermercado_nombre'),
      selectAll<IngredienteRow>(
        srv,
        'receta_ingredientes',
        'id, receta_id, alimento_id, cantidad_gramos, nombre_libre, alimentos(id,nombre,categoria), recetas(id,nombre)',
        q => q.not('alimento_id', 'is', null).gt('cantidad_gramos', 0),
      ),
      selectAll<ReferenciaRow>(
        srv,
        'productos_supermercado',
        'id',
        q => q.eq('supermercado_id', SUPERMERCADO_REFERENCIA.id).gt('precio_por_kg', 0),
      ),
    ])

    const conPrecio = new Set(precios.map(p => p.alimento_id).filter(Boolean))
    const totalIngredientes = ingredientes.length
    const usosConPrecio = ingredientes.filter(i => conPrecio.has(i.alimento_id)).length
    const usosSinPrecio = totalIngredientes - usosConPrecio

    const porReceta = new Map<string, { id: string; nombre: string; total: number; conPrecio: number }>()
    const sinPrecio = new Map<string, {
      alimento_id: string
      alimento_nombre: string
      categoria: string | null
      usos: number
      gramos: number
      precio_sugerido_kg: number
      metodo: string
    }>()

    for (const ing of ingredientes) {
      const receta = Array.isArray(ing.recetas) ? ing.recetas[0] : ing.recetas
      const rid = ing.receta_id
      const rec = porReceta.get(rid) || {
        id: rid,
        nombre: receta?.nombre || 'Receta',
        total: 0,
        conPrecio: 0,
      }
      rec.total += 1
      if (conPrecio.has(ing.alimento_id)) rec.conPrecio += 1
      porReceta.set(rid, rec)

      if (!conPrecio.has(ing.alimento_id)) {
        const alimento = Array.isArray(ing.alimentos) ? ing.alimentos[0] : ing.alimentos
        if (!alimento?.id) continue
        const estimado = estimarPrecioReferenciaKg(alimento)
        const item = sinPrecio.get(alimento.id) || {
          alimento_id: alimento.id,
          alimento_nombre: alimento.nombre,
          categoria: alimento.categoria,
          usos: 0,
          gramos: 0,
          precio_sugerido_kg: estimado.precio,
          metodo: estimado.metodo,
        }
        item.usos += 1
        item.gramos += Number(ing.cantidad_gramos || 0)
        sinPrecio.set(alimento.id, item)
      }
    }

    const recetasBajaCobertura = Array.from(porReceta.values())
      .map(r => ({
        ...r,
        sinPrecio: r.total - r.conPrecio,
        cobertura_pct: r.total > 0 ? Math.round((r.conPrecio / r.total) * 100) : 100,
      }))
      .filter(r => r.cobertura_pct < 80)
      .sort((a, b) => a.cobertura_pct - b.cobertura_pct || b.sinPrecio - a.sinPrecio)
      .slice(0, 20)

    const topIngredientesSinPrecio = Array.from(sinPrecio.values())
      .sort((a, b) => b.usos - a.usos || b.gramos - a.gramos)
      .slice(0, 20)

    return NextResponse.json({
      total_ingredientes: totalIngredientes,
      ingredientes_con_precio: usosConPrecio,
      ingredientes_sin_precio: usosSinPrecio,
      cobertura_pct: totalIngredientes > 0 ? Math.round((usosConPrecio / totalIngredientes) * 100) : 100,
      recetas_baja_cobertura: recetasBajaCobertura,
      top_ingredientes_sin_precio: topIngredientesSinPrecio,
      precios_referencia: referencias.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[API precios/cobertura]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
