// app/api/cliente/[codigo]/mis-platos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const supabase = createServiceSupabase()

  // Bug real (revisión 27-09-2026): `clientes` no tiene columna
  // `codigo_publico` — ese código vive en `planes_nutricion.codigo_publico`.
  // Esta consulta nunca encontraba al cliente y devolvía 404 siempre, para
  // cualquier código real.
  const { data: plan } = await supabase
    .from('planes_nutricion')
    .select('cliente_id')
    .eq('codigo_publico', codigo)
    .single()

  if (!plan) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, url_origen, kcal, proteinas, created_at')
    .eq('cliente_id', plan.cliente_id)
    .eq('fuente', 'ia_personalizada')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ recetas: recetas ?? [] })
}
