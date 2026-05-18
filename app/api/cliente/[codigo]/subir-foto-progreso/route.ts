import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    const { codigo } = await params

    const db = createServiceSupabase()

    // Verificar que el código es válido
    const { data: plan } = await db
        .from('planes_nutricion')
        .select('cliente_id')
        .eq('codigo_publico', codigo)
        .eq('activo', true)
        .single()

    if (!plan?.cliente_id) {
        return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
        return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    if (!['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
        return NextResponse.json({ error: 'Formato no permitido' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'El archivo supera los 10 MB' }, { status: 400 })
    }

    const fileName = `${plan.cliente_id}/${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let result = await db.storage
        .from('fotos-progreso')
        .upload(fileName, buffer, { contentType: file.type, upsert: false })

    if (result.error?.message?.includes('not found')) {
        await db.storage.createBucket('fotos-progreso', { public: false })
        result = await db.storage
            .from('fotos-progreso')
            .upload(fileName, buffer, { contentType: file.type, upsert: false })
    }

    if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    // URL firmada válida 1 año (solo el coach puede acceder via API)
    const { data: signed } = await db.storage
        .from('fotos-progreso')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365)

    return NextResponse.json({ url: signed?.signedUrl ?? null, path: fileName })
}
