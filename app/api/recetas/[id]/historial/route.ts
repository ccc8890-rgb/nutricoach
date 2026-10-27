import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Línea de tiempo de una ficha en el circuito de revisión (acciones de Carlos y veredictos del agente). Solo coach.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  const { data, error } = await auth.admin.from('recetas_revision_eventos')
    .select('tipo, actor, nota, veredicto, confianza, resumen, hallazgos, correcciones, aplicadas, modelo, created_at')
    .eq('receta_id', id).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'No se pudo leer el historial' }, { status: 500 })
  return NextResponse.json({ eventos: data ?? [] })
}
