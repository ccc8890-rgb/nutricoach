import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { asignarFutura } from '@/lib/nutricion/semanas-futuras'
import { hoyMadrid, repartirEnDieta, semanaYDia } from '@/lib/contenido/fechas'
import { ordenarCocinado } from '@/lib/contenido/tanda'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Reparte las recetas de la tanda (o solo las de `pieza_ids`) en Comida y Cena desde la fecha de grabación, en las semanas planificadas (+1…+8) del plan.
export async function POST(request: NextRequest) {
  const c = await autorizarCoach(request)
  if ('error' in c) return c.error
  const b = await request.json().catch(() => null) as { fecha?: unknown; cliente_id?: unknown; pieza_ids?: unknown } | null
  if (typeof b?.fecha !== 'string' || !FECHA.test(b.fecha)) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
  if (typeof b.cliente_id !== 'string' || !UUID.test(b.cliente_id)) return NextResponse.json({ error: 'Cliente no válido' }, { status: 400 })
  const soloIds = b.pieza_ids === undefined ? null : Array.isArray(b.pieza_ids) && b.pieza_ids.every(x => typeof x === 'string' && UUID.test(x)) ? b.pieza_ids as string[] : undefined
  if (soloIds === undefined) return NextResponse.json({ error: 'Piezas no válidas' }, { status: 400 })
  const a = await autorizarSemanaDieta(request, b.cliente_id)
  if ('error' in a) return a.error
  if (!a.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })

  const { data, error } = await a.admin.from('piezas_contenido')
    .select('id, titulo, receta_id, receta:recetas(tiempo_prep_min)')
    .eq('coach_id', c.userId).eq('fecha_grabacion', b.fecha).in('estado', ['para_grabar', 'grabada']).not('receta_id', 'is', null)
  if (error) return NextResponse.json({ error: 'No se pudo cargar la tanda' }, { status: 500 })

  type Fila = { id: string; titulo: string; receta_id: string; receta: { tiempo_prep_min: number | null } | null }
  const piezas = ordenarCocinado(((data ?? []) as unknown as Fila[]).filter(p => !soloIds || soloIds.includes(p.id)).map(p => ({ ...p, nombre: p.titulo, tiempo_prep_min: p.receta?.tiempo_prep_min ?? null })))
  const destinos = repartirEnDieta(piezas.length, b.fecha)
  const hoy = hoyMadrid()

  let colocadas = 0
  const omitidas: { titulo: string; motivo: string }[] = []
  for (const [i, p] of piezas.entries()) {
    const sd = semanaYDia(destinos[i].fecha, hoy)
    if (!sd) { omitidas.push({ titulo: p.titulo, motivo: 'Cae fuera de las semanas planificables (la semana en curso no se toca; solo +1 a +8)' }); continue }
    try {
      await asignarFutura(a.admin, a.plan.id, { semana: sd.semana, dia: sd.dia, franja: destinos[i].franja, receta_id: p.receta_id })
      await a.admin.from('piezas_contenido').update({ plan_id: a.plan.id, updated_at: new Date().toISOString() }).eq('id', p.id).eq('coach_id', c.userId)
      colocadas++
    } catch {
      omitidas.push({ titulo: p.titulo, motivo: 'La receta no está aprobada o no se pudo guardar' })
    }
  }
  return NextResponse.json({ colocadas, omitidas })
}
