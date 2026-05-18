/**
 * generar-imagenes-flux-recetas.ts
 *
 * Genera imágenes fotorrealistas con Flux Pro para recetas existentes
 * que tienen imágenes de baja calidad (Instagram/TikTok).
 *
 * USO:
 *   cd nutricoach && npx tsx scripts/generar-imagenes-flux-recetas.ts
 *
 * CONFIG:
 *   --modo=pro     (Flux Pro ~$0.05/img, calidad máxima)  [default]
 *   --modo=dev     (Flux Dev ~$0.003/img, más barato)
 *   --limite=N     Procesar solo N recetas (para pruebas)
 *   --categoria=X  Filtrar por categoría (opcional)
 *
 * PRECIO ESTIMADO:
 *   Flux Pro: 107 recetas × $0.05 = ~$5.35
 *   Flux Dev: 107 recetas × $0.003 = ~$0.32
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// ─── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || ''
const REPLICATE_API_URL = 'https://api.replicate.com/v1'
const FLUX_PRO_MODEL = 'black-forest-labs/flux-pro'
const FLUX_DEV_MODEL = 'black-forest-labs/flux-dev'

const MODO = (process.argv.find(a => a.startsWith('--modo=')) || '--modo=pro').replace('--modo=', '') as 'pro' | 'dev'
const LIMITE = parseInt(process.argv.find(a => a.startsWith('--limite='))?.replace('--limite=', '') || '0', 10)
const CATEGORIA_FILTER = process.argv.find(a => a.startsWith('--categoria='))?.replace('--categoria=', '') || ''
const useDev = MODO === 'dev'
const MODEL = useDev ? FLUX_DEV_MODEL : FLUX_PRO_MODEL
const COST_PER_IMG = useDev ? 0.003 : 0.05

// ─── Helpers ───────────────────────────────────────────────────────────────

function log(msg: string) {
    const ts = new Date().toLocaleTimeString('es-ES')
    console.log(`[${ts}] ${msg}`)
}

async function generarImagenFlux(prompt: string): Promise<string | null> {
    try {
        log(`  🎨 Generando con ${MODEL}...`)

        const createRes = await fetch(`${REPLICATE_API_URL}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPLICATE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                version: MODEL,
                input: {
                    prompt,
                    aspect_ratio: '1:1',
                    output_format: 'webp',
                    safety_tolerance: 2,
                    num_outputs: 1,
                },
            }),
        })

        if (!createRes.ok) {
            const errBody = await createRes.text()
            throw new Error(`Replicate create error ${createRes.status}: ${errBody}`)
        }

        const prediction = await createRes.json()
        log(`  ⏳ Predicción ${prediction.id}, esperando...`)

        const startTime = Date.now()
        const timeout = 120_000
        let currentUrl = prediction.urls.get

        while (Date.now() - startTime < timeout) {
            await new Promise(r => setTimeout(r, 3000))

            const pollRes = await fetch(currentUrl, {
                headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
            })
            if (!pollRes.ok) throw new Error(`Poll error ${pollRes.status}`)

            const status = await pollRes.json()

            if (status.status === 'succeeded') {
                const output = status.output
                const url = Array.isArray(output) ? output[0] : (typeof output === 'string' ? output : null)
                if (url) log(`  ✅ Imagen generada`)
                return url
            }

            if (status.status === 'failed') {
                throw new Error(`Replicate failed: ${status.error}`)
            }
            currentUrl = status.urls.get
        }

        throw new Error('Timeout esperando a Replicate (120s)')
    } catch (err) {
        log(`  ❌ Error: ${(err as Error).message}`)
        return null
    }
}

async function descargarImagen(url: string): Promise<Buffer | null> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) throw new Error(`Download error ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        log(`  📥 Descargada: ${(buf.length / 1024).toFixed(0)} KB`)
        return buf
    } catch (err) {
        log(`  ❌ Error descargando: ${(err as Error).message}`)
        return null
    }
}

async function subirBufferAStorage(
    buffer: Buffer,
    fileName: string
): Promise<string | null> {
    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

        const { data, error } = await supabase.storage
            .from('recetas')
            .upload(fileName, buffer, {
                contentType: 'image/webp',
                upsert: true,
            })

        if (error) {
            if (error.message.includes('bucket')) {
                await supabase.storage.createBucket('recetas', { public: true })
                const retry = await supabase.storage.from('recetas').upload(fileName, buffer, {
                    contentType: 'image/webp',
                    upsert: true,
                })
                if (retry.error) throw retry.error
            } else {
                throw error
            }
        }

        const { data: publicUrl } = supabase.storage.from('recetas').getPublicUrl(fileName)
        log(`  ☁️ Subida a Storage: ${publicUrl.publicUrl.substring(0, 60)}...`)
        return publicUrl.publicUrl
    } catch (err) {
        log(`  ❌ Error subiendo a Storage: ${(err as Error).message}`)
        return null
    }
}

function construirPrompt(nombre: string, categoria: string, tags: string[]): string {
    const tagStr = tags.filter(Boolean).join(', ')
    const contextInfo = tagStr ? `Estilo: ${tagStr}.` : ''

    // Categoría → ángulo de foto
    const angleMap: Record<string, string> = {
        'Postre': 'plano cenital, vista superior de un plato con postre',
        'Dulce': 'plano cenital, vista superior de un plato con dulces',
        'Comida': 'ángulo 45 grados, plato principal en mesa de madera',
        'Cena': 'ángulo 45 grados, plato en mesa iluminada cálidamente',
        'Desayuno': 'plano cenital, vista superior de desayuno en mesa',
        'Ensaladas': 'plano cenital, vista superior de ensalada en bol',
        'Snack': 'plano cenital, vista superior de snack en tabla',
        'Salsas': 'primer plano, textura de salsa en cuenco pequeño',
        'Carnes': 'ángulo 45 grados, carne en plato con guarnición',
        'Pescados': 'ángulo 45 grados, pescado en plato con vegetales',
        'Entrante': 'plano cenital, vista superior de entrante en tabla',
        'Tostas': 'plano cenital, vista superior de tostadas en tabla',
        'Platos variados': 'ángulo 45 grados, plato variado en mesa',
        'Fajitas/Tacos': 'plano cenital, vista superior de tacos en tabla',
    }
    const angle = angleMap[categoria] || 'plano cenital, vista superior'

    return `Fotografía realista de comida casera, ${angle}. Plato: ${nombre}. Comida bien iluminada con luz natural de ventana, colores vibrantes y apetitosos. Fondo neutro desenfocado (bokeh). Estilo food photography profesional, alta definición, texturas visibles. ${contextInfo} Sin marcas de agua, sin texto, sin logotipos.`
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
    log(`⚡ INICIANDO generación de imágenes Flux (MODO: ${MODO}, modelo: ${MODEL})`)
    log(`   Coste estimado: ~$${COST_PER_IMG}/img`)

    // Validar credenciales
    if (!REPLICATE_API_KEY) {
        log('❌ REPLICATE_API_KEY no configurada en .env.local')
        return
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
        log('❌ SUPABASE_URL o SERVICE_KEY no configuradas')
        return
    }

    // 1. Obtener recetas de Instagram/TikTok
    log('📡 Obteniendo recetas de Instagram/TikTok...')

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    let query = supabase
        .from('recetas')
        .select('id, nombre, categoria, tags, imagen_url, url_origen')
        .or('url_origen.like.%instagram%,url_origen.like.%tiktok%')
        .order('nombre', { ascending: true })

    if (CATEGORIA_FILTER) {
        query = query.eq('categoria', CATEGORIA_FILTER)
    }

    if (LIMITE > 0) {
        query = query.limit(LIMITE)
    }

    const { data: recetas, error } = await query

    if (error) {
        log(`❌ Error obteniendo recetas: ${error.message}`)
        return
    }

    if (!recetas || recetas.length === 0) {
        log('❌ No se encontraron recetas de Instagram/TikTok')
        return
    }

    const total = recetas.length
    const costeTotal = (total * COST_PER_IMG).toFixed(2)
    log(`✅ ${total} recetas encontradas (coste ~$${costeTotal})`)
    log('')

    // 2. Confirmar
    log('📋 LISTA DE RECETAS A PROCESAR:')
    recetas.forEach((r, i) => {
        log(`   ${(i + 1).toString().padStart(3)}. ${r.nombre.padEnd(50)} [${r.categoria}]`)
    })
    log('')

    if (LIMITE > 0 && LIMITE < total) {
        log(`⚠️  Modo límite activado: solo las primeras ${LIMITE} recetas`)
    }

    log(`⏳ Pulsa Ctrl+C para cancelar. Empezando en 3 segundos...`)
    await new Promise(r => setTimeout(r, 3000))

    // 3. Procesar cada receta
    let success = 0
    let failed = 0
    let skipped = 0
    const startTotal = Date.now()

    // Rate limit: Replicate permite ~6 req/min con crédito <$5, ~60 req/min con >$5
    // Usamos 11s (~5.5 req/min) como margen seguro
    const RATE_LIMIT_DELAY_MS = 11_000

    for (let i = 0; i < recetas.length; i++) {
        const receta = recetas[i]!
        const idx = `[${i + 1}/${total}]`
        const elapsedSec = ((Date.now() - startTotal) / 1000).toFixed(0)
        log(`${idx} Procesando: ${receta.nombre} (${elapsedSec}s transcurridos)`)

        // Respetar rate limit de Replicate
        if (i > 0) {
            log(`  ⏳ Esperando ${RATE_LIMIT_DELAY_MS / 1000}s para respetar rate limit...`)
            await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS))
        }

        const tags = receta.tags || []
        const prompt = construirPrompt(receta.nombre, receta.categoria || '', tags)

        // Generar imagen con Flux
        const imgUrl = await generarImagenFlux(prompt)
        if (!imgUrl) {
            failed++
            log(`  ❌ Saltando receta (error generación)`)
            continue
        }

        // Descargar imagen
        const buf = await descargarImagen(imgUrl)
        if (!buf) {
            failed++
            log(`  ❌ Saltando receta (error descarga)`)
            continue
        }

        // Subir a Storage
        const safeName = receta.nombre
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 60)
        const fileName = `flux/${receta.id}/${safeName}.webp`

        const storageUrl = await subirBufferAStorage(buf, fileName)
        if (!storageUrl) {
            failed++
            log(`  ❌ Saltando receta (error subida)`)
            continue
        }

        // Actualizar BD
        const { error: updateError } = await supabase
            .from('recetas')
            .update({ imagen_url: storageUrl })
            .eq('id', receta.id)

        if (updateError) {
            log(`  ❌ Error actualizando BD: ${updateError.message}`)
            failed++
            continue
        }

        success++
        const elapsedMin = ((Date.now() - startTotal) / 1000 / 60).toFixed(1)
        log(`  ✅ ${receta.nombre} → imagen actualizada (${elapsedMin} min transcurridos)`)
    }

    // 4. Resumen
    const totalElapsed = ((Date.now() - startTotal) / 1000 / 60).toFixed(1)
    log('')
    log('═══════════════════════════════════════')
    log(`  ✅ COMPLETADO`)
    log(`  📊 Total: ${total} | Éxito: ${success} | Fallos: ${failed} | Saltados: ${skipped}`)
    log(`  ⏱️  Duración: ${totalElapsed} min`)
    log(`  💰 Coste estimado: ~$${(success * COST_PER_IMG).toFixed(2)}`)
    log('═══════════════════════════════════════')
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
