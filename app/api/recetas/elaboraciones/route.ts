import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { aplicarBusquedaNombre } from '@/lib/recetas/busqueda'
import { cargarElaboraciones } from '@/lib/recetas/elaboraciones-db'
import { aplanarLineas, macrosPor100g, pesoFinal } from '@/lib/recetas/elaboraciones'

// Elaboraciones aprobadas para enlazarlas como ingrediente desde el editor de recetas. Solo coach.
export async function GET(request: NextRequest) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const params = new URL(request.url).searchParams
  const q = params.get('q')
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const ids = (params.get('ids') ?? '').split(',').filter(x => UUID.test(x)).slice(0, 50)

  // Con `ids` se devuelven esas elaboraciones (las líneas ya enlazadas); si no, búsqueda por nombre solo entre las aprobadas
  let consulta = auth.admin.from('recetas').select('id, nombre, categoria, peso_final_g').eq('tipo_receta', 'salsa_base').order('nombre').limit(20)
  consulta = ids.length > 0 ? consulta.in('id', ids) : aplicarBusquedaNombre(consulta.eq('estado', 'aprobada'), q)
  const { data, error } = await consulta
  if (error) return NextResponse.json({ error: 'No se pudo buscar' }, { status: 500 })

  const mapa = await cargarElaboraciones(auth.admin, (data ?? []).map(r => r.id))
  const elaboraciones = (data ?? []).map(r => {
    const e = mapa.get(r.id)
    let macros100 = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
    try { if (e) macros100 = macrosPor100g(aplanarLineas(e.lineas, mapa, { raiz: r.id }).lineas, pesoFinal(e)) } catch { /* ciclo: sin macros */ }
    return { id: r.id, nombre: r.nombre, categoria: r.categoria, peso_final_g: r.peso_final_g, kcal100: Math.round(macros100.kcal * 10) / 10, macros100 }
  })
  return NextResponse.json({ elaboraciones })
}
