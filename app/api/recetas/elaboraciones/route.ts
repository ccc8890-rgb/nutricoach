import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { aplicarBusquedaNombre } from '@/lib/recetas/busqueda'
import { cargarElaboraciones } from '@/lib/recetas/elaboraciones-db'
import { aplanarLineas, macrosPor100g, pesoFinal } from '@/lib/recetas/elaboraciones'

// Elaboraciones aprobadas para enlazarlas como ingrediente desde el editor de recetas. Solo coach.
export async function GET(request: NextRequest) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const q = new URL(request.url).searchParams.get('q')

  let consulta = auth.admin.from('recetas').select('id, nombre, categoria, peso_final_g')
    .eq('tipo_receta', 'salsa_base').eq('estado', 'aprobada').order('nombre').limit(20)
  consulta = aplicarBusquedaNombre(consulta, q)
  const { data, error } = await consulta
  if (error) return NextResponse.json({ error: 'No se pudo buscar' }, { status: 500 })

  const mapa = await cargarElaboraciones(auth.admin, (data ?? []).map(r => r.id))
  const elaboraciones = (data ?? []).map(r => {
    const e = mapa.get(r.id)
    let kcal100 = 0
    try { if (e) kcal100 = Math.round(macrosPor100g(aplanarLineas(e.lineas, mapa, { raiz: r.id }).lineas, pesoFinal(e)).kcal * 10) / 10 } catch { /* ciclo: sin kcal */ }
    return { id: r.id, nombre: r.nombre, categoria: r.categoria, peso_final_g: r.peso_final_g, kcal100 }
  })
  return NextResponse.json({ elaboraciones })
}
