import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { limpiarFotoPlato } from '@/lib/platos/foto-limpia'
import { cargarPlatoDeCliente } from '@/lib/platos/guardar'

export const maxDuration = 120

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Retoque opcional de la foto con IA. Va aparte de la creación del plato (tarda y puede no estar disponible):
 * el cliente lo pide cuando el plato ya existe. Devuelve `foto_limpia_url: null` si no se pudo; la original no se toca.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string; id: string }> }) {
  const { codigo, id } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  if (!auth.esCliente) return NextResponse.json({ error: 'Solo el propio cliente puede retocar sus fotos' }, { status: 403 })
  const db = createServiceSupabase()
  const plato = UUID.test(id) ? await cargarPlatoDeCliente(db, auth.clienteId, id) : null
  if (!plato || !plato.foto_original_url) return NextResponse.json({ error: 'Plato no encontrado' }, { status: 404 })
  if (plato.foto_limpia_url) return NextResponse.json({ foto_limpia_url: plato.foto_limpia_url })

  try {
    const reducida = plato.foto_original_url.replace('/upload/', '/upload/c_limit,w_1280,f_jpg,q_85/')
    const original = await fetch(reducida, { signal: AbortSignal.timeout(15_000) })
    if (!original.ok) return NextResponse.json({ foto_limpia_url: null })
    const limpia = await limpiarFotoPlato({ buffer: Buffer.from(await original.arrayBuffer()), mediaType: 'image/jpeg' })
    if (!limpia) return NextResponse.json({ foto_limpia_url: null })
    const url = await uploadToCloudinary(limpia, { folder: `nutricoach/platos/${auth.clienteId}`, public_id: `${Date.now()}-limpia`, format: 'webp' })
    await db.from('platos_cliente').update({ foto_limpia_url: url }).eq('id', id).eq('cliente_id', auth.clienteId)
    return NextResponse.json({ foto_limpia_url: url })
  } catch {
    return NextResponse.json({ foto_limpia_url: null })
  }
}
