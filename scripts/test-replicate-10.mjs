/**
 * test-replicate-10.mjs — Prueba de Replicate con 10 recetas
 *
 * ESTRATEGIA:
 *   1. Usa Flux Dev (~$0.003/img) para todas — calidad decente
 *   2. Si alguna no convence, se puede regenerar con Flux Pro (~$0.05/img)
 *
 * USO:
 *   1. Ir a https://replicate.com/account/billing → añadir tarjeta + crédito
 *   2. node scripts/test-replicate-10.mjs
 *
 * COSTES:
 *   Flux Dev: 10 × $0.003 = $0.03  ← BARATO
 *   Flux Pro: 10 × $0.05  = $0.50  ← PREMIUM
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Cargar .env.local ──────────────────────────────────
function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim()
        process.env[key] = value
    }
}
loadEnv()

// ════════════════════════════════════════════════════════
//  CONFIGURACIÓN
// ════════════════════════════════════════════════════════

const API_KEY = process.env.REPLICATE_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_URL = 'https://api.replicate.com/v1'

// ── Modelos disponibles ─────────────────────────────────
const MODELOS = {
    DEV: { id: 'black-forest-labs/flux-dev', coste: 0.003, label: 'Flux Dev' },
    PRO: { id: 'black-forest-labs/flux-pro', coste: 0.05, label: 'Flux Pro' },
}

// ── Elegir modelo por defecto ───────────────────────────
const MODO = process.env.MODO || 'dev'  // 'dev' o 'pro'
const MODELO = MODO === 'pro' ? MODELOS.PRO : MODELOS.DEV
const LIMITE = 10
const ESPERA = 3000  // ms entre peticiones

if (!API_KEY) {
    console.error('❌ REPLICATE_API_KEY no encontrada en .env.local')
    process.exit(1)
}

// ════════════════════════════════════════════════════════
//  SUPABASE
// ════════════════════════════════════════════════════════

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function getRecetasSinImagen() {
    const { data, error } = await supabase
        .from('recetas')
        .select('id, nombre, categoria, url_origen, imagen_url')
        .is('imagen_url', null)
        .eq('estado', 'aprobada')
        .limit(LIMITE)
    if (error) throw error
    return data
}

// ════════════════════════════════════════════════════════
//  GENERAR IMAGEN
// ════════════════════════════════════════════════════════

async function generarImagen(prompt, modeloId = MODELO.id, reintento = 0) {
    const res = await fetch(`${API_URL}/predictions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            version: modeloId,
            input: {
                prompt,
                aspect_ratio: '1:1',
                output_format: 'webp',
                safety_tolerance: 2,
                num_outputs: 1,
            },
        }),
    })

    if (!res.ok) {
        const err = await res.text()

        // Rate limit → reintentar con backoff
        if (res.status === 429 && reintento < 5) {
            const espera = ESPERA * (reintento + 1)
            console.log(`   ⏳ Rate limit - esperando ${espera / 1000}s (intento ${reintento + 1}/5)...`)
            await new Promise(r => setTimeout(r, espera))
            return generarImagen(prompt, modeloId, reintento + 1)
        }

        // Crédito insuficiente
        if (res.status === 402) {
            throw new Error('CREDITO_INSUFICIENTE')
        }

        throw new Error(`Replicate error ${res.status}: ${err.slice(0, 200)}`)
    }

    const prediction = await res.json()
    console.log(`   ⏳ Generando...`)

    const start = Date.now()
    const timeout = MODO === 'pro' ? 90000 : 45000
    let url = prediction.urls.get

    while (Date.now() - start < timeout) {
        await new Promise(r => setTimeout(r, 2000))

        const poll = await fetch(url, {
            headers: { 'Authorization': `Bearer ${API_KEY}` },
        })
        if (!poll.ok) throw new Error(`Poll error ${poll.status}`)

        const status = await poll.json()

        if (status.status === 'succeeded') {
            const output = status.output
            if (Array.isArray(output) && output.length > 0) return output[0]
            if (typeof output === 'string') return output
            return null
        }
        if (status.status === 'failed') {
            throw new Error(`Modelo falló: ${status.error}`)
        }
        url = status.urls.get
    }
    throw new Error('Timeout')
}

// ════════════════════════════════════════════════════════
//  SUBIR A STORAGE
// ════════════════════════════════════════════════════════

async function subirStorage(imageUrl, nombre) {
    const safeName = nombre
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80)
    const fileName = `replicate/${safeName}-${Date.now()}.webp`

    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`Download error ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') || 'image/webp'

    let result = await supabase.storage.from('recetas').upload(fileName, buffer, {
        contentType, upsert: true,
    })
    if (result.error?.message?.includes('bucket')) {
        await supabase.storage.createBucket('recetas', { public: true })
        result = await supabase.storage.from('recetas').upload(fileName, buffer, {
            contentType, upsert: true,
        })
    }
    if (result.error) throw result.error

    const { data: pub } = supabase.storage.from('recetas').getPublicUrl(fileName)
    return pub.publicUrl
}

// ════════════════════════════════════════════════════════
//  PROMPTS
// ════════════════════════════════════════════════════════

function construirPrompt(nombre, categoria, ingredientes) {
    const ings = (ingredientes || []).slice(0, 6).join(', ')
    return `Fotografía realista de comida casera, plano cenital o 45 grados, plato de "${nombre}" servido en plato de cerámica blanco sobre mesa de madera. ${(categoria || 'Comida').toLowerCase()} recién preparada. Ingredientes visibles: ${ings || 'los propios de la receta'}. Sin ingredientes adicionales, sin toppings decorativos, sin adornos, solo la comida tal cual en el plato. Iluminación natural de ventana lateral, texturas realistas, sin edición excesiva, estilo fotografía de blog de cocina casera, fondo desenfocado suave. Aspecto auténtico, nada de estudio, nada de inteligencia artificial evidente.`
}

// ════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════

async function main() {
    // Usar variable de entorno MODO=pro para cambiar a Flux Pro
    const modoLabel = MODO === 'pro' ? `Flux Pro 1.1 ($${MODELO.coste}/img)` : `Flux Dev ($${MODELO.coste}/img)`

    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log(`  🎨 PRUEBA REPLICATE — ${MODELO.label}`)
    console.log('═══════════════════════════════════════════')
    console.log('')
    console.log(`  📋 Modo: ${modoLabel}`)
    console.log(`  💡 Para usar Flux Pro: MODO=pro node scripts/test-replicate-10.mjs`)
    console.log('')

    const recetas = await getRecetasSinImagen()
    console.log(`📦 Recetas sin imagen: ${recetas.length}`)
    const costeTotal = (recetas.length * MODELO.coste).toFixed(3)
    console.log(`💰 Coste estimado: ${recetas.length} × $${MODELO.coste} = ~$${costeTotal}`)
    console.log('')

    let exitosas = 0
    let fallidas = 0
    let sinCredito = false
    let resultados = []

    for (let i = 0; i < recetas.length; i++) {
        const r = recetas[i]
        console.log(`\n─── [${i + 1}/${recetas.length}] ${r.nombre} ───`)

        const prompt = construirPrompt(r.nombre, r.categoria)
        console.log(`   📝 Prompt: ${prompt.slice(0, 90)}...`)

        try {
            const imagenUrl = await generarImagen(prompt)
            if (!imagenUrl) throw new Error('No se generó imagen')

            console.log(`   ✅ Imagen generada`)

            const publicUrl = await subirStorage(imagenUrl, r.nombre)

            await supabase
                .from('recetas')
                .update({ imagen_url: publicUrl })
                .eq('id', r.id)

            console.log(`   ✅ Guardada en BD`)
            exitosas++
            resultados.push({ nombre: r.nombre, estado: '✅', modelo: MODELO.label })

        } catch (err) {
            const msg = err.message

            if (msg === 'CREDITO_INSUFICIENTE') {
                console.error(`   ❌ CRÉDITO INSUFICIENTE`)
                console.error(`   ➡️  Ve a https://replicate.com/account/billing y añade método de pago`)
                sinCredito = true
                break
            }

            console.error(`   ❌ Error: ${msg}`)
            fallidas++
            resultados.push({ nombre: r.nombre, estado: '❌', modelo: MODELO.label })
        }

        if (i < recetas.length - 1) {
            console.log(`   ⏳ Esperando ${ESPERA / 1000}s...`)
            await new Promise(r => setTimeout(r, ESPERA))
        }
    }

    // ── Resumen ────────────────────────────────────────
    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log('  📊 RESUMEN')
    console.log('═══════════════════════════════════════════')
    console.log(`  Modelo:     ${MODELO.label}`)
    console.log(`  ✅ Exitosas: ${exitosas}`)
    console.log(`  ❌ Fallidas: ${fallidas}`)
    console.log(`  💰 Coste:    ~$${((exitosas + fallidas) * MODELO.coste).toFixed(3)}`)
    console.log('')

    // ── Resultados detallados ──────────────────────────
    if (resultados.length > 0) {
        console.log('  Resultados:')
        resultados.forEach(r => {
            console.log(`    ${r.estado} ${r.nombre} (${r.modelo})`)
        })
    }
    console.log('')

    if (sinCredito) {
        console.log('  ❌ El proceso se detuvo por falta de crédito.')
        console.log('  ➡️  Añade método de pago en:')
        console.log('     https://replicate.com/account/billing')
        console.log('')
        console.log('  📌 Después de añadir crédito, ejecuta de nuevo:')
        console.log('     node scripts/test-replicate-10.mjs')
    } else {
        console.log('🌐 Abre http://localhost:3008/recetas para ver los resultados')
        console.log('')
        if (MODO === 'dev') {
            console.log('💡 Si la calidad no te convence, prueba con Flux Pro:')
            console.log('   MODO=pro node scripts/test-replicate-10.mjs')
        }
    }
    console.log('')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
