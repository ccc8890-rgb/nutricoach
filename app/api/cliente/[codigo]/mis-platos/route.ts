// app/api/cliente/[codigo]/mis-platos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const supabase = createServiceSupabase()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('codigo_publico', codigo)
    .single()

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, url_origen, kcal, proteinas, created_at')
    .eq('cliente_id', cliente.id)
    .eq('fuente', 'ia_personalizada')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ recetas: recetas ?? [] })
}
