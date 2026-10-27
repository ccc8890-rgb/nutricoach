import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { cargarMetodo } from '@/lib/metodos/db'
import { calentarVariantes, uploadToCloudinary } from '@/lib/cloudinary'

const MAX_BYTES = 5 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']

// Sube la miniatura de una ficha (multipart, campo «archivo») y la guarda en la ficha. Solo coach, y solo si la ficha es suya.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  const metodo = await cargarMetodo(auth.admin, id, auth.userId)
  if (!metodo) return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const archivo = form?.get('archivo')
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta el archivo de imagen' }, { status: 400 })
  if (!TIPOS.includes(archivo.type)) return NextResponse.json({ error: 'La imagen debe ser JPG, PNG o WebP' }, { status: 400 })
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: 'La imagen pesa más de 5 MB' }, { status: 400 })

  let url: string
  try {
    url = await uploadToCloudinary(Buffer.from(await archivo.arrayBuffer()), { folder: 'nutricoach/metodos', public_id: `${id}-${Date.now()}` })
  } catch {
    return NextResponse.json({ error: 'No se pudo subir la imagen' }, { status: 502 })
  }
  const { error } = await auth.admin.from('metodos').update({ miniatura_url: url, updated_at: new Date().toISOString() }).eq('id', id).eq('coach_id', auth.userId)
  if (error) return NextResponse.json({ error: 'No se pudo guardar la miniatura' }, { status: 500 })
  void calentarVariantes(url)
  return NextResponse.json({ miniatura_url: url })
}
