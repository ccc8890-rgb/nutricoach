/**
 * healthify-receta.mjs
 *
 * Crea versiones healthy/fit de recetas usando DeepSeek V4 Pro.
 * DeepSeek aplica reglas de healthificación (sustituye frituras por Air Fryer,
 * salsas pesadas por bases de yogur/cottage, harinas refinadas por avena, etc.)
 * y genera la receta completa lista para insertar en NutriCoach.
 *
 * MODOS:
 *   - Por nombre:  genera desde el conocimiento de DeepSeek
 *   - Por URL:     primero scraping, luego healthificación
 *
 * USO:
 *   node scripts/healthify-receta.mjs --nombre "Lasaña boloñesa"
 *   node scripts/healthify-receta.mjs --nombre "Wrap César Fit" --specs "pollo cornflakes air fryer, salsa yogur griego"
 *   node scripts/healthify-receta.mjs --url "https://receta.com/lasana" --nombre "Lasaña fit"
 *   node scripts/healthify-receta.mjs --dry-run --nombre "Tiramisú fit"
 *
 * OPCIONES:
 *   --nombre      Nombre de la receta fit a crear (requerido)
 *   --specs       Especificaciones adicionales de Carlos (sustituye, método, etc.)
 *   --base        Nombre de la receta original en el recetario (para usar como base)
 *   --url         URL de receta para scrapear y healthificar
 *   --tipo-plato  Comida|Cena|Desayuno|Merienda|Snack|Postre (por defecto: Comida)
 *   --porciones   Número de porciones (por defecto: 2)
 *   --dry-run     Solo muestra la receta generada sin insertar
 *   --sin-imagen  No genera imagen (más rápido)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const p = resolve(RAÍZ, '.env.local')
    if (!existsSync(p)) return
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[k]) process.env[k] = v
    }
}
loadEnv()

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const COACH_ID = process.env.NUTRICOACH_COACH_ID

if (!DEEPSEEK_KEY) { console.error('❌ DEEPSEEK_API_KEY no configurada'); process.exit(1) }
if (!COACH_ID) { console.error('❌ NUTRICOACH_COACH_ID no configurada'); process.exit(1) }

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

// ── Parsear args ──────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2)
const getArg = (flag) => { const i = ARGS.indexOf(flag); return i !== -1 ? ARGS[i + 1] : null }
const hasFlag = (flag) => ARGS.includes(flag)

const NOMBRE = getArg('--nombre')
const SPECS = getArg('--specs') || ''
const BASE = getArg('--base')
const URL_RECETA = getArg('--url')
const TIPO_PLATO = getArg('--tipo-plato') || 'Comida'
const PORCIONES = parseInt(getArg('--porciones') || '2', 10)
const LINK_TO = getArg('--link-to') // UUID de la receta original
const DRY_RUN = hasFlag('--dry-run')
const SIN_IMAGEN = hasFlag('--sin-imagen')

if (!NOMBRE) {
    console.error('❌ Debes indicar --nombre "Nombre de la receta fit"')
    console.error('   Ejemplo: node scripts/healthify-receta.mjs --nombre "Lasaña fit"')
    process.exit(1)
}

// ── System prompt de healthificación ─────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un dietista y chef experto en versiones healthy/fit de recetas populares españolas.
Tu tarea es crear una receta healthificada completa, apetecible y con macros realistas.

REGLAS DE HEALTHIFICACIÓN (aplicar siempre):
1. Frituras → Air Fryer, horno, plancha o vapor
2. Rebozados con harina blanca → copos de avena, cornflakes sin azúcar, pan rallado integral
3. Salsas grasas (mayonesa, nata) → yogur griego 0%, queso cottage, leche evaporada desnatada
4. Aceite en exceso → spray de aceite o reducir drásticamente
5. Azúcar/miel en exceso → eritritol, stevia, o reducir 70%
6. Pasta/arroz blanco → integral, de legumbre, o konjac
7. Quesos muy grasos → ricotta, cottage, mozzarella light, queso fresco 0%
8. Nata/mantequilla → yogur griego, queso cottage, aceite de coco en poca cantidad
9. Carnes grasas → pechuga de pollo/pavo, ternera magra 5%, pescado blanco/azul
10. Harinas refinadas → harina de avena, harina de almendra, harina de garbanzos

SALSAS FIT DE REFERENCIA:
- César fit: yogur griego 0% + mostaza dijon + limón + ajo en polvo + parmesano rallado + clara cocida triturada
- Bechamel fit: leche desnatada + maicena + queso fresco 0% (sin mantequilla)
- Carbonara fit: queso cottage + huevo + parmesano (sin nata)
- Alioli fit: yogur griego + ajo + limón (sin aceite ni mayonesa)
- Mayonesa ligera: 1 huevo + aceite mínimo + limón (reducir aceite 70% vs receta normal)

RESPONDE ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones), con esta estructura exacta:
{
  "nombre": "string",
  "descripcion": "string (2-3 frases apetecibles)",
  "tipo_plato": "Comida",
  "categoria": "Carnes|Pescados|Ensaladas|Platos variados|Mealpreps|Bowls fruta|Postres|Snacks|Desayunos",
  "tipo_coccion": "Horno|Freidora de Aire|Plancha|Sartén/Wok|No Bake|Vapor|Microondas|Olla/Cazuela",
  "dificultad": "Fácil|Medio|Difícil",
  "porciones": 2,
  "tiempo_prep_min": 15,
  "tiempo_coccion_min": 20,
  "instrucciones": "1. Paso breve.\\n2. Paso breve.\\n3. Paso breve. (máx 8 pasos, concisos)",
  "descripcion_porcion": "1 wrap",
  "consejos": "string breve (opcional)",
  "intolerancias": ["Sin Gluten"],
  "ingredientes": [
    {"nombre": "Pechuga de pollo", "gramos": 200},
    {"nombre": "Yogur griego 0%", "gramos": 120}
  ],
  "cambios_fit": ["Rebozado con cornflakes en lugar de harina + freír", "Salsa de yogur en lugar de mayonesa"]
}`

// ── Llamada a DeepSeek ────────────────────────────────────────────────────────
async function callDeepSeek(userPrompt) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
            model: 'deepseek-v4-pro',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.4,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(180000),
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`DeepSeek ${res.status}: ${err.slice(0, 300)}`)
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')
    const usage = data.usage
    if (usage) {
        const cost = (usage.prompt_tokens / 1e6 * 0.15) + (usage.completion_tokens / 1e6 * 0.60)
        console.log(`  💰 Tokens: ${usage.prompt_tokens}in / ${usage.completion_tokens}out ($${cost.toFixed(4)})`)
    }
    return JSON.parse(content)
}

// ── Scraping de URL (si se pasa --url) ───────────────────────────────────────
async function scrapeReceta(url) {
    console.log(`  🌐 Scrapeando ${url}...`)
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // Extraer JSON-LD Recipe si existe
    const jsonLdMatch = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)
    if (jsonLdMatch) {
        for (const tag of jsonLdMatch) {
            try {
                const json = JSON.parse(tag.replace(/<\/?script[^>]*>/gi, '').trim())
                const items = Array.isArray(json) ? json : [json]
                const recipe = items.find(i => i['@type'] === 'Recipe' || (Array.isArray(i['@type']) && i['@type'].includes('Recipe')))
                if (recipe) {
                    const ings = (recipe.recipeIngredient || []).join(', ')
                    const name = recipe.name || 'Receta sin nombre'
                    const desc = recipe.description || ''
                    return { nombre: name, descripcion: desc, ingredientes_texto: ings }
                }
            } catch { /* ignorar JSON-LD inválido */ }
        }
    }

    // Fallback: extraer texto plano limpio
    const texto = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 3000)
    return { nombre: NOMBRE, descripcion: '', ingredientes_texto: texto }
}

// ── Matching de ingredientes en BD ───────────────────────────────────────────
function normalizar(s) {
    return s.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function matchIngrediente(nombreLibre) {
    const n = normalizar(nombreLibre)
    const palabras = n.split(' ').filter(w => w.length > 2)

    // Nivel 1: exacto
    const { data: exacto } = await supabase.from('alimentos').select('id, nombre, calorias')
        .ilike('nombre', nombreLibre).gt('calorias', 0).limit(1)
    if (exacto?.length) return exacto[0]

    // Nivel 2: startsWith con la palabra principal
    for (const palabra of palabras) {
        const { data } = await supabase.from('alimentos').select('id, nombre, calorias')
            .ilike('nombre', `${palabra}%`).gt('calorias', 0).order('calorias', { ascending: false }).limit(3)
        if (data?.length) {
            // Preferir el que tenga más palabras en común
            const scored = data.map(a => {
                const an = normalizar(a.nombre).split(' ')
                const match = palabras.filter(w => an.some(aw => aw.startsWith(w) || w.startsWith(aw))).length
                return { ...a, score: match }
            }).sort((a, b) => b.score - a.score)
            if (scored[0].score > 0) return scored[0]
        }
    }

    // Nivel 3: contains
    for (const palabra of palabras) {
        const { data } = await supabase.from('alimentos').select('id, nombre, calorias')
            .ilike('nombre', `%${palabra}%`).gt('calorias', 0).limit(1)
        if (data?.length) return data[0]
    }

    return null
}

// ── Generación de imagen ──────────────────────────────────────────────────────
async function generarImagen(nombre) {
    if (!OPENAI_KEY) return null
    const safeName = nombre.toLowerCase().replace('rape', 'monkfish').replace('cornflakes', 'cereal flakes')
    const prompt = `Photo of "${safeName}" taken by a Spanish nutrition coach for Instagram.
Home kitchen setting, clean surface, natural window light. Healthy and appetizing.
Overhead or slight angle. No text, no watermarks. Square format. Photorealistic.`

    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-image-1.5', prompt, n: 1, size: '1024x1024', quality: 'medium', output_format: 'jpeg' }),
        signal: AbortSignal.timeout(120000),
    })
    if (!res.ok) { console.log(`  ⚠️  Imagen: OpenAI ${res.status}`); return null }
    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    return b64 ? Buffer.from(b64, 'base64') : null
}

async function subirImagen(recetaId, buffer) {
    const path = `${recetaId}/auto_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('recetas').upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(`Upload: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from('recetas').getPublicUrl(path)
    return publicUrl
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🥗 Healthify Receta — "${NOMBRE}"`)
    console.log(`   Modo: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 REAL'}\n`)

    // 1. Preparar contexto para DeepSeek
    let contexto = ''

    if (URL_RECETA) {
        const scraped = await scrapeReceta(URL_RECETA)
        contexto = `Receta original: "${scraped.nombre}"\nDescripción: ${scraped.descripcion}\nIngredientes originales: ${scraped.ingredientes_texto}\n\n`
    }

    if (BASE) {
        const { data: recetaBase } = await supabase.from('recetas')
            .select('nombre, instrucciones, descripcion, receta_ingredientes(nombre_libre, cantidad_gramos)')
            .ilike('nombre', `%${BASE}%`).limit(1).single()
        if (recetaBase) {
            const ings = (recetaBase.receta_ingredientes || []).map(i => `${i.nombre_libre} (${i.cantidad_gramos}g)`).join(', ')
            contexto = `Receta base (del recetario): "${recetaBase.nombre}"\nIngredientes: ${ings}\nInstrucciones: ${recetaBase.instrucciones?.slice(0, 500)}\n\n`
        }
    }

    const userPrompt = `${contexto}Crea la versión healthy/fit de esta receta:

NOMBRE DESEADO: "${NOMBRE}"
TIPO DE PLATO: ${TIPO_PLATO}
PORCIONES: ${PORCIONES}
${SPECS ? `ESPECIFICACIONES DE CARLOS: ${SPECS}` : ''}

Aplica las reglas de healthificación. Devuelve la receta completa en JSON.`

    // 2. Llamar a DeepSeek
    console.log('🧠 Generando receta con DeepSeek...')
    const receta = await callDeepSeek(userPrompt)

    // 3. Mostrar resultado
    console.log(`\n✅ Receta generada: "${receta.nombre}"`)
    console.log(`   ${receta.descripcion}`)
    console.log(`   🕐 ${(receta.tiempo_prep_min || 0) + (receta.tiempo_coccion_min || 0)} min | 🍽️ ${receta.porciones} p. | ${receta.tipo_coccion}`)
    console.log(`   Dificultad: ${receta.dificultad}`)
    if (receta.cambios_fit?.length) {
        console.log(`\n💚 Cambios fit aplicados:`)
        receta.cambios_fit.forEach(c => console.log(`   • ${c}`))
    }
    console.log(`\n🧾 Ingredientes (${receta.ingredientes?.length || 0}):`)
    for (const ing of (receta.ingredientes || [])) {
        console.log(`   ${String(ing.gramos).padStart(5)}g  ${ing.nombre}`)
    }

    if (DRY_RUN) {
        console.log('\n🔍 DRY RUN — nada insertado. Añade --genera para ejecutar.\n')
        console.log('\nInstrucciones:\n' + receta.instrucciones)
        return
    }

    // 4. Matchear ingredientes con BD
    console.log('\n🔗 Matcheando ingredientes...')
    const ingredientesMatcheados = []
    let totalKcal = 0, totalProt = 0, totalCarbs = 0, totalGrasas = 0

    for (const ing of (receta.ingredientes || [])) {
        const alimento = await matchIngrediente(ing.nombre)
        if (alimento) {
            const factor = ing.gramos / 100
            const { data: macros } = await supabase.from('alimentos')
                .select('calorias, proteinas, carbohidratos, grasas').eq('id', alimento.id).single()
            if (macros) {
                totalKcal += (macros.calorias || 0) * factor
                totalProt += (macros.proteinas || 0) * factor
                totalCarbs += (macros.carbohidratos || 0) * factor
                totalGrasas += (macros.grasas || 0) * factor
            }
            ingredientesMatcheados.push({ nombre_libre: ing.nombre, cantidad_gramos: ing.gramos, alimento_id: alimento.id })
            console.log(`  ✅ ${ing.nombre} → ${alimento.nombre}`)
        } else {
            ingredientesMatcheados.push({ nombre_libre: ing.nombre, cantidad_gramos: ing.gramos, alimento_id: null })
            console.log(`  ⚠️  ${ing.nombre} → sin match en BD`)
        }
    }

    const porciones = receta.porciones || PORCIONES
    const kcalPorcion = totalKcal / porciones
    const protPorcion = totalProt / porciones
    const carbsPorcion = totalCarbs / porciones
    const grasasPorcion = totalGrasas / porciones

    console.log(`\n📊 Macros por porción (estimados):`)
    console.log(`   🔥 ${Math.round(kcalPorcion)} kcal | P ${Math.round(protPorcion)}g | C ${Math.round(carbsPorcion)}g | G ${Math.round(grasasPorcion)}g`)

    // 5. Insertar receta
    const { data: nuevaReceta, error: insertError } = await supabase.from('recetas').insert({
        nombre: receta.nombre,
        descripcion: receta.descripcion,
        instrucciones: receta.instrucciones,
        consejos: receta.consejos || null,
        tipo_plato: receta.tipo_plato || TIPO_PLATO,
        categoria: receta.categoria || 'Platos variados',
        tipo_coccion: receta.tipo_coccion || 'Horno',
        dificultad: receta.dificultad || 'Medio',
        porciones,
        descripcion_porcion: receta.descripcion_porcion || null,
        tiempo_prep_min: receta.tiempo_prep_min || 15,
        tiempo_coccion_min: receta.tiempo_coccion_min || 20,
        kcal: Math.round(kcalPorcion * 10) / 10,
        proteinas: Math.round(protPorcion * 10) / 10,
        carbohidratos: Math.round(carbsPorcion * 10) / 10,
        grasas: Math.round(grasasPorcion * 10) / 10,
        intolerancias: receta.intolerancias || [],
        estado: 'aprobada',
        coach_id: COACH_ID,
        receta_original_id: LINK_TO ?? null,
    }).select('id').single()

    if (insertError) { console.error(`❌ Error insertando receta: ${insertError.message}`); process.exit(1) }
    const recetaId = nuevaReceta.id
    console.log(`\n✅ Receta insertada: ${recetaId}`)

    // 6. Insertar ingredientes
    if (ingredientesMatcheados.length) {
        const { error: ingError } = await supabase.from('receta_ingredientes').insert(
            ingredientesMatcheados.map((ing, i) => ({ ...ing, receta_id: recetaId, orden: i + 1 }))
        )
        if (ingError) console.log(`  ⚠️  Error ingredientes: ${ingError.message}`)
        else console.log(`  ✅ ${ingredientesMatcheados.length} ingredientes insertados`)
    }

    // 7. Generar imagen
    if (!SIN_IMAGEN && OPENAI_KEY) {
        console.log('\n🖼️  Generando imagen...')
        try {
            const buffer = await generarImagen(receta.nombre)
            if (buffer) {
                const url = await subirImagen(recetaId, buffer)
                await supabase.from('recetas').update({ imagen_url: url }).eq('id', recetaId)
                console.log(`  ✅ Imagen subida: ${url.slice(-40)}`)
            }
        } catch (err) {
            console.log(`  ⚠️  Imagen: ${err.message}`)
        }
    }

    console.log(`\n🎉 LISTO — "${receta.nombre}"`)
    console.log(`   Ver en: /recetas/${recetaId}\n`)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
