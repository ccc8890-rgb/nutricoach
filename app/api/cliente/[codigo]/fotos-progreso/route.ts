import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    const { codigo } = await params
    const db = createServiceSupabase()

    // Buscar el cliente por código de su plan activo
    const { data: plan } = await db
        .from('planes_nutricion')
        .select('cliente_id')
        .eq('codigo_publico', codigo)
        .eq('activo', true)
        .single()

    if (!plan) return NextResponse.json({ fotos: [] })

    // Buscar checkins con foto_url
    const { data: checkins } = await db
        .from('checkins')
        .select('id, fecha, peso, foto_url')
        .eq('cliente_id', plan.cliente_id)
        .not('foto_url', 'is', null)
        .order('fecha', { ascending: true })

    if (!checkins?.length) return NextResponse.json({ fotos: [] })

    // Generar signed URLs para cada foto
    const fotos = await Promise.all(
        checkins.map(async (c) => {
            let path = c.foto_url as string
            const marker = '/fotos-progreso/'
            if (path.includes(marker)) {
                path = path.substring(path.indexOf(marker) + marker.length)
            }

            const { data } = await db.storage
                .from('fotos-progreso')
                .createSignedUrl(path, 3600)

            return {
                id: c.id,
                fecha: c.fecha,
                peso: c.peso ?? null,
                signedUrl: data?.signedUrl ?? null,
            }
        })
    )

    // Filtrar las que no se pudo generar signed URL
    return NextResponse.json({ fotos: fotos.filter(f => f.signedUrl !== null) })
}
