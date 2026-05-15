/**
 * pipeline-calidad.mjs
 *
 * Pipeline automático de calidad del recetario NutriCoach.
 * Detecta y corrige problemas sin intervención manual.
 *
 * FASES (en orden):
 *   1. Quality check  — detecta problemas por categoría
 *   2. Fix matches    — corrige matches sospechosos conocidos
 *   3. Fix cantidades — DeepSeek estima gramos realistas (todo a 100g)
 *   4. Recalcular macros — desde ingredientes actualizados
 *   5. Intolerancias  — auto-detecta desde nombres de ingredientes
 *   6. Fotos          — genera imágenes faltantes con OpenAI
 *
 * USO:
 *   node scripts/pipeline-calidad.mjs                  → todas las recetas aprobadas
 *   node scripts/pipeline-calidad.mjs --horas 24       → importadas en las últimas 24h
 *   node scripts/pipeline-calidad.mjs --id <uuid>      → una receta específica
 *   node scripts/pipeline-calidad.mjs --dry-run        → preview sin aplicar
 *   node scripts/pipeline-calidad.mjs --sin-fotos      → omitir generación de imágenes
 *   node scripts/pipeline-calidad.mjs --solo-fase 4    → ejecutar solo una fase
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

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

// ── Args ─────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2)
const getArg = f => { const i = ARGS.indexOf(f); return i !== -1 ? ARGS[i + 1] : null }
const DRY_RUN   = ARGS.includes('--dry-run')
const SIN_FOTOS = ARGS.includes('--sin-fotos')
const HORAS     = parseInt(getArg('--horas') || '0', 10)
const SOLO_ID   = getArg('--id')
const SOLO_FASE = parseInt(getArg('--solo-fase') || '0', 10)

// ── Contadores globales ───────────────────────────────────────────────────────
const stats = { matches: 0, cantidades: 0, macros: 0, intolerancias: 0, fotos: 0, errores: 0 }

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizar(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function callDeepSeek(system, user, maxTokens = 2048) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.2,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(90000),
    })
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
    const data = await res.json()
    return JSON.parse(data.choices[0].message.content)
}

// ── Cargar recetas a procesar ─────────────────────────────────────────────────
async function cargarRecetas() {
    let q = supabase.from('recetas')
        .select('id, nombre, porciones, tipo_plato, imagen_url, intolerancias, kcal, proteinas, carbohidratos, grasas, instrucciones')
        .eq('estado', 'aprobada')
        .order('created_at', { ascending: false })

    if (SOLO_ID) {
        q = q.eq('id', SOLO_ID)
    } else if (HORAS > 0) {
        const desde = new Date(Date.now() - HORAS * 3600000).toISOString()
        q = q.gte('created_at', desde)
    }

    const { data, error } = await q
    if (error) throw new Error(`Carga recetas: ${error.message}`)
    return data || []
}

// ══════════════════════════════════════════════════════════════════════════════
// FASE 1 — QUALITY CHECK
// ══════════════════════════════════════════════════════════════════════════════
async function fase1_qualityCheck(recetas) {
    console.log('\n📊 FASE 1 — Quality Check')
    const issues = { sinFoto: [], sinMacros: [], sinIntolerancia: [], todo100g: [], sinIngredientes: [] }

    for (const r of recetas) {
        if (!r.imagen_url) issues.sinFoto.push(r)
        if (!r.kcal || r.kcal === 0) issues.sinMacros.push(r)
        if (!r.intolerancias || r.intolerancias.length === 0) issues.sinIntolerancia.push(r)
    }

    // Detectar recetas con todos los ingredientes a 100g
    const ids = recetas.map(r => r.id)
    if (ids.length > 0) {
        // Query manual para detectar ingredientes todos a 100g
        const { data: ingData } = await supabase
            .from('receta_ingredientes')
            .select('receta_id, cantidad_gramos')
            .in('receta_id', ids)

        if (ingData) {
            const agrupados = {}
            for (const i of ingData) {
                if (!agrupados[i.receta_id]) agrupados[i.receta_id] = []
                agrupados[i.receta_id].push(i.cantidad_gramos)
            }
            for (const [rid, gramos] of Object.entries(agrupados)) {
                if (gramos.length === 0) {
                    const r = recetas.find(x => x.id === rid)
                    if (r) issues.sinIngredientes.push(r)
                } else if (gramos.length >= 2 && gramos.every(g => Math.round(g) === 100)) {
                    const r = recetas.find(x => x.id === rid)
                    if (r) issues.todo100g.push(r)
                }
            }
        }
    }

    console.log(`   📷 Sin foto:          ${issues.sinFoto.length}`)
    console.log(`   🔢 Sin macros:        ${issues.sinMacros.length}`)
    console.log(`   🌿 Sin intolerancias: ${issues.sinIntolerancia.length}`)
    console.log(`   ⚖️  Todo a 100g:       ${issues.todo100g.length}`)
    console.log(`   🥕 Sin ingredientes:  ${issues.sinIngredientes.length}`)

    return issues
}

// ══════════════════════════════════════════════════════════════════════════════
// FASE 2 — FIX MATCHES SOSPECHOSOS
// ══════════════════════════════════════════════════════════════════════════════

// Patrones: [regex_nombre_libre, alimento_id_correcto, nombre_correcto]
// Añadir aquí cuando se detecte un patrón sistemático
const MATCH_FIXES = [
    // Sal → matchea "Salsa pesto", "Salsa de tomate", etc. por prefijo
    [/^sal$/i,           '0adc820b-8ec6-4888-8c75-91e916531f60', 'Sal'],
    [/^agua$/i,          'c125af5a-afe3-4ffc-a9d5-185817b6a9db', 'Agua'],
    // Chocolate → matchea cereales de chocolate
    [/^chocolate negro/i, 'ccedb95e-bd69-4b1f-a940-3b5909db3a3d', 'Chocolate negro 85% cacao'],
    [/^chocolate$/i,      'ccedb95e-bd69-4b1f-a940-3b5909db3a3d', 'Chocolate negro 85% cacao'],
    // Miel → matchea salsas con miel
    [/^miel$/i,          '8619b09f-af3a-4ec4-a11c-f8eace75e90f', 'Miel'],
    // Calabaza → matchea pipas de calabaza
    [/^calabaza$/i,      'cfd9ca77-0710-4f2b-bae1-0219fe9de85c', 'Calabaza'],
    // Zumo de limón → matchea "Zumo maracuyá y chía" u otros zumos por prefijo "zumo"
    [/^zumo de lim/i,   '60ad001e-bb47-44ba-a48f-c8afe9a2e6f2', 'Limón'],
    [/^jugo de lim/i,   '60ad001e-bb47-44ba-a48f-c8afe9a2e6f2', 'Limón'],
    // Spray de aceite → matchea "Aceite de Aguacate Cristal" u otros aceites de supermercado
    [/^spray.*aceite/i, 'bf392211-3527-4c7d-98a5-a2fc0bda8270', 'Aceite de oliva'],
    [/^aceite en spray/i,'bf392211-3527-4c7d-98a5-a2fc0bda8270', 'Aceite de oliva'],
    // Ajo en polvo → matchea "Cebolla en polvo" por la palabra "polvo" en común
    [/^ajo en polvo/i,  'bbece24a-301c-40fe-97d2-81fe63fca922', 'Ajo en polvo'],
    // Tomates secos → matchea "Dátiles secos" por la palabra "secos" en común
    [/^tomates? sec/i,  '954a260a-2a2b-45c1-810f-59d05987d5bd', 'Tomate seco'],
    // Yemas de huevo → matchea "Yemas muy Gruesas Frasco" (0 kcal) por prefijo "yema"
    [/^yemas? de huevo/i,'fd38e2b4-8579-482a-9caf-0d0ae21087df', 'Yema de huevo'],
]

// IDs de alimentos que son SOSPECHOSOS como resultado de match (productos muy procesados)
const ALIMENTOS_SOSPECHOSOS_RE = [
    /cereales cubiertos/i,
    /bollería/i,
    /croissant/i,
    /berlina/i,
    /rosquillas/i,
    /bocaditos/i,
    /papilla.*meses/i,
    /postre lácteo infantil/i,
]

async function fase2_fixMatches(recetas) {
    console.log('\n🔧 FASE 2 — Fix matches sospechosos')
    let corregidos = 0

    const ids = recetas.map(r => r.id)
    if (ids.length === 0) return

    // Cargar todos los ingredientes con join a alimentos
    const { data: ings } = await supabase
        .from('receta_ingredientes')
        .select('id, nombre_libre, alimento_id, alimento:alimentos(id, nombre)')
        .in('receta_id', ids)

    if (!ings?.length) return

    for (const ing of ings) {
        const nombreAlimento = ing.alimento?.nombre || ''

        // ① Detectar si el alimento matcheado es sospechoso
        const esSospechoso = ALIMENTOS_SOSPECHOSOS_RE.some(re => re.test(nombreAlimento))

        // ② Buscar fix por patrón en nombre_libre
        let fixAplicado = false
        for (const [regex, nuevoId, nuevoNombre] of MATCH_FIXES) {
            if (regex.test(ing.nombre_libre || '')) {
                if (nuevoId && nuevoId !== ing.alimento_id) {
                    process.stdout.write(`   ✏️  "${ing.nombre_libre}" → "${nuevoNombre || nuevoId}"`)
                    if (!DRY_RUN) {
                        await supabase.from('receta_ingredientes')
                            .update({ alimento_id: nuevoId })
                            .eq('id', ing.id)
                        process.stdout.write(' ✅\n')
                        corregidos++
                    } else {
                        process.stdout.write(' [dry-run]\n')
                    }
                    fixAplicado = true
                }
                break
            }
        }

        // ③ Si el alimento es sospechoso y no hay fix → null el alimento_id para que no distorsione macros
        if (!fixAplicado && esSospechoso) {
            process.stdout.write(`   ⚠️  "${ing.nombre_libre}" → alimento sospechoso (${nombreAlimento}) → limpiando match`)
            if (!DRY_RUN) {
                await supabase.from('receta_ingredientes')
                    .update({ alimento_id: null })
                    .eq('id', ing.id)
                process.stdout.write(' ✅\n')
                corregidos++
            } else {
                process.stdout.write(' [dry-run]\n')
            }
        }
    }

    stats.matches += corregidos
    console.log(`   Total corregidos: ${corregidos}`)
}

// ══════════════════════════════════════════════════════════════════════════════
// FASE 3 — FIX CANTIDADES A 100G CON DEEPSEEK
// ══════════════════════════════════════════════════════════════════════════════
const SYSTEM_CANTIDADES = `Eres un chef experto. Dada una receta y su lista de ingredientes, estima las cantidades realistas en gramos para la receta COMPLETA (todas las porciones juntas).
Sé preciso: la sal suele ser 2-5g, los aceites 10-30g, las especias 1-3g, las proteínas 150-400g, las verduras principales 200-500g.
Devuelve SOLO JSON válido: {"ingredientes": [{"nombre": "...", "gramos": 200}]}`

async function fase3_fixCantidades(issues) {
    const recetas100g = issues.todo100g
    if (recetas100g.length === 0) {
        console.log('\n⚖️  FASE 3 — Fix cantidades: nada que corregir')
        return
    }

    console.log(`\n⚖️  FASE 3 — Fix cantidades (${recetas100g.length} recetas con todo a 100g)`)
    if (!DEEPSEEK_KEY) { console.log('   ⚠️  Sin DEEPSEEK_API_KEY, saltando'); return }

    for (const receta of recetas100g) {
        // Cargar ingredientes
        const { data: ings } = await supabase
            .from('receta_ingredientes')
            .select('id, nombre_libre, cantidad_gramos, alimento_id')
            .eq('receta_id', receta.id)

        if (!ings?.length) continue

        const listaIng = ings.map(i => `- ${i.nombre_libre}`).join('\n')
        const userPrompt = `Receta: "${receta.nombre}"
Porciones: ${receta.porciones || 2}
Tipo: ${receta.tipo_plato || 'plato'}

Ingredientes a estimar:
${listaIng}`

        process.stdout.write(`   🧠 "${receta.nombre}" ... `)
        try {
            const resultado = await callDeepSeek(SYSTEM_CANTIDADES, userPrompt, 1024)
            const estimados = resultado.ingredientes || []

            for (const ing of ings) {
                const match = estimados.find(e =>
                    normalizar(e.nombre).includes(normalizar(ing.nombre_libre).split(' ')[0]) ||
                    normalizar(ing.nombre_libre).includes(normalizar(e.nombre).split(' ')[0])
                )
                if (match && match.gramos && match.gramos !== 100 && !DRY_RUN) {
                    await supabase.from('receta_ingredientes')
                        .update({ cantidad_gramos: match.gramos })
                        .eq('id', ing.id)
                }
            }
            console.log(`✅ ${estimados.length} cantidades estimadas`)
            stats.cantidades++
        } catch (err) {
            console.log(`❌ ${err.message}`)
            stats.errores++
        }

        await new Promise(r => setTimeout(r, 1500))
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// FASE 4 — RECALCULAR MACROS
// ══════════════════════════════════════════════════════════════════════════════
async function fase4_recalcularMacros(recetas) {
    console.log('\n🔢 FASE 4 — Recalcular macros')
    const ids = recetas.map(r => r.id)
    if (ids.length === 0) return

    if (DRY_RUN) { console.log('   [dry-run] saltando'); return }

    // Recalcular en lotes de 50
    const LOTE = 50
    let actualizadas = 0
    for (let i = 0; i < ids.length; i += LOTE) {
        const lote = ids.slice(i, i + LOTE)

        // Calcular macros desde ingredientes linkeados
        const { data: ings } = await supabase
            .from('receta_ingredientes')
            .select('receta_id, cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas)')
            .in('receta_id', lote)
            .not('alimento_id', 'is', null)

        if (!ings?.length) continue

        // Agrupar por receta
        const porReceta = {}
        for (const ing of ings) {
            const r = ing.alimento
            if (!r || !r.calorias) continue
            const f = ing.cantidad_gramos / 100
            if (!porReceta[ing.receta_id]) porReceta[ing.receta_id] = { kcal: 0, prot: 0, carbs: 0, grasas: 0 }
            porReceta[ing.receta_id].kcal  += (r.calorias || 0) * f
            porReceta[ing.receta_id].prot  += (r.proteinas || 0) * f
            porReceta[ing.receta_id].carbs += (r.carbohidratos || 0) * f
            porReceta[ing.receta_id].grasas += (r.grasas || 0) * f
        }

        for (const [rid, totales] of Object.entries(porReceta)) {
            const receta = recetas.find(r => r.id === rid)
            const porciones = receta?.porciones || 1
            if (totales.kcal < 1) continue // sin datos útiles

            const { error } = await supabase.from('recetas').update({
                kcal:          Math.round(totales.kcal  / porciones * 10) / 10,
                proteinas:     Math.round(totales.prot  / porciones * 10) / 10,
                carbohidratos: Math.round(totales.carbs / porciones * 10) / 10,
                grasas:        Math.round(totales.grasas / porciones * 10) / 10,
            }).eq('id', rid)

            if (!error) actualizadas++
        }
    }

    stats.macros += actualizadas
    console.log(`   ✅ ${actualizadas} recetas con macros actualizados`)
}

// ══════════════════════════════════════════════════════════════════════════════
// FASE 5 — INTOLERANCIAS AUTOMÁTICAS
// ══════════════════════════════════════════════════════════════════════════════

// Palabras clave por categoría — en minúsculas, sin acentos
const GLUTEN_KW   = ['harina','pan ','pasta','galleta','bizcocho','cerveza','cebada','centeno','semola','espelta','kamut','trigo','bulgur','cuscus']
const LACTOSA_KW  = ['leche','queso','mantequilla','nata ','yogur','crema ','ricotta','mascarpone','kefir','lactozym','requesón']
const HUEVO_KW    = ['huevo','clara','yema']
const FSECOS_KW   = ['almendra','nuez','nueces','anacardo','pistacho','avellana','macadamia','castana','pinon','cacahuete','cacahuetes','frutos secos','tahini','sesamo']
const MARISCO_KW  = ['gamba','langostino','mejillon','almeja','calamar','pulpo','sepia','langosta','buey de mar','bogavante','percebes']
const CARNE_KW    = ['pollo','pechuga','muslo','carne','ternera','cerdo','jamon','bacon','tocino','salchicha','chorizo','morcilla','pavo','pato','conejo','cordero','buey']
const PESCADO_KW  = ['salmon','atun','merluza','bacalao','lubina','dorada','sardina','anchoa','bonito','trucha','rape','lenguado','mero','pez']
const MIEL_KW     = ['miel']
const AZUCAR_KW   = ['azucar','sacarosa','sirope','glucosa','fructosa','miel','mermelada','caramelo','chocolate']

function detectarIntolerancias(ingredientesNombres) {
    const todos = ingredientesNombres.map(n => normalizar(n)).join(' ')
    const tiene = kws => kws.some(k => todos.includes(k))

    const tags = []
    if (!tiene(GLUTEN_KW))  tags.push('Sin Gluten')
    if (!tiene(LACTOSA_KW)) tags.push('Sin Lactosa')
    if (!tiene(HUEVO_KW))   tags.push('Sin Huevo')
    if (!tiene(FSECOS_KW))  tags.push('Sin Frutos Secos')
    if (!tiene(MARISCO_KW)) tags.push('Sin Mariscos')
    if (!tiene(CARNE_KW) && !tiene(PESCADO_KW) && !tiene(MARISCO_KW) && !tiene(HUEVO_KW) && !tiene(LACTOSA_KW) && !tiene(MIEL_KW)) tags.push('Vegano')
    else if (!tiene(CARNE_KW) && !tiene(PESCADO_KW) && !tiene(MARISCO_KW)) tags.push('Vegetariano')
    if (!tiene(AZUCAR_KW)) tags.push('Apto Diabéticos')

    return tags
}

async function fase5_intolerancias(recetas) {
    console.log('\n🌿 FASE 5 — Intolerancias automáticas')

    // Procesar recetas sin intolerancias (null O array vacío)
    const sinTag = recetas.filter(r => !r.intolerancias || r.intolerancias.length === 0)
    if (sinTag.length === 0) { console.log('   ✅ Todas ya tienen intolerancias'); return }

    let actualizadas = 0
    const ids = sinTag.map(r => r.id)

    // Cargar ingredientes de todas a la vez
    const { data: ings } = await supabase
        .from('receta_ingredientes')
        .select('receta_id, nombre_libre, alimento:alimentos(nombre)')
        .in('receta_id', ids)

    // Agrupar nombres por receta
    const nombresPorReceta = {}
    for (const ing of (ings || [])) {
        if (!nombresPorReceta[ing.receta_id]) nombresPorReceta[ing.receta_id] = []
        nombresPorReceta[ing.receta_id].push(ing.alimento?.nombre || ing.nombre_libre || '')
    }

    for (const receta of sinTag) {
        const nombres = nombresPorReceta[receta.id] || []
        if (nombres.length === 0) continue // sin ingredientes linkeados, no se puede inferir

        const tags = detectarIntolerancias(nombres)
        if (tags.length === 0) continue

        process.stdout.write(`   🏷️  "${receta.nombre}" → [${tags.join(', ')}]`)
        if (!DRY_RUN) {
            await supabase.from('recetas').update({ intolerancias: tags }).eq('id', receta.id)
            process.stdout.write(' ✅\n')
            actualizadas++
        } else {
            process.stdout.write(' [dry-run]\n')
        }
    }

    stats.intolerancias += actualizadas
    console.log(`   Total: ${actualizadas} recetas etiquetadas`)
}

// ══════════════════════════════════════════════════════════════════════════════
// FASE 6 — FOTOS FALTANTES
// ══════════════════════════════════════════════════════════════════════════════
const SAFE_NOMBRES = { 'rape': 'monkfish', 'cornflakes': 'cereal flakes' }
function safeName(nombre) {
    let n = nombre.toLowerCase()
    for (const [word, rep] of Object.entries(SAFE_NOMBRES)) {
        if (n.includes(word)) n = n.replace(word, rep)
    }
    return n
}

function buildPromptFoto(receta, ings) {
    const ingredientesStr = ings.slice(0, 5).map(i => i.nombre_libre || i.alimento?.nombre).filter(Boolean).join(', ')
    const nombre = safeName(receta.nombre)
    return `Photo of "${nombre}" taken by a Spanish nutrition coach for Instagram.
${ingredientesStr ? `Main ingredients: ${ingredientesStr}.` : ''}
Home kitchen setting, clean marble or wooden surface, natural window light.
Overhead or slight angle. No text, no watermarks. Square format. Photorealistic.`
}

async function fase6_fotos(recetas) {
    if (SIN_FOTOS) { console.log('\n📷 FASE 6 — Fotos: omitida (--sin-fotos)'); return }
    if (!OPENAI_KEY) { console.log('\n📷 FASE 6 — Fotos: sin OPENAI_API_KEY, saltando'); return }

    const sinFoto = recetas.filter(r => !r.imagen_url)
    if (sinFoto.length === 0) { console.log('\n📷 FASE 6 — Fotos: todas tienen imagen ✅'); return }

    console.log(`\n📷 FASE 6 — Fotos faltantes (${sinFoto.length})`)
    if (DRY_RUN) { sinFoto.forEach(r => console.log(`   • ${r.nombre}`)); return }

    // Cargar ingredientes de las que necesitan foto
    const ids = sinFoto.map(r => r.id)
    const { data: ings } = await supabase.from('receta_ingredientes')
        .select('receta_id, nombre_libre, alimento:alimentos(nombre)')
        .in('receta_id', ids)

    const ingsPorReceta = {}
    for (const i of (ings || [])) {
        if (!ingsPorReceta[i.receta_id]) ingsPorReceta[i.receta_id] = []
        ingsPorReceta[i.receta_id].push(i)
    }

    let ok = 0, errores = 0
    for (const receta of sinFoto) {
        process.stdout.write(`   🖼️  "${receta.nombre}" ... `)
        try {
            const prompt = buildPromptFoto(receta, ingsPorReceta[receta.id] || [])
            const res = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gpt-image-1.5', prompt, n: 1, size: '1024x1024', quality: 'medium', output_format: 'jpeg' }),
                signal: AbortSignal.timeout(120000),
            })
            if (res.status === 429) {
                console.log('⏳ Rate limit, esperando 20s...')
                await new Promise(r => setTimeout(r, 20000))
                continue
            }
            if (!res.ok) throw new Error(`OpenAI ${res.status}`)
            const data = await res.json()
            const b64 = data.data?.[0]?.b64_json
            if (!b64) throw new Error('Respuesta vacía')

            const buffer = Buffer.from(b64, 'base64')
            const path = `${receta.id}/auto_${Date.now()}.jpg`
            const { error: upErr } = await supabase.storage.from('recetas').upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
            if (upErr) throw new Error(upErr.message)

            const { data: { publicUrl } } = supabase.storage.from('recetas').getPublicUrl(path)
            await supabase.from('recetas').update({ imagen_url: publicUrl }).eq('id', receta.id)
            console.log(`✅ ${(buffer.length / 1024).toFixed(0)}KB`)
            ok++
        } catch (err) {
            console.log(`❌ ${err.message}`)
            errores++
        }
        if (sinFoto.indexOf(receta) < sinFoto.length - 1) await new Promise(r => setTimeout(r, 2000))
    }

    stats.fotos += ok
    stats.errores += errores
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
    console.log('\n╔═══════════════════════════════════════════════╗')
    console.log('║   🏆 Pipeline de Calidad — NutriCoach        ║')
    console.log('╚═══════════════════════════════════════════════╝')
    console.log(`   Modo:    ${DRY_RUN ? '🔍 DRY RUN' : '🚀 REAL'}`)
    console.log(`   Alcance: ${SOLO_ID ? `Receta ${SOLO_ID}` : HORAS > 0 ? `Últimas ${HORAS}h` : 'Todas las recetas'}`)
    if (SOLO_FASE) console.log(`   Solo fase: ${SOLO_FASE}`)

    const recetas = await cargarRecetas()
    if (!recetas.length) { console.log('\n✅ No hay recetas que procesar.\n'); return }
    console.log(`\n   📋 ${recetas.length} recetas a procesar\n`)

    const correr = f => !SOLO_FASE || SOLO_FASE === f

    // Fase 1 siempre (detecta issues para las demás fases)
    const issues = await fase1_qualityCheck(recetas)

    if (correr(2)) await fase2_fixMatches(recetas)
    if (correr(3)) await fase3_fixCantidades(issues)
    if (correr(4)) await fase4_recalcularMacros(recetas)
    if (correr(5)) await fase5_intolerancias(recetas)
    if (correr(6)) await fase6_fotos(recetas)

    // ── Resumen final ─────────────────────────────────────────────────────────
    console.log('\n╔═══════════════════════════════════════════════╗')
    console.log('║   RESUMEN                                     ║')
    console.log('╠═══════════════════════════════════════════════╣')
    console.log(`║   🔧 Matches corregidos:    ${String(stats.matches).padEnd(17)}║`)
    console.log(`║   ⚖️  Cantidades estimadas:  ${String(stats.cantidades).padEnd(17)}║`)
    console.log(`║   🔢 Macros recalculados:   ${String(stats.macros).padEnd(17)}║`)
    console.log(`║   🌿 Intolerancias:         ${String(stats.intolerancias).padEnd(17)}║`)
    console.log(`║   📷 Fotos generadas:       ${String(stats.fotos).padEnd(17)}║`)
    console.log(`║   ❌ Errores:               ${String(stats.errores).padEnd(17)}║`)
    console.log('╚═══════════════════════════════════════════════╝\n')

    if (DRY_RUN) console.log('ℹ️  Dry-run: ningún cambio aplicado. Quita --dry-run para ejecutar.\n')
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1) })
