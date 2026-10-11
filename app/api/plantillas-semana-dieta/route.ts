import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Comida = { franja: string; receta_id: string; nombre: string }
type Semana = { dias: { dia: string; comidas: Comida[] }[] }

// Valida y limpia lo que llega del navegador: solo días, franjas, ids de receta y nombres
function limpiarSemanas(v: unknown): Semana[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > 8) return null
  const out: Semana[] = []
  for (const s of v) {
    const dias = (s as Semana)?.dias
    if (!Array.isArray(dias) || dias.length > 7) return null
    const limpios = []
    for (const d of dias) {
      if (!DIAS.includes(d?.dia) || !Array.isArray(d.comidas) || d.comidas.length > 12) return null
      const comidas: Comida[] = []
      for (const c of d.comidas) {
        if (typeof c?.franja !== 'string' || c.franja.length > 40 || typeof c.receta_id !== 'string' || !UUID.test(c.receta_id)) return null
        comidas.push({ franja: c.franja, receta_id: c.receta_id, nombre: String(c.nombre ?? '').slice(0, 160) })
      }
      limpios.push({ dia: d.dia as string, comidas })
    }
    out.push({ dias: limpios })
  }
  return out.some(s => s.dias.some(d => d.comidas.length > 0)) ? out : null
}

export async function GET(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const { data, error } = await r.admin.from('plantillas_semana_dieta')
    .select('id, nombre, descripcion, etiquetas, semanas, created_at').eq('coach_id', r.userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las plantillas' }, { status: 500 })
  return NextResponse.json({ plantillas: data ?? [] })
}

export async function POST(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const b = await request.json().catch(() => null) as { nombre?: string; descripcion?: string; etiquetas?: string[]; semanas?: unknown } | null
  const nombre = (b?.nombre ?? '').trim().slice(0, 100)
  const semanas = limpiarSemanas(b?.semanas)
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
  if (!semanas) return NextResponse.json({ error: 'No hay platos que guardar' }, { status: 400 })
  const etiquetas = (Array.isArray(b?.etiquetas) ? b!.etiquetas : []).map(e => String(e).trim().slice(0, 30)).filter(Boolean).slice(0, 8)
  const { data, error } = await r.admin.from('plantillas_semana_dieta')
    .insert({ coach_id: r.userId, nombre, descripcion: (b?.descripcion ?? '').trim().slice(0, 500) || null, etiquetas, semanas })
    .select('id').single()
  if (error) return NextResponse.json({ error: 'No se pudo guardar la plantilla' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const { error } = await r.admin.from('plantillas_semana_dieta').delete().eq('id', id).eq('coach_id', r.userId)
  if (error) return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
