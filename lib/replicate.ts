/**
 * replicate.ts — Cliente para Replicate API (Flux Pro)
 * Genera imágenes fotorrealistas de recetas.
 *
 * CONFIGURACIÓN:
 *   Añadir REPLICATE_API_KEY a .env.local
 *   Obtén tu API key en: https://replicate.com/account/api-tokens
 *
 * MODELO: black-forest-labs/flux-pro (mejor calidad/precio para food photography)
 *
 * USO:
 *   import { generarImagenReceta } from '@/lib/replicate'
 *   const url = await generarImagenReceta('Fotografía realista de...')
 *
 * PRECIOS:
 *   Flux Pro: ~$0.05 por imagen (1024x1024)
 *   Flux Dev: ~$0.003 por imagen (más barato, menos realista)
 */

const REPLICATE_API_URL = 'https://api.replicate.com/v1'
const FLUX_PRO_MODEL = 'black-forest-labs/flux-pro'
const FLUX_DEV_MODEL = 'black-forest-labs/flux-dev' // Más barato

interface ReplicatePrediction {
    id: string
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
    output: string | string[] | null
    error: string | null
    urls: { get: string; cancel: string }
}

/**
 * Genera una imagen usando Flux Pro (o Dev como fallback).
 * @param prompt Descripción detallada de la imagen
 * @param useDev Si true, usa Flux Dev (más barato, ~$0.003)
 * @returns URL de la imagen generada (almacenada temporalmente en Replicate)
 */
export async function generarImagenFlux(
    prompt: string,
    useDev: boolean = false
): Promise<string | null> {
    const apiKey = process.env.REPLICATE_API_KEY
    if (!apiKey) {
        console.warn('  ⚠️ REPLICATE_API_KEY no configurada. Saltando generación de imagen.')
        return null
    }

    const model = useDev ? FLUX_DEV_MODEL : FLUX_PRO_MODEL
    const modelVersion = useDev ? undefined : undefined // Replicate usa la latest automáticamente

    try {
        console.log(`  🎨 Generando imagen con ${model}...`)

        // 1. Crear predicción
        const createRes = await fetch(`${REPLICATE_API_URL}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                version: model,
                input: {
                    prompt: prompt,
                    aspect_ratio: '1:1', // Cuadrado para Instagram
                    output_format: 'webp', // Ligero para web
                    safety_tolerance: 2, // Relajado para food
                    num_outputs: 1,
                },
            }),
        })

        if (!createRes.ok) {
            const errBody = await createRes.text()
            throw new Error(`Replicate create error ${createRes.status}: ${errBody}`)
        }

        const prediction: ReplicatePrediction = await createRes.json()
        console.log(`  ⏳ Predicción ${prediction.id} creada, esperando...`)

        // 2. Poll hasta que termine (timeout 60s)
        const startTime = Date.now()
        const timeout = 60_000
        let currentUrl = prediction.urls.get

        while (Date.now() - startTime < timeout) {
            await new Promise(r => setTimeout(r, 2000))

            const pollRes = await fetch(currentUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            })
            if (!pollRes.ok) throw new Error(`Poll error ${pollRes.status}`)

            const status: ReplicatePrediction = await pollRes.json()

            if (status.status === 'succeeded') {
                const output = status.output
                if (Array.isArray(output) && output.length > 0) {
                    console.log(`  ✅ Imagen generada: ${output[0].substring(0, 60)}`)
                    return output[0]
                } else if (typeof output === 'string') {
                    return output
                }
                return null
            }

            if (status.status === 'failed') {
                throw new Error(`Replicate failed: ${status.error}`)
            }

            // Seguir esperando
            currentUrl = status.urls.get
        }

        throw new Error('Timeout esperando a Replicate (60s)')
    } catch (err) {
        console.error(`  ❌ Error generando imagen:`, (err as Error).message)
        // Fallback: intentar con Flux Dev si falló Flux Pro
        if (!useDev) {
            console.log('  ↪ Intentando con Flux Dev (más barato)...')
            return generarImagenFlux(prompt, true)
        }
        return null
    }
}

/**
 * Descarga una imagen desde una URL y la sube a Supabase Storage.
 * @param imageUrl URL de la imagen (de Replicate, Instagram, etc.)
 * @param bucket Nombre del bucket en Supabase Storage
 * @param fileName Nombre del archivo en storage
 * @returns URL pública en Supabase Storage
 */
export async function subirImagenAStorage(
    imageUrl: string,
    bucket: string = 'recetas',
    fileName: string
): Promise<string | null> {
    if (!imageUrl) return null

    try {
        // Descargar la imagen
        const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) throw new Error(`Download error ${res.status}`)

        const buffer = Buffer.from(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || 'image/webp'

        // Import dinámico de Supabase
        const { createClient } = await import('@supabase/supabase-js')

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Subir a Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, {
                contentType,
                upsert: true,
            })

        if (error) {
            // Si el bucket no existe, crearlo
            if (error.message.includes('bucket')) {
                await supabase.storage.createBucket(bucket, { public: true })
                const retry = await supabase.storage.from(bucket).upload(fileName, buffer, {
                    contentType,
                    upsert: true,
                })
                if (retry.error) throw retry.error
                const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fileName)
                return pub.publicUrl
            }
            throw error
        }

        const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(fileName)
        return publicUrl.publicUrl
    } catch (err) {
        console.error(`  ❌ Error subiendo imagen a Storage:`, (err as Error).message)
        // Fallback: devolver la URL original si no se puede subir
        return imageUrl
    }
}
