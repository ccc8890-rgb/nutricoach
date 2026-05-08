/**
 * backfill-recetas.ts
 *
 * Script CLI para rellenar recetas existentes que tienen url_origen
 * pero carecen de instrucciones y/o ingredientes vinculados.
 *
 * Pipeline: SCRAPE → IA REFINEMENT (DeepSeek) → AUTO-MATCH → AUTO-CREACIÓN → DB WRITE
 *
 * Uso:
 *   npx tsx scripts/backfill-recetas.ts
 *
 * Requiere las env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DEEPSEEK_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { refinarRecetaConIA, completarAlimentoConIA } from '../lib/deepseek'

// ─── Cargar .env ──────────────────────────────────────
function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
        console.warn('⚠️  No se encontró .env.local. Usando env vars del sistema.')
        return
    }
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
            process.env[key] = value
        }
    }
}
loadEnvLocal()

// ─── Cliente Supabase service_role ────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

// ─── Normalizaciones plural→singular ──────────────────
const NORMALIZACIONES: Record<string, string> = {
    huevos: 'huevo', cebollas: 'cebolla', tomates: 'tomate',
    patatas: 'patata', zanahorias: 'zanahoria', ajos: 'ajo',
    pechugas: 'pechuga', filetes: 'filete', dientes: 'diente',
    ramas: 'rama', hojas: 'hoja', latas: 'lata',
    cucharadas: 'cucharada', cucharaditas: 'cucharadita',
    tazas: 'taza', vasos: 'vaso', litros: 'litro',
    espinacas: 'espinaca', fresas: 'fresa',
    arándanos: 'arándano', frambuesas: 'frambuesa', moras: 'mora',
    cerezas: 'cereza', ciruelas: 'ciruela', manzanas: 'manzana',
    peras: 'pera', naranjas: 'naranja', limones: 'limón',
    nueces: 'nuez', almendras: 'almendra', avellanas: 'avellana',
    anacardos: 'anacardo', pistachos: 'pistacho',
    garbanzos: 'garbanzo', lentejas: 'lenteja', alubias: 'alubia',
    judías: 'judía', guisantes: 'guisante', setas: 'seta',
    champiñones: 'champiñón', pimientos: 'pimiento',
    calabacines: 'calabacín', pepinos: 'pepino', rábanos: 'rábano',
    boniatos: 'boniato', ñames: 'ñame', mangos: 'mango',
    plátanos: 'plátano', aguacates: 'aguacate',
    trozos: 'trozo', piezas: 'pieza', unidades: 'unidad',
    claras: 'clara', yemas: 'yema',
}

function normalizarNombre(nombre: string): string {
    const palabras = nombre.split(/\s+/)
    return palabras.map(p => NORMALIZACIONES[p.toLowerCase()] ?? p).join(' ')
}

// ─── Parseo de ingredientes ───────────────────────────
function parsearIngrediente(texto: string): { nombre: string; gramos: number } {
    let t = texto.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
    t = t
        .replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75')
        .replace(/⅓/g, '0.33').replace(/⅔/g, '0.67')
        .replace(/\b(\d+)\s+(\d+)\/(\d+)\b/g, (_, w, n, d) => String(parseInt(w) + parseInt(n) / parseInt(d)))
        .replace(/\b(\d+)\/(\d+)\b/g, (_, n, d) => String((parseInt(n) / parseInt(d)).toFixed(2)))

    const limpiarNombre = (raw: string) =>
        raw.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^\s*[,:;\-]\s*/, '').replace(/\s*[,:;\-]\s*$/, '')
            .replace(/^\s*de\b\s*/i, '').replace(/\s+/g, ' ').trim()

    const patterns: [RegExp, number][] = [
        [/([\d.]+)\s*(?:kg|kilos?)\b/i, 1000],
        [/([\d.]+)\s*(?:gramos?|grs?)\b/i, 1],
        [/([\d.]+)\s*g\b/i, 1],
        [/([\d.]+)\s*(?:litros?|l)\b/i, 1000],
        [/([\d.]+)\s*(?:ml|cc)\b/i, 1],
        [/([\d.]+)\s*cucharaditas?\b/i, 5],
        [/([\d.]+)\s*cucharadas?\b/i, 15],
        [/([\d.]+)\s*tazas?\b/i, 200],
        [/([\d.]+)\s*vasos?\b/i, 200],
    ]

    for (const [re, factor] of patterns) {
        const m = t.match(re)
        if (m) {
            return { nombre: limpiarNombre(t.replace(m[0], '')), gramos: Math.max(1, Math.round(parseFloat(m[1]) * factor)) }
        }
    }

    const huevos = t.match(/\b(\d+)\s*huevos?\b/i)
    if (huevos) return { nombre: 'huevo', gramos: parseInt(huevos[1]) * 60 }

    const leadNum = t.match(/^([\d.]+)\s+(.+)/)
    if (leadNum) return { nombre: limpiarNombre(leadNum[2]), gramos: Math.round(parseFloat(leadNum[1]) * 80) }

    return { nombre: limpiarNombre(t), gramos: 0 }
}

function parseDuration(iso?: string): number | undefined {
    if (!iso) return undefined
    const h = iso.match(/(\d+)H/)?.[1], m = iso.match(/(\d+)M/)?.[1]
    const t = (parseInt(h ?? '0') * 60) + parseInt(m ?? '0')
    return t > 0 ? t : undefined
}

// ─── Scraper JSON-LD (para blogs) ─────────────────────
async function scrapeURL(url: string): Promise<{
    nombre: string; descripcion?: string; instrucciones?: string; imagen_url?: string
    porciones?: number; tiempo_prep_min?: number; tiempo_coccion_min?: number
    ingredientes_texto: string[]; url_origen: string
}> {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)]
    let recipe: any = null

    for (const block of jsonLdBlocks) {
        try {
            const parsed = JSON.parse(block[1].trim())
            for (const c of (Array.isArray(parsed) ? parsed : [parsed])) {
                const type = Array.isArray(c['@type']) ? c['@type'] : [c['@type']]
                if (type.some((t: string) => t === 'Recipe' || t?.endsWith('/Recipe'))) { recipe = c; break }
                if (c['@graph']) {
                    const found = c['@graph'].find((g: any) => {
                        const gt = Array.isArray(g['@type']) ? g['@type'] : [g['@type']]
                        return gt.some((t: string) => t === 'Recipe' || t?.endsWith('/Recipe'))
                    })
                    if (found) { recipe = found; break }
                }
            }
            if (recipe) break
        } catch { continue }
    }
    if (!recipe) throw new Error('No se encontraron datos de receta estructurados')

    let imagen_url: string | undefined
    if (recipe.image) {
        if (typeof recipe.image === 'string') imagen_url = recipe.image
        else if (Array.isArray(recipe.image)) imagen_url = typeof recipe.image[0] === 'string' ? recipe.image[0] : recipe.image[0]?.url
        else if (recipe.image.url) imagen_url = recipe.image.url
    }

    const ingredientes_texto: string[] = (recipe.recipeIngredient ?? recipe.ingredients ?? [])
        .map((i: any) => {
            if (typeof i === 'string') return i.trim()
            if (i.name && i.amount) return `${i.amount} ${i.name}`.trim()
            return (i.name ?? i.text ?? '').trim()
        }).filter(Boolean)

    let instrucciones = ''
    const raw = recipe.recipeInstructions ?? recipe.instructions
    if (raw) {
        if (typeof raw === 'string') {
            instrucciones = raw.replace(/<[^>]+>/g, '').trim()
        } else if (Array.isArray(raw)) {
            instrucciones = raw.map((step: any, i: number) => {
                const t = typeof step === 'string' ? step : (step.text ?? step.name ?? '')
                return `${i + 1}. ${t.replace(/<[^>]+>/g, '').trim()}`
            }).filter(s => s.length > 3).join('\n')
        }
    }

    let porciones: number | undefined
    const rawYield = recipe.recipeYield ?? recipe.yield
    if (rawYield) {
        const n = parseInt(String(Array.isArray(rawYield) ? rawYield[0] : rawYield))
        if (!isNaN(n) && n > 0) porciones = n
    }

    return {
        nombre: recipe.name ?? 'Receta importada',
        descripcion: recipe.description?.replace(/<[^>]+>/g, '').trim(),
        instrucciones: instrucciones || undefined,
        imagen_url, porciones,
        tiempo_prep_min: parseDuration(recipe.prepTime),
        tiempo_coccion_min: parseDuration(recipe.cookTime ?? recipe.totalTime),
        ingredientes_texto, url_origen: url,
    }
}

// ─── Scraper HTML crudo para DeepSeek ─────────────────
async function scrapeRawHTML(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    const metaDesc = html.match(/<meta[^>]+name=['"]description['"][^>]+content=['"]([^'"]+)['"]/i)?.[1]
        ?? html.match(/<meta[^>]+content=['"]([^'"]+)['"][^>]+name=['"]description['"]/i)?.[1]
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    let bodyText = ''
    if (bodyMatch) {
        bodyText = bodyMatch[1]
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 6000)
    }

    return [title, metaDesc, bodyText].filter(Boolean).join('\n\n')
}

// ─── Playwright fallback para Instagram/TikTok ────────
const INSTAGRAM_RE = /instagram\.com\/(p|reel)\//i
const TIKTOK_RE = /(tiktok\.com|vm\.tiktok\.com)/i

async function scrapeConPlaywright(url: string): Promise<string> {
    const browser = await chromium.launch({ headless: true })
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            viewport: { width: 390, height: 844 },
            locale: 'es-ES',
        })
        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(2000)

        const metaDesc = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="description"]')
            return meta ? meta.getAttribute('content') : null
        })

        if (metaDesc) return metaDesc
        return await page.evaluate(() => document.body.innerText)
    } finally {
        await browser.close()
    }
}

// ─── Auto-match ingredientes vs DB + auto-creación ────
async function autoMatchIngredientesIA(
    ingredientesRefinados: { nombre_limpio: string; cantidad_gramos: number; macros_100g?: { kcal: number; proteinas: number; carbohidratos: number; grasas: number; fibra?: number } }[],
    coach_id: string
): Promise<{
    ingredientesDB: { alimento_id: string | null; nombre_libre: string; cantidad_gramos: number; orden: number }[]
    matched: number; unmatched: number; autoCreados: number
}> {
    let matched = 0, unmatched = 0, autoCreados = 0
    const ingredientesDB: { alimento_id: string | null; nombre_libre: string; cantidad_gramos: number; orden: number }[] = []

    for (let idx = 0; idx < ingredientesRefinados.length; idx++) {
        const p = ingredientesRefinados[idx]
        const busqueda = p.nombre_limpio.split(/\s+/).slice(0, 3).join(' ')

        let encontrado: any = null

        if (p.cantidad_gramos > 0 && busqueda.length >= 2) {
            // Nivel 1: ilike exacto
            const { data: exacto } = await supabase.from('alimentos').select('*').ilike('nombre', busqueda).limit(1).maybeSingle()
            if (exacto) encontrado = exacto

            // Nivel 2: palabra por palabra (>2 chars)
            if (!encontrado) {
                for (const word of busqueda.split(/\s+/).filter((w: string) => w.length > 2)) {
                    const { data: fb } = await supabase.from('alimentos').select('*').ilike('nombre', `%${word}%`).limit(1).maybeSingle()
                    if (fb) { encontrado = fb; break }
                }
            }

            // Nivel 3: stemming (plural → singular)
            if (!encontrado) {
                const normalizado = normalizarNombre(busqueda)
                if (normalizado !== busqueda) {
                    const { data: stem } = await supabase.from('alimentos').select('*').ilike('nombre', normalizado).limit(1).maybeSingle()
                    if (stem) encontrado = stem

                    if (!encontrado) {
                        for (const word of normalizado.split(/\s+/).filter((w: string) => w.length > 2)) {
                            const { data: fb } = await supabase.from('alimentos').select('*').ilike('nombre', `%${word}%`).limit(1).maybeSingle()
                            if (fb) { encontrado = fb; break }
                        }
                    }
                }
            }
        }

        if (encontrado) {
            ingredientesDB.push({ alimento_id: encontrado.id, nombre_libre: encontrado.nombre, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
            matched++
        } else if (p.macros_100g && p.cantidad_gramos > 0) {
            // Auto-crear alimento con macros de DeepSeek
            const { data: nuevoAlimento } = await supabase.from('alimentos').insert({
                coach_id,
                nombre: p.nombre_limpio,
                calorias: p.macros_100g.kcal,
                proteinas: p.macros_100g.proteinas,
                carbohidratos: p.macros_100g.carbohidratos,
                grasas: p.macros_100g.grasas,
                fibra: p.macros_100g.fibra ?? 0,
                categoria: 'scrapeado',
                fuente: 'deepseek-ia',
            }).select().single()

            if (nuevoAlimento) {
                ingredientesDB.push({ alimento_id: nuevoAlimento.id, nombre_libre: nuevoAlimento.nombre, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
                matched++
                autoCreados++
                continue
            }

            // Si falló la creación, consultar DeepSeek directamente
            try {
                const iaResult = await completarAlimentoConIA(p.nombre_limpio)
                const { data: nuevoAlimento2 } = await supabase.from('alimentos').insert({
                    coach_id,
                    nombre: p.nombre_limpio,
                    calorias: iaResult.data.kcal,
                    proteinas: iaResult.data.proteinas,
                    carbohidratos: iaResult.data.carbohidratos,
                    grasas: iaResult.data.grasas,
                    fibra: iaResult.data.fibra ?? 0,
                    categoria: 'scrapeado',
                    fuente: 'deepseek-ia',
                }).select().single()

                if (nuevoAlimento2) {
                    ingredientesDB.push({ alimento_id: nuevoAlimento2.id, nombre_libre: nuevoAlimento2.nombre, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
                    matched++
                    autoCreados++
                    continue
                }
            } catch { /* fall through to unmatched */ }
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
            unmatched++
        } else {
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
            unmatched++
        }
    }

    return { ingredientesDB, matched, unmatched, autoCreados }
}

// ─── Calcular macros ──────────────────────────────────
async function calcularMacros(
    ingredientes: { alimento_id: string | null; cantidad_gramos: number }[],
    porciones: number
): Promise<{ kcal: number | null; proteinas: number | null; carbohidratos: number | null; grasas: number | null; fibra: number | null }> {
    const ids = ingredientes.filter(i => i.alimento_id).map(i => i.alimento_id!)
    if (ids.length === 0) return { kcal: null, proteinas: null, carbohidratos: null, grasas: null, fibra: null }

    const { data } = await supabase.from('alimentos').select('*').in('id', ids)
    const alimentos = data ?? []
    const lookup = new Map(alimentos.map((a: any) => [a.id, a]))

    let totalKcal = 0, totalProt = 0, totalCarb = 0, totalGras = 0, totalFibra = 0
    for (const ing of ingredientes) {
        if (!ing.alimento_id) continue
        const a = lookup.get(ing.alimento_id) as any
        if (!a) continue
        const f = ing.cantidad_gramos / 100
        totalKcal += a.calorias * f; totalProt += a.proteinas * f
        totalCarb += a.carbohidratos * f; totalGras += a.grasas * f
        totalFibra += (a.fibra ?? 0) * f
    }

    const d = Math.max(1, porciones)
    return {
        kcal: Math.round(totalKcal / d * 100) / 100,
        proteinas: Math.round(totalProt / d * 100) / 100,
        carbohidratos: Math.round(totalCarb / d * 100) / 100,
        grasas: Math.round(totalGras / d * 100) / 100,
        fibra: Math.round(totalFibra / d * 100) / 100,
    }
}

// ─── Detectar si url_origen es una URL válida ─────────
function esURLValida(url: string): boolean {
    try {
        new URL(url)
        return url.startsWith('http://') || url.startsWith('https://')
    } catch {
        return false
    }
}

// ══════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════
async function main() {
    console.log('')
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║   Backfill de Recetas — IA Pipeline v2      ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log('')

    // Verificar DeepSeek API key
    const tieneDeepSeek = !!process.env.DEEPSEEK_API_KEY
    console.log(`🤖 DeepSeek: ${tieneDeepSeek ? '✅ Disponible' : '❌ No configurada (DEEPSEEK_API_KEY)'}`)
    console.log('')

    // 1. Buscar recetas incompletas con url_origen
    console.log('🔍 Buscando recetas incompletas con url_origen...')
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, url_origen, porciones, coach_id, instrucciones')
        .not('url_origen', 'is', null)
        .or('instrucciones.is.null,instrucciones.eq.,instrucciones.eq. ')

    if (error) {
        console.error('❌ Error en query:', error.message)
        process.exit(1)
    }

    if (!recetas || recetas.length === 0) {
        console.log('✅ No hay recetas incompletas con url_origen. Todo al día.')
        process.exit(0)
    }

    console.log(`📦 ${recetas.length} recetas pendientes de completar\n`)

    const stats = { completadas: 0, fallos: 0, saltadas: 0, autoCreadosTotal: 0, tokensTotal: 0 }

    for (let i = 0; i < recetas.length; i++) {
        const receta = recetas[i]
        console.log(`[${i + 1}/${recetas.length}] ${receta.nombre}`)
        console.log(`     URL: ${receta.url_origen}`)

        try {
            // Verificar si ya tiene ingredientes vinculados
            const { data: existingIngs } = await supabase
                .from('receta_ingredientes')
                .select('id')
                .eq('receta_id', receta.id)

            if (existingIngs && existingIngs.length > 0) {
                if (receta.instrucciones && receta.instrucciones.trim().length > 0) {
                    console.log('     ⏭️  Ya completa (ingredientes + instrucciones). Saltando.')
                    stats.saltadas++
                    continue
                }
            }

            // Verificar si url_origen es una URL válida
            if (!esURLValida(receta.url_origen)) {
                console.log(`     ⚠️  url_origen no es una URL válida: "${receta.url_origen}". Saltando.`)
                stats.saltadas++
                continue
            }

            // ─── PIPELINE PRINCIPAL ─────────────────────
            const esSocialMedia = INSTAGRAM_RE.test(receta.url_origen) || TIKTOK_RE.test(receta.url_origen)

            if (esSocialMedia && tieneDeepSeek) {
                // === RUTA SOCIAL MEDIA: Playwright → DeepSeek ===
                console.log('     🎭 Instagram/TikTok detectado, scraping con Playwright...')
                const rawText = await scrapeConPlaywright(receta.url_origen)
                console.log(`     📄 Texto extraído (${rawText.length} chars)`)

                console.log('     🤖 Refinando con DeepSeek...')
                const resultado = await refinarRecetaConIA(rawText, receta.url_origen)
                const refinado = resultado.data
                stats.tokensTotal += resultado.total_tokens
                console.log(`     💰 Tokens: ${resultado.total_tokens}`)

                // Auto-match con auto-creación
                const matchResult = await autoMatchIngredientesIA(refinado.ingredientes, receta.coach_id)
                stats.autoCreadosTotal += matchResult.autoCreados
                console.log(`     📝 ${matchResult.ingredientesDB.length} ingredientes (${matchResult.matched} match, ${matchResult.unmatched} sin vínculo, ${matchResult.autoCreados} auto-creados)`)

                // Actualizar receta
                const updateData: any = {}
                if (refinado.nombre) updateData.nombre = refinado.nombre
                if (refinado.descripcion) updateData.descripcion = refinado.descripcion
                if (refinado.instrucciones) updateData.instrucciones = refinado.instrucciones
                if (refinado.imagen_url) updateData.imagen_url = refinado.imagen_url
                if (refinado.porciones) updateData.porciones = refinado.porciones
                if (refinado.tiempo_prep_min) updateData.tiempo_prep_min = refinado.tiempo_prep_min
                if (refinado.tiempo_coccion_min) updateData.tiempo_coccion_min = refinado.tiempo_coccion_min

                if (Object.keys(updateData).length > 0) {
                    const { error: updErr } = await supabase.from('recetas').update(updateData).eq('id', receta.id)
                    if (updErr) console.warn(`     ⚠️  Error actualizando receta: ${updErr.message}`)
                    else console.log(`     ✅ Receta actualizada (${Object.keys(updateData).join(', ')})`)
                }

                // Reemplazar ingredientes
                if (matchResult.ingredientesDB.length > 0) {
                    await supabase.from('receta_ingredientes').delete().eq('receta_id', receta.id)
                    const { error: insErr } = await supabase.from('receta_ingredientes').insert(
                        matchResult.ingredientesDB.map(ing => ({
                            receta_id: receta.id, alimento_id: ing.alimento_id,
                            nombre_libre: ing.nombre_libre, cantidad_gramos: ing.cantidad_gramos, orden: ing.orden,
                        }))
                    )
                    if (insErr) console.warn(`     ⚠️  Error insertando ingredientes: ${insErr.message}`)
                    else console.log(`     ✅ ${matchResult.ingredientesDB.length} ingredientes guardados`)
                }

                // Recalcular macros
                const porcionesVal = refinado.porciones || receta.porciones || 1
                const macros = await calcularMacros(matchResult.ingredientesDB, porcionesVal)
                if (macros.kcal !== null) {
                    const { error: mErr } = await supabase.from('recetas').update(macros).eq('id', receta.id)
                    if (mErr) console.warn(`     ⚠️  Error actualizando macros: ${mErr.message}`)
                    else console.log(`     ✅ Macros: ${Math.round(macros.kcal)} kcal, P:${Math.round(macros.proteinas!)}g, C:${Math.round(macros.carbohidratos!)}g, G:${Math.round(macros.grasas!)}g`)
                }

                console.log(`     ✅ Completada (DeepSeek)`)
                stats.completadas++

            } else {
                // === RUTA BLOG: JSON-LD → (opcional DeepSeek) ===
                console.log('     🌐 Scrapeando URL...')
                let scraped: Awaited<ReturnType<typeof scrapeURL>>

                try {
                    scraped = await scrapeURL(receta.url_origen)
                } catch {
                    if (tieneDeepSeek) {
                        // Fallback a DeepSeek
                        console.log('     ⚠️ JSON-LD falló, usando DeepSeek como fallback...')
                        try {
                            const rawText = await scrapeRawHTML(receta.url_origen)
                            const resultado = await refinarRecetaConIA(rawText, receta.url_origen)
                            const refinado = resultado.data
                            stats.tokensTotal += resultado.total_tokens
                            console.log(`     💰 Tokens: ${resultado.total_tokens}`)

                            const matchResult = await autoMatchIngredientesIA(refinado.ingredientes, receta.coach_id)
                            stats.autoCreadosTotal += matchResult.autoCreados
                            console.log(`     📝 ${matchResult.ingredientesDB.length} ingredientes (${matchResult.matched} match, ${matchResult.unmatched} sin vínculo, ${matchResult.autoCreados} auto-creados)`)

                            const updateData: any = {}
                            if (refinado.nombre) updateData.nombre = refinado.nombre
                            if (refinado.descripcion) updateData.descripcion = refinado.descripcion
                            if (refinado.instrucciones) updateData.instrucciones = refinado.instrucciones
                            if (refinado.imagen_url) updateData.imagen_url = refinado.imagen_url
                            if (refinado.porciones) updateData.porciones = refinado.porciones
                            if (refinado.tiempo_prep_min) updateData.tiempo_prep_min = refinado.tiempo_prep_min
                            if (refinado.tiempo_coccion_min) updateData.tiempo_coccion_min = refinado.tiempo_coccion_min

                            if (Object.keys(updateData).length > 0) {
                                await supabase.from('recetas').update(updateData).eq('id', receta.id)
                            }

                            if (matchResult.ingredientesDB.length > 0) {
                                await supabase.from('receta_ingredientes').delete().eq('receta_id', receta.id)
                                await supabase.from('receta_ingredientes').insert(
                                    matchResult.ingredientesDB.map(ing => ({
                                        receta_id: receta.id, alimento_id: ing.alimento_id,
                                        nombre_libre: ing.nombre_libre, cantidad_gramos: ing.cantidad_gramos, orden: ing.orden,
                                    }))
                                )
                            }

                            const porcionesVal = refinado.porciones || receta.porciones || 1
                            const macros = await calcularMacros(matchResult.ingredientesDB, porcionesVal)
                            if (macros.kcal !== null) {
                                await supabase.from('recetas').update(macros).eq('id', receta.id)
                                console.log(`     ✅ Macros: ${Math.round(macros.kcal)} kcal`)
                            }

                            console.log(`     ✅ Completada (DeepSeek fallback)`)
                            stats.completadas++
                            continue
                        } catch (dsErr: any) {
                            console.warn(`     ⚠️ DeepSeek fallback también falló: ${dsErr.message}`)
                            throw new Error(`Scrape + DeepSeek fallback: ${dsErr.message}`)
                        }
                    } else {
                        throw new Error(`No se pudo scrapear la URL y DEEPSEEK_API_KEY no está configurada`)
                    }
                }

                // JSON-LD funcionó
                const parsed = scraped.ingredientes_texto.map(t => parsearIngrediente(t))

                // Convertir a formato IA para auto-creación
                const ingredientesIA = parsed.map(p => ({ nombre_limpio: p.nombre, cantidad_gramos: p.gramos }))
                const matchResult = await autoMatchIngredientesIA(ingredientesIA, receta.coach_id)
                stats.autoCreadosTotal += matchResult.autoCreados
                console.log(`     📝 ${matchResult.ingredientesDB.length} ingredientes (${matchResult.matched} match, ${matchResult.unmatched} sin vínculo, ${matchResult.autoCreados} auto-creados)`)

                // Actualizar receta
                const updateData: any = {}
                if (scraped.instrucciones) updateData.instrucciones = scraped.instrucciones
                if (scraped.descripcion) updateData.descripcion = scraped.descripcion
                if (scraped.imagen_url) updateData.imagen_url = scraped.imagen_url
                if (scraped.tiempo_prep_min) updateData.tiempo_prep_min = scraped.tiempo_prep_min
                if (scraped.tiempo_coccion_min) updateData.tiempo_coccion_min = scraped.tiempo_coccion_min
                if (scraped.porciones) updateData.porciones = scraped.porciones

                if (Object.keys(updateData).length > 0) {
                    const { error: updErr } = await supabase.from('recetas').update(updateData).eq('id', receta.id)
                    if (updErr) console.warn(`     ⚠️  Error actualizando receta: ${updErr.message}`)
                    else console.log(`     ✅ Receta actualizada (${Object.keys(updateData).join(', ')})`)
                }

                // Reemplazar ingredientes
                if (matchResult.ingredientesDB.length > 0) {
                    await supabase.from('receta_ingredientes').delete().eq('receta_id', receta.id)
                    const { error: insErr } = await supabase.from('receta_ingredientes').insert(
                        matchResult.ingredientesDB.map(ing => ({
                            receta_id: receta.id, alimento_id: ing.alimento_id,
                            nombre_libre: ing.nombre_libre, cantidad_gramos: ing.cantidad_gramos, orden: ing.orden,
                        }))
                    )
                    if (insErr) console.warn(`     ⚠️  Error insertando ingredientes: ${insErr.message}`)
                    else console.log(`     ✅ ${matchResult.ingredientesDB.length} ingredientes guardados`)
                }

                // Recalcular macros
                const porcionesVal = scraped.porciones ?? receta.porciones ?? 1
                const macros = await calcularMacros(matchResult.ingredientesDB, porcionesVal)
                if (macros.kcal !== null) {
                    const { error: mErr } = await supabase.from('recetas').update(macros).eq('id', receta.id)
                    if (mErr) console.warn(`     ⚠️  Error actualizando macros: ${mErr.message}`)
                    else console.log(`     ✅ Macros: ${Math.round(macros.kcal)} kcal, P:${Math.round(macros.proteinas!)}g, C:${Math.round(macros.carbohidratos!)}g, G:${Math.round(macros.grasas!)}g`)
                }

                console.log(`     ✅ Completada (JSON-LD)`)
                stats.completadas++
            }

        } catch (err: any) {
            console.error(`     ❌ Error: ${err.message}`)
            stats.fallos++
        }

        console.log('')
    }

    // Resumen final
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║             RESUMEN FINAL                    ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log(`   Total recetas procesadas: ${recetas.length}`)
    console.log(`   ✅ Completadas: ${stats.completadas}`)
    console.log(`   ⏭️  Saltadas: ${stats.saltadas}`)
    console.log(`   ❌ Fallos: ${stats.fallos}`)
    console.log(`   🆕 Alimentos auto-creados: ${stats.autoCreadosTotal}`)
    if (stats.tokensTotal > 0) {
        console.log(`   💰 Tokens IA consumidos: ${stats.tokensTotal}`)
    }
    console.log('')
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
