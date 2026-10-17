import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachRecetas } from '@/lib/recetas/autorizar-coach'
import { limpiarCamposEditables } from '@/lib/recetas/campos-editables'
import { TAG_CORREGIR } from '@/lib/recetas/correcciones'
import { TAG_REPORTE_CLIENTE } from '@/lib/recetas/reportes'

export const dynamic = 'force-dynamic'

/** Edición rápida de campos sin efecto en macros (nombre, descripción, tiempo, categoría, etiquetas). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarCoachRecetas(req)
  if ('error' in a) return a.error
  const v = limpiarCamposEditables(await req.json().catch(() => ({})))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { data: receta } = await a.srv.from('recetas').select('id, tags').eq('id', id).eq('coach_id', a.coachId).maybeSingle()
  if (!receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
  const cambios: Record<string, unknown> = { ...v.cambios }
  if (v.cambios.tags) {
    // Las marcas de reporte las gestiona el flujo de revisión, no la edición de etiquetas
    const reservadas = ((receta.tags ?? []) as string[]).filter(t => t === TAG_CORREGIR || t === TAG_REPORTE_CLIENTE)
    cambios.tags = [...new Set([...v.cambios.tags.filter(t => t !== TAG_CORREGIR && t !== TAG_REPORTE_CLIENTE), ...reservadas])]
  }
  const { error } = await a.srv.from('recetas').update(cambios).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
