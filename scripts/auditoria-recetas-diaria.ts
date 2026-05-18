/**
 * auditoria-recetas-diaria.ts
 *
 * ═══════════════════════════════════════════════════════════════════
 *  SISTEMA DE AUDITORÍA INTELIGENTE DE RECETAS — DIARIA
 * ═══════════════════════════════════════════════════════════════════
 *
 * ¿Qué hace?
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ 1. DIAGNÓSTICO     → Detecta ingredientes huérfanos, kcal=0    │
 * │ 2. VERIFICACIÓN IA → DeepSeek contrasta cada receta con        │
 * │                      recetas similares de internet             │
 * │ 3. EXTRACCIÓN      → Instagram/TikTok/YouTube oEmbed → img/vid │
 * │ 4. GENERACIÓN IA   → Replicate Flux Pro (si no hay URL real)   │
 * │ 5. SUBIDA STORAGE  → Imágenes a Supabase Storage               │
 * │ 6. VÍDEO EMBEBIDO  → Extrae o descubre video_url de la fuente  │
 * │ 7. REPORTE         → Resumen completo de todo lo procesado     │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * USO DIARIO:
 *   npx tsx scripts/auditoria-recetas-diaria.ts
 *
 * USO CRON (cada día a las 6:00 AM):
 *   0 6 * * * cd /ruta/proyecto && npx tsx scripts/auditoria-recetas-diaria.ts >> logs/auditoria.log 2>&1
 *
 * CONFIGURACIÓN NECESARIA EN .env.local:
 *   DEEPSEEK_API_KEY          → DeepSeek (ya configurado)
 *   REPLICATE_API_KEY         → Replicate (para generar imágenes)
 *   NEXT_PUBLIC_SUPABASE_URL  → Ya configurado
 *   SUPABASE_SERVICE_ROLE_KEY → Ya configurado
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Config ────────────────────────────────────────────────────────

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const REPLICATE_API_URL = 'https://api.replicate.com/v1'
// Modelos de Replicate para generación de imágenes
// Flux Pro 1.1: calidad superior, recomendado para fotografía de comida realista
// Flux Dev: más barato pero alucina ingredientes y parece más artificial
const FLUX_PRO_MODEL = 'black-forest-labs/flux-pro'   // ~$0.05/img — calidad profesional
const FLUX_DEV_MODEL = 'black-forest-labs/flux-dev'    // ~$0.003/img — económico, menos realista
const ACTIVE_MODEL = process.env.MODO === 'dev' ? FLUX_DEV_MODEL : FLUX_PRO_MODEL
const BATCH_SIZE = 4 // Recetas por lote a DeepSeek
const MAX_RECETAS_POR_EJECUCION = 15 // Límite por ejecución (evitar costes altos)

// ── Cargar .env.local ─────────────────────────────────────────────

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnvLocal()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

// ── Interfaces ────────────────────────────────────────────────────

interface RecetaParaAuditar {
    id: string
    nombre: string
    categoria: string | null
    dificultad: string | null
    tipo_coccion: string | null
    tipo_plato: string | null
    descripcion: string | null
    instrucciones: string | null
    consejos: string | null
    url_origen: string | null
    imagen_url: string | null
    video_url: string | null
    kcal: number | null
    proteinas: number | null
    carbohidratos: number | null
    grasas: number | null
    porciones: number | null
    ingredientes: { nombre: string; gramos: number }[]
}

interface IARevisionReceta {
    receta_id: string
    nombre: string
    puntuacion: number // 0-10 (calidad de la receta)
    veracidad: number  // 0-10 (qué tan realista/verificada es)
    problemas: string[] // Problemas detectados
    sugerencias: string[] // Sugerencias de mejora
    recetas_similares: string[] // Recetas similares encontradas en internet
    es_realista: boolean // Si parece una receta posible y coherente
    justificacion: string
}

// ── 1. DIAGNÓSTICO ────────────────────────────────────────────────

async function diagnosticar(): Promise<{
    total: number
    sinImagen: number
    sinVideo: number
    ingredientesSueltos: number
    kcalCero: number
    recetasParaRevisar: RecetaParaAuditar[]
}> {
    console.log('\n═══════════════════════════════════════════')
    console.log('  🔍 FASE 1: DIAGNÓSTICO')
    console.log('═══════════════════════════════════════════\n')

    // Obtener todas las recetas aprobadas
    const { data: recetas } = await supabase
        .from('recetas')
        .select('*')
        .eq('estado', 'aprobada')

    if (!recetas || recetas.length === 0) {
        console.log('  ❌ No hay recetas aprobadas')
        process.exit(0)
    }

    const total = recetas.length
    const sinImagen = recetas.filter(r => !r.imagen_url).length
    const sinVideo = recetas.filter(r => !r.video_url).length
    console.log(`  📊 Recetas aprobadas: ${total}`)
    console.log(`  📸 Sin imagen_url: ${sinImagen}`)
    console.log(`  🎬 Sin video_url: ${sinVideo}`)

    // Verificar ingredientes huérfanos
    const { data: ingredientes } = await supabase
        .from('receta_ingredientes')
        .select('receta_id, nombre_libre, cantidad_gramos, alimento_id')

    const sueltos = (ingredientes || []).filter(i => !i.alimento_id && (i.cantidad_gramos || 0) > 0)
    console.log(`  🥗 Ingredientes sin alimento_id: ${sueltos.length}`)
    console.log(`  🔥 Recetas con kcal=0: ${recetas.filter(r => !r.kcal || r.kcal === 0).length}`)

    // Recetas sin imagen (prioritarias)
    const recetasSinImagen = recetas
        .filter(r => !r.imagen_url)
        .slice(0, MAX_RECETAS_POR_EJECUCION)

    // Preparar datos completos para cada receta
    const recetasParaRevisar: RecetaParaAuditar[] = []
    for (const r of recetasSinImagen) {
        const { data: ings } = await supabase
            .from('receta_ingredientes')
            .select('nombre_libre, cantidad_gramos')
            .eq('receta_id', r.id)

        recetasParaRevisar.push({
            id: r.id,
            nombre: r.nombre,
            categoria: r.categoria,
            dificultad: r.dificultad,
            tipo_coccion: r.tipo_coccion,
            tipo_plato: r.tipo_plato,
            descripcion: r.descripcion,
            instrucciones: r.instrucciones,
            consejos: r.consejos,
            url_origen: r.url_origen,
            imagen_url: r.imagen_url,
            video_url: r.video_url,
            kcal: r.kcal,
            proteinas: r.proteinas,
            carbohidratos: r.carbohidratos,
            grasas: r.grasas,
            porciones: r.porciones,
            ingredientes: (ings || []).map(i => ({
                nombre: i.nombre_libre || '',
                gramos: i.cantidad_gramos || 0,
            })),
        })
    }

    if (sueltos.length > 0) {
        console.log(`\n  ⚠️  Recetas con ingredientes sueltos:`)
        const recetasAfectadas = new Set(sueltos.map(i => i.receta_id))
        for (const rid of recetasAfectadas) {
            const receta = recetas.find(r => r.id === rid)
            if (receta) {
                const ingsReceta = sueltos.filter(i => i.receta_id === rid)
                console.log(`     📛 ${receta.nombre}: ${ingsReceta.length} ingredientes sueltos`)
                for (const ing of ingsReceta) {
                    console.log(`       - ${ing.nombre_libre} (${ing.cantidad_gramos}g)`)
                }
            }
        }
    }

    return {
        total,
        sinImagen,
        sinVideo,
        ingredientesSueltos: sueltos.length,
        kcalCero: recetas.filter(r => !r.kcal || r.kcal === 0).length,
        recetasParaRevisar,
    }
}

// ── 2. VERIFICACIÓN CON DEEPSEEK ──────────────────────────────────

async function llamarDeepSeek(prompt: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const res = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Eres un coach nutricional experto y verificador de recetas. Tu trabajo es analizar recetas y contrastarlas con recetas reales que existen en internet para verificar que sean coherentes, posibles y realistas.

Debes responder EXCLUSIVAMENTE con un JSON array de objetos, sin markdown ni explicaciones adicionales.

Cada objeto tiene esta estructura:
{
  "receta_id": "uuid-de-la-receta",
  "nombre": "nombre de la receta",
  "puntuacion": 0-10,
  "veracidad": 0-10,
  "problemas": ["problema1", "problema2"],
  "sugerencias": ["sugerencia1"],
  "recetas_similares": ["nombre de receta similar real que existe en internet"],
  "es_realista": true/false,
  "justificacion": "explicación breve"
}

CRITERIOS DE EVALUACIÓN:
- puntuacion: calidad general de la receta (ingredientes, instrucciones, presentación)
- veracidad: qué tan realista es (¿las cantidades tienen sentido? ¿los ingredientes combinan bien?)
- problemas: detecta cantidades absurdas (pimienta 100g, sal 50g), ingredientes que no combinan, instrucciones imposibles
- sugerencias: mejoras concretas y accionables
- recetas_similares: nombres de recetas REALES que existen en Instagram, blogs de cocina, etc. con ingredientes o preparación similar
- es_realista: true si la receta es coherente y podría existir realmente
- justificacion: en 1-2 frases, explica tu veredicto`,
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4000,
        }),
    })

    if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`DeepSeek error ${res.status}: ${errBody}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
}

function construirPromptVerificacion(recetas: RecetaParaAuditar[]): string {
    return `Analiza estas ${recetas.length} recetas de un recetario de nutrición deportiva. Para cada una, evalúa si es realista, si las cantidades tienen sentido, y busca recetas similares reales en internet.

RECETAS A ANALIZAR:
${JSON.stringify(recetas.map(r => ({
        receta_id: r.id,
        nombre: r.nombre,
        categoria: r.categoria,
        dificultad: r.dificultad,
        tipo_coccion: r.tipo_coccion,
        descripcion: r.descripcion,
        ingredientes: r.ingredientes,
        instrucciones: r.instrucciones ? r.instrucciones.substring(0, 500) : null,
        url_origen: r.url_origen,
    })), null, 2)}

RESPONDE EXCLUSIVAMENTE CON UN JSON ARRAY.`
}

async function verificarConDeepSeek(recetas: RecetaParaAuditar[]): Promise<IARevisionReceta[]> {
    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  🧠 FASE 2: VERIFICACIÓN IA (DeepSeek)`)
    console.log(`═══════════════════════════════════════════\n`)

    const resultados: IARevisionReceta[] = []
    const lotes = Math.ceil(recetas.length / BATCH_SIZE)

    for (let i = 0; i < recetas.length; i += BATCH_SIZE) {
        const lote = recetas.slice(i, i + BATCH_SIZE)
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        console.log(`  📦 Lote ${batchNum}/${lotes} (${lote.length} recetas)...`)

        const prompt = construirPromptVerificacion(lote)

        try {
            const content = await llamarDeepSeek(prompt)

            // Extraer JSON array de la respuesta
            let revisiones: IARevisionReceta[] = []

            // Intentar parse directo
            try {
                revisiones = JSON.parse(content)
            } catch {
                // Buscar [ ... ] con regex
                const jsonMatch = content.match(/\[[\s\S]*?\]/)
                if (jsonMatch) {
                    try {
                        revisiones = JSON.parse(jsonMatch[0])
                    } catch {
                        // Fallback: extraer objetos individuales
                        const objs: string[] = []
                        let depth = 0, start = -1
                        for (let j = 0; j < content.length; j++) {
                            if (content[j] === '{') { if (depth === 0) start = j; depth++ }
                            else if (content[j] === '}') {
                                depth--
                                if (depth === 0 && start >= 0) {
                                    objs.push(content.slice(start, j + 1))
                                    start = -1
                                }
                            }
                        }
                        revisiones = objs.map(o => {
                            try { return JSON.parse(o) } catch { return null }
                        }).filter(Boolean) as IARevisionReceta[]
                    }
                }
            }

            if (revisiones.length > 0) {
                resultados.push(...revisiones)
                console.log(`     ✅ ${revisiones.length} recetas verificadas`)

                for (const rev of revisiones) {
                    const icono = rev.es_realista ? '✅' : '⚠️'
                    console.log(`     ${icono} ${rev.nombre.substring(0, 40)} | P:${rev.puntuacion}/10 V:${rev.veracidad}/10`)
                    if (rev.problemas?.length > 0) {
                        for (const p of rev.problemas.slice(0, 2)) {
                            console.log(`        ⚠️ ${p}`)
                        }
                    }
                }
            } else {
                console.warn(`     ⚠️ No se pudieron extraer revisiones válidas`)
            }
        } catch (err) {
            console.error(`     ❌ Error en lote ${batchNum}:`, (err as Error).message)
        }

        // Pausa entre lotes para no saturar
        if (batchNum < lotes) {
            await new Promise(r => setTimeout(r, 2000))
        }
    }

    return resultados
}

// ── 3. EXTRAER IMAGEN DE INSTAGRAM/TIKTOK ─────────────────────────

/**
 * EXTRAE imagen real de una URL usando múltiples métodos en cascada.
 * Pipeline: oEmbed → meta tags → Playwright screenshot → Flux AI
 *
 * ORDEN DE INTENTOS (el primero que funciona gana):
 *   1. oEmbed API (Instagram, TikTok, YouTube) → thumbnail_url
 *   2. Meta tags HTML (og:image, twitter:image) desde cualquier URL
 *   3. Playwright: abre URL en navegador real → captura screenshot
 *   4. Flux AI text-to-image (si REPLICATE_API_KEY configurada)
 *
 * NUNCA FALLA — siempre devuelve algo o null si no hay alternativa.
 */

// ── Intentar descargar una imagen (devuelve buffer si funciona) ──
async function descargarImagen(url: string): Promise<Buffer | null> {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return null
        const contentType = res.headers.get('content-type') || ''
        if (!contentType.startsWith('image/')) return null
        const arrayBuffer = await res.arrayBuffer()
        if (arrayBuffer.byteLength < 100) return null // Mínimo 100 bytes
        return Buffer.from(arrayBuffer)
    } catch {
        return null
    }
}

// ── Scrapea meta tags de una URL ──────────────────────────
async function extraerMetaTags(url: string): Promise<{
    imagen_url: string | null
    titulo: string | null
    video_url: string | null
}> {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept-Language': 'es-ES,es;q=0.9',
            },
            signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return { imagen_url: null, titulo: null, video_url: null }
        const html = await res.text()

        const extract = (prop: string): string | null => {
            const re = new RegExp(`<meta\\s+property=["']${prop}["']\\s+content=["']([^"']+)["']`, 'i')
            const m = html.match(re)
            return m ? m[1] : null
        }
        const extractName = (prop: string): string | null => {
            const re = new RegExp(`<meta\\s+name=["']${prop}["']\\s+content=["']([^"']+)["']`, 'i')
            const m = html.match(re)
            return m ? m[1] : null
        }

        const imagen = extract('og:image') || extractName('twitter:image') || extract('og:image:url')
        const titulo = extract('og:title') || extractName('twitter:title') || extract('og:site_name')
        const video = extract('og:video') || extract('og:video:url') || extractName('twitter:player')

        return { imagen_url: imagen, titulo, video_url: video }
    } catch {
        return { imagen_url: null, titulo: null, video_url: null }
    }
}

// ── Capturar screenshot con Playwright ─────────────────────
async function capturarConPlaywright(url: string): Promise<Buffer | null> {
    try {
        const { chromium } = await import('playwright')
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 }, // iPhone 15 Pro
        })
        const page = await context.newPage()

        // Interceptar peticiones de imagen y capturar la más grande
        let mejorImagen: Buffer | null = null
        let mayorTamano = 0

        page.on('response', async (response) => {
            const contentType = response.headers()['content-type'] || ''
            if (contentType.startsWith('image/')) {
                try {
                    const buffer = await response.body()
                    if (buffer.length > mayorTamano) {
                        mayorTamano = buffer.length
                        mejorImagen = buffer
                    }
                } catch { /* ignorar */ }
            }
        })

        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })

        // Esperar un poco a que carguen imágenes
        await page.waitForTimeout(2000)

        // Buscar la imagen más grande en la página
        const imgSrcs = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'))
            return imgs
                .filter(img => img.naturalWidth > 100 && img.naturalHeight > 100)
                .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))
                .slice(0, 3)
                .map(img => img.src)
        })

        // Intentar descargar las imágenes encontradas
        for (const src of imgSrcs) {
            const buf = await descargarImagen(src)
            if (buf && buf.length > mayorTamano) {
                mejorImagen = buf
                mayorTamano = buf.length
            }
        }

        await browser.close()

        // Si encontramos alguna imagen, devolverla
        if (mejorImagen && mayorTamano > 5000) {
            return mejorImagen
        }

        // Último recurso: capturar screenshot completo
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false })
        await browser.close()

        if (screenshot.length > 10000) { // Mínimo 10KB
            return screenshot
        }

        return null
    } catch {
        return null
    }
}

// ── Intentar obtener imagen real por cualquier medio ──────
async function obtenerImagenReal(url: string): Promise<{
    imagen_url: string | null
    video_url: string | null
    buffer: Buffer | null
    origen: 'directa' | 'oembed' | 'meta_tags' | 'playwright' | 'ninguno'
}> {
    const resultado = { imagen_url: null as string | null, video_url: null as string | null, buffer: null as Buffer | null, origen: 'ninguno' as any }

    if (!url) return resultado

    const u = url.toLowerCase()

    // ── MÉTODO 1: oEmbed (mejor para Instagram/TikTok/YouTube) ──
    let oembedUrl = ''
    const platform = u.includes('instagram.com') ? 'instagram' :
        u.includes('tiktok.com') ? 'tiktok' :
            u.includes('youtube.com') || u.includes('youtu.be') ? 'youtube' : 'unknown'

    if (platform !== 'unknown') {
        oembedUrl = platform === 'instagram' ? `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&format=json` :
            platform === 'tiktok' ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}&format=json` :
                `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`

        try {
            const res = await fetch(oembedUrl, {
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; NutriCoachBot/1.0)' },
                signal: AbortSignal.timeout(8000),
            })
            const text = await res.text()

            if (!text.trimStart().startsWith('<!')) {
                if (res.ok) {
                    const data = JSON.parse(text)
                    if (data.thumbnail_url) {
                        // Intentar descargar la thumbnail
                        const buf = await descargarImagen(data.thumbnail_url)
                        if (buf) {
                            resultado.imagen_url = data.thumbnail_url
                            resultado.buffer = buf
                            resultado.origen = 'oembed'
                        }
                    }
                }

                // Construir video embed URL
                if (platform === 'youtube') {
                    try {
                        const parsed = new URL(url)
                        const vid = parsed.hostname.includes('youtu.be')
                            ? parsed.pathname.slice(1).split('?')[0]
                            : parsed.searchParams.get('v')
                        if (vid) resultado.video_url = `https://www.youtube.com/embed/${vid}`
                    } catch { }
                } else {
                    resultado.video_url = url // Instagram/TikTok nativa
                }
            }
        } catch { /* oEmbed falló, seguir */ }
    }

    // ── MÉTODO 2: Meta tags (og:image) ─────────────────────
    if (!resultado.buffer) {
        const meta = await extraerMetaTags(url)
        if (meta.imagen_url) {
            const buf = await descargarImagen(meta.imagen_url)
            if (buf) {
                resultado.imagen_url = meta.imagen_url
                resultado.buffer = buf
                resultado.origen = 'meta_tags'
            }
        }
        if (!resultado.video_url && meta.video_url) {
            resultado.video_url = meta.video_url
        }
    }

    // ── MÉTODO 3: Playwright (navegador real) ──────────────
    // Solo si los métodos anteriores fallaron, porque es más lento
    if (!resultado.buffer) {
        console.log(`     🎭 Intentando con Playwright (navegador real)...`)
        const buf = await capturarConPlaywright(url)
        if (buf) {
            resultado.buffer = buf
            resultado.imagen_url = '__playwright_captura__' // Marcador especial
            resultado.origen = 'playwright'
        }
    }

    // Si no hay video pero ya tenemos la URL original, asignarla
    if (!resultado.video_url && platform !== 'unknown') {
        resultado.video_url = url
    }

    return resultado
}

// ── Generar imagen con Flux AI (Replicate) ────────────────
async function generarConFlux(
    prompt: string,
    imagenReferencia: string | null = null
): Promise<string | null> {
    const apiKey = process.env.REPLICATE_API_KEY
    if (!apiKey) return null

    const modelo = ACTIVE_MODEL
    const label = modelo === FLUX_PRO_MODEL ? 'Flux Pro' : 'Flux Dev'

    try {
        const input: any = {
            prompt,
            aspect_ratio: '1:1',
            output_format: 'webp',
            safety_tolerance: 2,
            num_outputs: 1,
        }

        // Si hay imagen de referencia, pasarla como image (img2img)
        if (imagenReferencia) {
            input.image = imagenReferencia
            input.strength = 0.85 // Mantener 85% de la original
        }

        console.log(`     🎨 ${label} generando...`)
        if (imagenReferencia) console.log(`     🖼️  Usando imagen de referencia`)

        const createRes = await fetch(`${REPLICATE_API_URL}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ version: modelo, input }),
        })

        if (!createRes.ok) {
            const err = await createRes.text()
            if (createRes.status === 402) {
                console.warn(`     ⚠️ Crédito insuficiente en Replicate`)
                return null
            }
            if (createRes.status === 429) {
                // Rate limit, esperar y reintentar una vez
                console.log(`     ⏳ Rate limit, esperando 10s...`)
                await new Promise(r => setTimeout(r, 10000))
                return generarConFlux(prompt, imagenReferencia)
            }
            console.warn(`     ⚠️ Replicate error ${createRes.status}: ${err.substring(0, 100)}`)
            return null
        }

        const prediction = await createRes.json()
        const timeout = 60000
        const start = Date.now()
        let url = prediction.urls.get

        while (Date.now() - start < timeout) {
            await new Promise(r => setTimeout(r, 2000))
            const poll = await fetch(url, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            })
            if (!poll.ok) break
            const status = await poll.json()

            if (status.status === 'succeeded') {
                const output = status.output
                if (Array.isArray(output) && output.length > 0) return output[0]
                if (typeof output === 'string') return output
                return null
            }
            if (status.status === 'failed') {
                console.warn(`     ⚠️ ${label} falló: ${status.error}`)
                return null
            }
            url = status.urls.get
        }
        return null
    } catch (err) {
        console.warn(`     ⚠️ Error en ${label}:`, (err as Error).message)
        return null
    }
}

// ── Subir buffer a Supabase Storage ───────────────────────
async function subirBufferAStorage(
    buffer: Buffer,
    nombreReceta: string,
    origen: string
): Promise<string | null> {
    const safeName = nombreReceta
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60)
    const fileName = `${origen}/${safeName}-${Date.now()}.webp`

    try {
        let result = await supabase.storage.from('recetas').upload(fileName, buffer, {
            contentType: 'image/webp',
            upsert: true,
        })

        if (result.error?.message?.includes('bucket') || result.error?.message?.includes('not found')) {
            await supabase.storage.createBucket('recetas', { public: true })
            result = await supabase.storage.from('recetas').upload(fileName, buffer, {
                contentType: 'image/webp',
                upsert: true,
            })
        }

        if (result.error) throw result.error

        const { data: pub } = supabase.storage.from('recetas').getPublicUrl(fileName)
        return pub.publicUrl
    } catch {
        return null
    }
}

// ── FASE 3: Extracción de medios (pipeline completo) ──────
async function faseExtraerMedia(recetas: RecetaParaAuditar[]): Promise<{
    extraidas: number
    generadas: number
    errores: number
}> {
    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  📸 FASE 3: EXTRACCIÓN DE MEDIOS`)
    console.log(`  Pipeline: scrap → download → Playwright → Flux AI`)
    console.log(`═══════════════════════════════════════════\n`)

    let extraidas = 0
    let generadas = 0
    let errores = 0

    for (let i = 0; i < recetas.length; i++) {
        const receta = recetas[i]
        console.log(`\n  📝 [${i + 1}/${recetas.length}] ${receta.nombre}`)

        try {
            let imagenFinalUrl: string | null = null
            let videoFinal: string | null = null
            let bufferImagen: Buffer | null = null
            let origenImagen = ''

            // ═══════════════════════════════════════════════════
            // PASO 1: Extraer imagen de url_origen (scrapeo)
            // ═══════════════════════════════════════════════════
            if (receta.url_origen) {
                console.log(`     🔗 Extrayendo de: ${receta.url_origen.substring(0, 70)}`)
                const resultado = await obtenerImagenReal(receta.url_origen)

                if (resultado.buffer) {
                    bufferImagen = resultado.buffer
                    origenImagen = resultado.origen
                    videoFinal = resultado.video_url

                    if (resultado.origen === 'playwright') {
                        console.log(`     🎭 Captura Playwright exitosa`)
                    } else if (resultado.origen === 'meta_tags') {
                        console.log(`     ✅ Imagen por meta tags`)
                    } else if (resultado.origen === 'oembed') {
                        console.log(`     ✅ Imagen vía oEmbed`)
                    }
                } else {
                    console.log(`     ⚠️ Scrapeo no encontró imagen utilizable`)
                    videoFinal = resultado.video_url
                }
            } else {
                console.log(`     🔗 Sin URL de origen`)
            }

            // ═══════════════════════════════════════════════════
            // PASO 2: Si hay buffer, subirlo a Storage (GRATIS)
            // ═══════════════════════════════════════════════════
            if (bufferImagen) {
                const publicUrl = await subirBufferAStorage(bufferImagen, receta.nombre, origenImagen)
                if (publicUrl) {
                    imagenFinalUrl = publicUrl
                    extraidas++
                    console.log(`     📤 Subida a Storage (${origenImagen})`)
                }
            }

            // ═══════════════════════════════════════════════════
            // PASO 3: Si no hay imagen, generar con Flux AI
            // ═══════════════════════════════════════════════════
            if (!imagenFinalUrl) {
                const modeloLabel = ACTIVE_MODEL === FLUX_PRO_MODEL ? 'Flux Pro' : 'Flux Dev'

                // Construir prompt de fotografía realista de comida
                // IMPORTANTE: El prompt debe ser muy específico para evitar que la IA
                // alucine ingredientes (ej: huevo frito encima de un bizcocho).
                const promptLimpio = receta.nombre
                    .replace(/\([^)]*\)/g, '').replace(/TEST/gi, '').trim()
                const categoria = receta.categoria || 'Comida'
                const metodo = receta.tipo_coccion || ''
                const ingredientesStr = (receta.ingredientes || [])
                    .slice(0, 7).map(i => i.nombre).join(', ')

                const prompt = `Fotografía realista de comida casera, plano cenital o 45 grados, plato de "${promptLimpio}" servido en un plato de cerámica blanco sobre mesa de madera. ${categoria} recién preparada.${metodo ? ` Preparado al ${metodo}.` : ''} Ingredientes visibles en el plato: ${ingredientesStr || 'propios de la receta'}. Sin ingredientes adicionales, sin toppings decorativos, sin adornos, solo la comida tal cual en el plato. Iluminación natural de ventana lateral, texturas realistas, sin edición excesiva, sin brillos artificiales, estilo fotografía de blog de cocina casera, fondo desenfocado suave. Aspecto auténtico y natural, nada de estudio, nada de inteligencia artificial evidente.`

                // Si tenemos URL de referencia de oEmbed (aunque falle descarga), pasarla a Flux como referencia
                const imagenRef = origenImagen === 'meta_tags' || origenImagen === 'oembed'
                    ? null // Las que fallaron descarga no sirven como referencia
                    : null

                const fluxUrl = await generarConFlux(prompt, imagenRef)
                if (fluxUrl) {
                    // Descargar la imagen generada y subirla a Storage
                    const buf = await descargarImagen(fluxUrl)
                    if (buf) {
                        const publicUrl = await subirBufferAStorage(buf, receta.nombre, 'flux')
                        if (publicUrl) {
                            imagenFinalUrl = publicUrl
                            generadas++
                            console.log(`     ✅ Imagen generada con ${modeloLabel}`)
                        }
                    } else {
                        // Fallback: usar URL directa de Replicate
                        imagenFinalUrl = fluxUrl
                        generadas++
                        console.log(`     ✅ Imagen generada con ${modeloLabel} (URL directa)`)
                    }
                } else {
                    console.log(`     ⏭️ No se pudo generar imagen IA`)
                }
            }

            // ═══════════════════════════════════════════════════
            // PASO 4: Actualizar BD
            // ═══════════════════════════════════════════════════
            if (imagenFinalUrl || videoFinal) {
                const updates: Record<string, string | null> = {}
                if (imagenFinalUrl) updates.imagen_url = imagenFinalUrl
                if (videoFinal) updates.video_url = videoFinal

                const { error: updateError } = await supabase
                    .from('recetas')
                    .update(updates as any)
                    .eq('id', receta.id)

                if (updateError) {
                    console.error(`     ❌ Error BD: ${updateError.message}`)
                    errores++
                } else {
                    const parts = Object.entries(updates)
                        .filter(([, v]) => v).map(([k]) => k)
                    console.log(`     ✅ BD actualizada: ${parts.join(', ')}`)
                }
            }
        } catch (err) {
            console.error(`     ❌ Error: ${(err as Error).message}`)
            errores++
        }

        // Pausa entre recetas
        await new Promise(r => setTimeout(r, 500))
    }

    return { extraidas, generadas, errores }
}

// ── 4. REPORTE FINAL ──────────────────────────────────────────────

function generarReporte(
    diagnostico: Awaited<ReturnType<typeof diagnosticar>>,
    verificaciones: IARevisionReceta[],
    medios: { extraidas: number; generadas: number; errores: number }
): string {
    const fecha = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

    const recetasMalas = verificaciones.filter(v => !v.es_realista || v.puntuacion < 5)
    const recetasBuenas = verificaciones.filter(v => v.es_realista && v.puntuacion >= 7)

    let reporte = `
╔══════════════════════════════════════════════════════════╗
║     INFORME DIARIO DE AUDITORÍA DE RECETAS              ║
║     ${fecha}
╚══════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════
  📊 ESTADO GENERAL DEL RECETARIO
═══════════════════════════════════════════════════════════
  Total recetas:        ${diagnostico.total}
  Sin imagen:           ${diagnostico.sinImagen}
  Sin video:            ${diagnostico.sinVideo}
  Ingredientes sueltos: ${diagnostico.ingredientesSueltos}
  Kcal = 0:             ${diagnostico.kcalCero}

═══════════════════════════════════════════════════════════
  🧠 VERIFICACIÓN IA (DeepSeek)
═══════════════════════════════════════════════════════════
  Recetas verificadas:  ${verificaciones.length}
  ✅ Recetas correctas: ${recetasBuenas.length}
  ⚠️  Recetas con problemas: ${recetasMalas.length}
  Puntuación media:     ${verificaciones.length > 0 ? (verificaciones.reduce((a, v) => a + v.puntuacion, 0) / verificaciones.length).toFixed(1) : 'N/A'}/10
  Veracidad media:      ${verificaciones.length > 0 ? (verificaciones.reduce((a, v) => a + v.veracidad, 0) / verificaciones.length).toFixed(1) : 'N/A'}/10
`

    if (recetasMalas.length > 0) {
        reporte += `
⚠️  RECETAS CON PROBLEMAS DETECTADOS:
`
        for (const r of recetasMalas) {
            reporte += `  📛 ${r.nombre} (P:${r.puntuacion}/10 V:${r.veracidad}/10)\n`
            for (const p of r.problemas || []) {
                reporte += `    ⚠️  ${p}\n`
            }
            reporte += `    💡 ${r.justificacion}\n`
        }
    }

    if (recetasBuenas.length > 0) {
        reporte += `
✅ RECETAS VERIFICADAS CORRECTAMENTE:
`
        for (const r of recetasBuenas) {
            reporte += `  ✅ ${r.nombre} (P:${r.puntuacion}/10 V:${r.veracidad}/10)\n`
            if (r.recetas_similares?.length > 0) {
                reporte += `    🔗 Recetas similares: ${r.recetas_similares.slice(0, 3).join(', ')}\n`
            }
        }
    }

    reporte += `
═══════════════════════════════════════════════════════════
  📸 PROCESAMIENTO DE IMÁGENES
═══════════════════════════════════════════════════════════
  Extraídas de Instagram/TikTok: ${medios.extraidas}
  Generadas con IA:              ${medios.generadas}
  Errores:                       ${medios.errores}
  Total procesadas:              ${medios.extraidas + medios.generadas}

═══════════════════════════════════════════════════════════
  📋 ACCIONES RECOMENDADAS
═══════════════════════════════════════════════════════════
`

    if (diagnostico.ingredientesSueltos > 0) {
        reporte += `  🔧 Ejecutar: npx tsx scripts/fix-ingredients-ia.ts (${diagnostico.ingredientesSueltos} ingredientes sueltos)\n`
    }
    if (recetasMalas.length > 0) {
        reporte += `  🔧 Revisar manualmente las ${recetasMalas.length} recetas con problemas\n`
    }
    if (diagnostico.sinImagen > medios.extraidas + medios.generadas) {
        reporte += `  🔧 Quedan ${diagnostico.sinImagen - medios.extraidas - medios.generadas} recetas sin imagen pendientes\n`
    }
    if (!process.env.REPLICATE_API_KEY) {
        reporte += `  🔧 Configurar REPLICATE_API_KEY en .env.local para generación de imágenes IA\n`
    }

    reporte += `\n═══════════════════════════════════════════════════════════\n`

    return reporte
}

// ── MAIN ──────────────────────────────────────────────────────────

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     🏥 NUTRICOACH — AUDITORÍA DIARIA DE RECETAS        ║
║     Sistema autónomo de verificación y mejora continua   ║
╚══════════════════════════════════════════════════════════╝
`)

    const startTime = Date.now()

    // FASE 1: Diagnóstico
    const diagnostico = await diagnosticar()

    if (diagnostico.recetasParaRevisar.length === 0) {
        console.log('\n  ✅ Todas las recetas tienen imagen. No hay nada que procesar hoy.')
        console.log(`  ⏱️  Tiempo total: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`)
        return
    }

    // FASE 2: Verificación IA (solo primeras recetas para no saturar)
    let verificaciones: IARevisionReceta[] = []
    if (diagnostico.recetasParaRevisar.length > 0) {
        const recetasParaVerificar = diagnostico.recetasParaRevisar.slice(0, BATCH_SIZE * 2) // Max 8 para IA
        verificaciones = await verificarConDeepSeek(recetasParaVerificar)
    }

    // FASE 3: Extraer/generar medios
    const medios = await faseExtraerMedia(diagnostico.recetasParaRevisar)

    // Reporte final
    const reporte = generarReporte(diagnostico, verificaciones, medios)
    console.log(reporte)

    // Guardar reporte en archivo
    const fechaStr = new Date().toISOString().split('T')[0]
    const reportDir = path.resolve(process.cwd(), 'salidas')
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true })
    }
    const reportPath = path.join(reportDir, `auditoria-diaria-${fechaStr}.md`)
    fs.writeFileSync(reportPath, reporte, 'utf-8')
    console.log(`  📄 Reporte guardado en: ${reportPath}`)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`  ⏱️  Tiempo total: ${elapsed}s\n`)
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})
