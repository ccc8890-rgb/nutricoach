/**
 * POST /api/subir-imagen-receta
 *
 * Sube una imagen aprobada desde el panel de revisión a Supabase Storage
 * y actualiza la receta en BD.
 *
 * Body:
 *   receta_id: string  (UUID de la receta)
 *   buffer: number[]   (array de bytes de la imagen)
 *   fileName: string   (nombre del archivo en Storage)
 *   metodo: string     (origen: playwright, google_images, flux_txt2img, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
    try {
        const supabaseAuth = createApiSupabase(request)
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { receta_id, buffer, fileName, metodo } = await request.json()

        if (!receta_id || !buffer || !fileName) {
            return NextResponse.json(
                { error: 'Faltan campos: receta_id, buffer, fileName' },
                { status: 400 }
            )
        }

        const supabase = createServiceSupabase()

        // Convertir array de bytes a Buffer
        const imageBuffer = Buffer.from(buffer)

        // Subir a Storage
        let result = await supabase.storage
            .from('recetas')
            .upload(fileName, imageBuffer, {
                contentType: 'image/webp',
                upsert: true,
            })

        // Crear bucket si no existe
        if (result.error?.message?.includes('not found')) {
            await supabase.storage.createBucket('recetas', { public: true })
            result = await supabase.storage
                .from('recetas')
                .upload(fileName, imageBuffer, {
                    contentType: 'image/webp',
                    upsert: true,
                })
        }

        if (result.error) {
            return NextResponse.json(
                { error: result.error.message },
                { status: 500 }
            )
        }

        // Obtener URL pública
        const { data: pub } = supabase.storage
            .from('recetas')
            .getPublicUrl(fileName)

        // Actualizar la receta en BD
        const { error: updateError } = await supabase
            .from('recetas')
            .update({
                imagen_url: pub.publicUrl,
                updated_at: new Date().toISOString(),
            } as any)
            .eq('id', receta_id)

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            imagen_url: pub.publicUrl,
            metodo,
        })
    } catch (err) {
        return NextResponse.json(
            { error: (err as Error).message },
            { status: 500 }
        )
    }
}
