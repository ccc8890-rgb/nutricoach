/**
 * generar-recetas-masivas.mjs  v2
 *
 * Genera recetas nuevas desde cero usando DeepSeek.
 * Pipeline: LLAMADA IA → PARSE → MATCH_FIXES → AUTO-MATCH (con guard) → DB INSERT → FOTO
 *
 * USO:
 *   node scripts/generar-recetas-masivas.mjs              → todas las recetas de la lista
 *   node scripts/generar-recetas-masivas.mjs --limite=10  → solo 10
 *   node scripts/generar-recetas-masivas.mjs --sin-fotos  → sin generar imágenes
 *   node scripts/generar-recetas-masivas.mjs --dry-run    → sin insertar en BD
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────
function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) { console.error('❌ No se encuentra .env.local'); process.exit(1) }
    const content = readFileSync(envPath, 'utf-8')
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
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// ── Flags ──────────────────────────────────────────────
const args = process.argv.slice(2)
const flagLimite = args.find(a => a.startsWith('--limite='))
const LIMITE = flagLimite ? parseInt(flagLimite.split('=')[1], 10) : 999
const SIN_FOTOS = args.includes('--sin-fotos')
const DRY_RUN = args.includes('--dry-run')

const COACH_ID = 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'

// ── MATCH_FIXES: regex → alimento_id correcto ──────────
// Evita que el matching por palabra suelte matchee productos erróneos
const MATCH_FIXES = [
    [/^ajo$/i,                     'bdc11c5a-66bc-4325-bf35-5ab0ba52e3f2', 'Ajo'],
    [/^dientes?\s+de\s+ajo$/i,     'bdc11c5a-66bc-4325-bf35-5ab0ba52e3f2', 'Ajo'],
    [/^ajo picado/i,               '248b631b-30cc-419c-93da-c3c61a56ebfc', 'Ajo Picado'],
    [/^ajo en polvo/i,             'bbece24a-301c-40fe-97d2-81fe63fca922', 'Ajo en polvo'],
    [/^harina$/i,                  '20c74a2a-e6f5-4fd9-8778-39e123d50333', 'Harina de trigo'],
    [/^harina de trig/i,           '20c74a2a-e6f5-4fd9-8778-39e123d50333', 'Harina de trigo'],
    [/^harina de almandr/i,        '23ec40c0-75bf-4e8d-b4d9-a56405a809fb', 'Harina de almendra'],
    [/^harina de avena/i,          '95db3d38-7e2a-47f6-85e6-2d194fa5a907', 'Harina De Avena'],
    [/^sal$/i,                     '0adc820b-8ec6-4888-8c75-91e916531f60', 'Sal'],
    [/^agua$/i,                    'c125af5a-afe3-4ffc-a9d5-185817b6a9db', 'Agua'],
    [/^az[uú]car$/i,               '2c6f1573-16be-4f70-9c75-39c5de606542', 'Azúcar'],
    [/^miel$/i,                    '8619b09f-af3a-4ec4-a11c-f8eace75e90f', 'Miel'],
    [/^cebolla$/i,                 '218607a5-5d7f-4ff6-a24c-869b4019ecb0', 'Cebolla cruda'],
    [/^cebolla\s*(roja|morada)/i,  '08637e90-5e34-4cb3-baa9-b63bbb168f97', 'Cebolla roja'],
    [/^tomate$/i,                  '7f40a393-4f21-4196-bcd6-9c6e9a413532', 'Tomate'],
    [/^tomates?\s+cherry/i,        '59700c20-0241-4499-8c1e-e256a9c59e88', 'Tomates cherry'],
    [/^tomate tritura/i,           '1390b7a4-693d-47c4-9a54-cf03649b8033', 'Tomate triturado'],
    [/^tomate frito/i,             '3b71ee6a-3d66-4a7a-9042-0471b1e96768', 'Tomate frito'],
    [/^salsa de tomate/i,          '1d197cae-57f7-42ab-8b31-4be779410a32', 'Salsa de tomate'],
    [/^aceite de oliva/i,          'bf392211-3527-4c7d-98a5-a2fc0bda8270', 'Aceite de oliva'],
    [/^aceite vegetal/i,           'a5bfb7e7-5e12-4d88-8d2b-e0ffc7df2b04', 'Aceite de girasol'],
    [/^spray.*aceite/i,            'bf392211-3527-4c7d-98a5-a2fc0bda8270', 'Aceite de oliva'],
    [/^zumo de lim/i,              '60ad001e-bb47-44ba-a48f-c8afe9a2e6f2', 'Limón'],
    [/^jugo de lim/i,              '60ad001e-bb47-44ba-a48f-c8afe9a2e6f2', 'Limón'],
    [/^chocolate negro/i,          'ccedb95e-bd69-4b1f-a940-3b5909db3a3d', 'Chocolate negro 85% cacao'],
    [/^salsa de soja/i,            '49357762-14ba-4b73-9fec-b5a9fa37e80a', 'Salsa de soja'],
    [/^salsa ingl/i,               '464ace19-26f8-451c-b7bd-4159b8df63f5', 'Salsa Worcestershire'],
    [/^at[uú]n en lata/i,         '2019b04b-ed3d-41d8-8a04-19780f9c15a5', 'Atún En Lata Al Natural'],
    [/^bebida de avena/i,          '4c7ae3c8-6d68-4d20-ba93-66aaeff9c196', 'Bebida de avena'],
    [/^espinacas baby/i,           'd2291b23-9872-412b-99f4-0ea1f0a75d6a', 'Espinacas baby lavadas'],
    [/^espinacas$/i,               'cb57d667-c292-4fd4-a081-f6d62840a908', 'Espinacas'],
    [/^miso/i,                     '8637e22c-259e-40df-ad22-3e466784ea90', 'Miso blanco'],
]

// ── Categorías NO alimentarias — rechazar en matching ──
const CATEGORIAS_NO_COMESTIBLES = new Set([
    'mascotas', 'higiene', 'limpieza', 'cosmética', 'cosmetica',
    'bebe', 'bebé', 'farmacia', 'dental', 'capilar', 'hogar',
    'electrodomésticos', 'electrodomesticos', 'menaje', 'deporte equip',
])

// Palabras en nombre de alimento que indican no-comestible
const NOMBRE_NO_COMESTIBLE_RE = /\b(gato|perro|mascota|pienso|detergente|limpiador|suavizante|champú|champu|gel de ducha|crema facial|crema hidrat|balsamo|bálsamo|desodorante|compresas|pastillas|medicamento|vitaminas pastil|insecticida|antipolilla|arena gatos?|cama gato|juguete)\b/i

function esAlimentoValido(alimento) {
    if (!alimento) return false
    const catLow = (alimento.categoria || '').toLowerCase()
    if (CATEGORIAS_NO_COMESTIBLES.has(catLow)) return false
    if (NOMBRE_NO_COMESTIBLE_RE.test(alimento.nombre || '')) return false
    // Alimentos con 0 calorías en categorías sospechosas (excepto agua, sal, etc.)
    const nombreLow = (alimento.nombre || '').toLowerCase()
    const esBasico = /^(agua|sal|especias?|vinagre)/.test(nombreLow)
    if (!esBasico && alimento.calorias === 0 && /radler|combinado|energi|isoton/.test(nombreLow)) return false
    return true
}

// ── Palabras genéricas que NO son suficientes para un match ──
const PALABRAS_GENERICAS = new Set(['de', 'con', 'y', 'en', 'al', 'la', 'el', 'lo', 'los', 'las', 'un', 'una'])
function palabrasSignificativas(texto) {
    return texto.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !PALABRAS_GENERICAS.has(w))
}

// ── Normalizar nombre ──────────────────────────────────
function normalizarNombre(nombre) {
    const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' }
    let n = nombre.toLowerCase().trim()
    for (const [k, v] of Object.entries(map)) n = n.replaceAll(k, v)
    if (n.endsWith('es') && n.length > 4) n = n.slice(0, -2)
    else if (n.endsWith('s') && n.length > 3) n = n.slice(0, -1)
    return n
}

// ── Auto-match ingredientes contra DB ─────────────────
async function autoMatchIngredientes(ingredientesRefinados) {
    let matched = 0, unmatched = 0, autoCreados = 0
    const ingredientesDB = []

    for (let idx = 0; idx < ingredientesRefinados.length; idx++) {
        const p = ingredientesRefinados[idx]
        if (!p.nombre_limpio || p.cantidad_gramos <= 0) {
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio || '?', cantidad_gramos: 0, orden: idx })
            unmatched++
            continue
        }

        const nombreBusqueda = p.nombre_limpio.trim()
        let encontrado = null

        // 0. MATCH_FIXES — prioridad absoluta
        for (const [regex, id, nombre] of MATCH_FIXES) {
            if (regex.test(nombreBusqueda)) {
                encontrado = { id, nombre }
                break
            }
        }

        if (!encontrado) {
            // Nivel 1: ilike exacto
            const { data: exacto } = await supabase.from('alimentos')
                .select('id, nombre, categoria, calorias')
                .ilike('nombre', nombreBusqueda)
                .limit(3)
            if (exacto?.length) {
                encontrado = exacto.find(a => esAlimentoValido(a)) || null
            }

            // Nivel 2: búsqueda por palabras significativas (TODAS deben aparecer)
            if (!encontrado) {
                const palabras = palabrasSignificativas(nombreBusqueda)
                if (palabras.length >= 1) {
                    // Buscar por la palabra MÁS LARGA (más específica)
                    const palabraLarga = [...palabras].sort((a, b) => b.length - a.length)[0]
                    const { data: porPalabra } = await supabase.from('alimentos')
                        .select('id, nombre, categoria, calorias')
                        .ilike('nombre', `%${palabraLarga}%`)
                        .limit(10)
                    if (porPalabra?.length) {
                        // Filtrar: el candidato debe contener AL MENOS 2 palabras significativas del ingrediente
                        // (o la única si solo hay una). Evita "ternera" → "Comida gato...ternera"
                        const candidatos = porPalabra.filter(a => {
                            if (!esAlimentoValido(a)) return false
                            const nombreCandidato = a.nombre.toLowerCase()
                            const coincidencias = palabras.filter(p => nombreCandidato.includes(p)).length
                            const umbral = palabras.length > 1 ? 2 : 1
                            return coincidencias >= umbral
                        })
                        if (candidatos.length) {
                            // Elegir el de nombre más corto (el más genérico)
                            encontrado = candidatos.sort((a, b) => a.nombre.length - b.nombre.length)[0]
                        }
                    }
                }
            }

            // Nivel 3: nombre normalizado (singular)
            if (!encontrado) {
                const normalizado = normalizarNombre(nombreBusqueda)
                if (normalizado !== nombreBusqueda.toLowerCase()) {
                    const { data: stem } = await supabase.from('alimentos')
                        .select('id, nombre, categoria, calorias')
                        .ilike('nombre', `%${normalizado}%`)
                        .limit(5)
                    if (stem?.length) {
                        encontrado = stem.find(a => esAlimentoValido(a)) || null
                    }
                }
            }
        }

        if (encontrado) {
            ingredientesDB.push({
                alimento_id: encontrado.id,
                nombre_libre: encontrado.nombre,
                cantidad_gramos: Math.max(p.cantidad_gramos, 1),
                orden: idx
            })
            matched++
        } else if (p.macros_100g && p.cantidad_gramos > 0) {
            // Auto-crear alimento nuevo
            const { data: nuevoAlimento } = await supabase.from('alimentos').insert({
                nombre: p.nombre_limpio,
                calorias: Math.round(p.macros_100g.kcal || 0),
                proteinas: Math.round((p.macros_100g.proteinas || 0) * 10) / 10,
                carbohidratos: Math.round((p.macros_100g.carbohidratos || 0) * 10) / 10,
                grasas: Math.round((p.macros_100g.grasas || 0) * 10) / 10,
                fibra: Math.round((p.macros_100g.fibra || 0) * 10) / 10,
                categoria: 'scrapeado',
                fuente: 'deepseek-ia',
            }).select().single()

            if (nuevoAlimento) {
                ingredientesDB.push({
                    alimento_id: nuevoAlimento.id,
                    nombre_libre: nuevoAlimento.nombre,
                    cantidad_gramos: Math.max(p.cantidad_gramos, 1),
                    orden: idx
                })
                matched++
                autoCreados++
            } else {
                ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: p.cantidad_gramos, orden: idx })
                unmatched++
            }
        } else {
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: p.cantidad_gramos, orden: idx })
            unmatched++
        }
    }
    return { ingredientesDB, matched, unmatched, autoCreados }
}

// ── Calcular macros ────────────────────────────────────
async function calcularMacros(ingredientes, porciones) {
    const ids = ingredientes.filter(i => i.alimento_id).map(i => i.alimento_id)
    if (ids.length === 0) return null

    const { data: alimentos } = await supabase.from('alimentos')
        .select('id, calorias, proteinas, carbohidratos, grasas, fibra')
        .in('id', ids)
    const map = new Map(alimentos?.map(a => [a.id, a]) || [])

    let kcal = 0, proteinas = 0, carbohidratos = 0, grasas = 0, fibra = 0
    for (const ing of ingredientes) {
        if (!ing.alimento_id || !ing.cantidad_gramos) continue
        const al = map.get(ing.alimento_id)
        if (!al) continue
        const factor = ing.cantidad_gramos / 100
        kcal += (al.calorias || 0) * factor
        proteinas += (al.proteinas || 0) * factor
        carbohidratos += (al.carbohidratos || 0) * factor
        grasas += (al.grasas || 0) * factor
        fibra += (al.fibra || 0) * factor
    }
    const p = Math.max(porciones || 1, 1)
    return {
        kcal: Math.round(kcal / p),
        proteinas: Math.round(proteinas / p * 10) / 10,
        carbohidratos: Math.round(carbohidratos / p * 10) / 10,
        grasas: Math.round(grasas / p * 10) / 10,
        fibra: Math.round(fibra / p * 10) / 10,
    }
}

// ── Safe JSON parse ────────────────────────────────────
function safeParseJSON(raw) {
    let str = raw.trim()
    const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlock) str = codeBlock[1].trim()
    const firstBrace = str.indexOf('{')
    const lastBrace = str.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace <= firstBrace) return { error: 'Sin JSON válido' }
    str = str.slice(firstBrace, lastBrace + 1)
    str = str.replace(/,(\s*[\]}])/g, '$1')
    str = str.replace(/\/\/.*?(\n|$)/g, '\n')
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    try { return { data: JSON.parse(str) } } catch (_) {}
    try {
        const result = new Function('return (' + str + ')')()
        if (result && typeof result === 'object') return { data: result }
    } catch (_) {}
    return { error: `JSON inválido: ${raw.slice(0, 150)}` }
}

// ── Normalizar instrucciones → texto con \n ────────────
// DeepSeek a veces devuelve array, a veces string
function normalizarInstrucciones(raw) {
    if (!raw) return ''
    // Si es array, unir con \n
    if (Array.isArray(raw)) {
        return raw
            .map((paso, i) => {
                const texto = typeof paso === 'string' ? paso.trim() : String(paso)
                // Añadir numeración si no la tiene
                if (/^\d+[\.\)]/.test(texto)) return texto
                return `${i + 1}. ${texto}`
            })
            .join('\n')
    }
    // Si ya es string, asegurar que tiene saltos de línea
    if (typeof raw === 'string') {
        // Intentar parsear como JSON array si viene como string "[...]"
        if (raw.trim().startsWith('[')) {
            try {
                const arr = JSON.parse(raw)
                if (Array.isArray(arr)) return normalizarInstrucciones(arr)
            } catch (_) {}
        }
        return raw.trim()
    }
    return String(raw)
}

// ── Llamar a DeepSeek para generar receta ──────────────
async function generarRecetaConIA(receta, intento = 1) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const systemPrompt = `Eres un nutricionista y chef experto en cocina mediterránea española. Creas recetas saludables, equilibradas y deliciosas.

NORMAS OBLIGATORIAS:
1. IDIOMA: Todo en español.
2. MEDIDAS: Sistema métrico, gramos o ml. Cantidades realistas por porción.
3. INSTRUCCIONES: String de texto con pasos numerados separados por \\n. NUNCA un array. Ejemplo: "1. Precalienta el horno a 200°C.\\n2. Pela y corta las patatas en rodajas.\\n3. Hornea 25 minutos."
4. INGREDIENTES: Nombres en español, singular. Nombres genéricos (ej: "pechuga de pollo", "arroz", "cebolla"). NUNCA nombres de marca.
5. CANTIDADES: Realistas y proporcionales al número de porciones. Condimentos máx 20g, especias máx 5g.
6. Cada ingrediente DEBE tener cantidad_gramos > 0.
7. No incluyas ingredientes decorativos opcionales.
8. MACROS/100g: Estimados según BEDCA/USDA para ingredientes genéricos.
9. No uses vino, cerveza ni alcohol en recetas de desayuno o merienda.

Devuelve ÚNICAMENTE JSON válido sin markdown, sin texto extra, sin comas finales.`

    const userPrompt = `Genera la receta saludable:

NOMBRE: "${receta.nombre}"
TIPO: ${receta.tipo_plato}
DIFICULTAD: ${receta.dificultad}
PORCIONES: ${receta.porciones}
TIEMPO PREP: ${receta.tiempo_prep} min
TIEMPO COCCIÓN: ${receta.tiempo_coccion} min

JSON con campos:
- nombre (string)
- descripcion (string, 1-2 frases)
- instrucciones (STRING con saltos de línea \\n, NUNCA array)
- porciones (número)
- tiempo_prep_min (número)
- tiempo_coccion_min (número)
- ingredientes (array de objetos con: nombre_limpio, cantidad_gramos, macros_100g)
- macros_por_porcion (objeto con: kcal, proteinas, carbohidratos, grasas, fibra)`

    const body = {
        model: DEEPSEEK_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: intento === 1 ? 0.3 : 0.5,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
    }

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const err = await response.text()
        if (intento === 1 && [400, 422].includes(response.status)) {
            delete body.response_format
            const r2 = await fetch(DEEPSEEK_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) })
            if (!r2.ok) throw new Error(`DeepSeek ${r2.status}`)
            const d2 = await r2.json()
            return procesarRespuesta(d2, receta, intento)
        }
        throw new Error(`DeepSeek ${response.status}: ${err.slice(0, 100)}`)
    }

    const data = await response.json()
    return procesarRespuesta(data, receta, intento)
}

async function procesarRespuesta(data, receta, intento) {
    const content = data.choices?.[0]?.message?.content
    if (!content?.trim()) {
        if (intento < 2) { await delay(2000); return generarRecetaConIA(receta, intento + 1) }
        throw new Error('Respuesta vacía')
    }

    const result = safeParseJSON(content)
    if (result.error) {
        if (intento < 2) { await delay(2000); return generarRecetaConIA(receta, intento + 1) }
        throw new Error(result.error)
    }

    const parsed = result.data
    if (!parsed.nombre || !parsed.ingredientes?.length) {
        if (intento < 2) { await delay(2000); return generarRecetaConIA(receta, intento + 1) }
        throw new Error('JSON incompleto')
    }

    // Normalizar instrucciones a string
    parsed.instrucciones = normalizarInstrucciones(parsed.instrucciones)

    // Filtrar ingredientes inválidos
    parsed.ingredientes = parsed.ingredientes.filter(i =>
        i.cantidad_gramos > 0 && i.nombre_limpio?.length > 1
    )

    if (parsed.ingredientes.length < 2) {
        if (intento < 2) { await delay(2000); return generarRecetaConIA(receta, intento + 1) }
        throw new Error('Menos de 2 ingredientes válidos')
    }

    return { data: parsed, total_tokens: data.usage?.total_tokens || 0 }
}

// ── Generar foto food blogger ──────────────────────────
async function generarFoto(receta, nombre, ingredientesPrincipales) {
    if (!OPENAI_API_KEY) return null

    const ingredsList = ingredientesPrincipales.slice(0, 5).join(', ')
    const tipoPlatoES = receta.tipo_plato.toLowerCase()

    const prompt = `Photorealistic food photo of "${nombre}". Key ingredients: ${ingredsList}.
Style: Spanish nutrition coach food blog — personal aesthetic.
Natural window light, soft and diffused. Ceramic plate or rustic bowl, wooden kitchen surface.
Slightly imperfect home plating, warm Mediterranean tones. Appetizing and fresh.
Shot on Sony mirrorless camera, shallow depth of field. Square 1:1 format.
No text, no watermarks, no hands, no people, no logos.`

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt,
                size: '1024x1024',
                quality: 'medium',
                n: 1,
            }),
        })

        if (!response.ok) {
            const err = await response.text()
            console.log(`  ⚠️  Foto: ${response.status} — ${err.slice(0, 80)}`)
            return null
        }

        const data = await response.json()
        const b64 = data.data?.[0]?.b64_json
        if (!b64) return null

        // Convertir base64 a Buffer
        const imgBuffer = Buffer.from(b64, 'base64')
        return imgBuffer
    } catch (err) {
        console.log(`  ⚠️  Error foto: ${err.message?.slice(0, 60)}`)
        return null
    }
}

async function subirFotoCloudinary(imgBuffer, recetaId) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) return null

    try {
        const { createHash } = await import('crypto')
        const timestamp = Math.floor(Date.now() / 1000)
        const publicId = `nutricoach/recetas/${recetaId}`
        const toSign = `format=webp&public_id=${publicId}&timestamp=${timestamp}&transformation=q_auto:good${apiSecret}`
        const signature = createHash('sha1').update(toSign).digest('hex')

        const formData = new FormData()
        const blob = new Blob([imgBuffer], { type: 'image/png' })
        formData.append('file', blob, `${recetaId}.png`)
        formData.append('public_id', publicId)
        formData.append('format', 'webp')
        formData.append('transformation', 'q_auto:good')
        formData.append('timestamp', timestamp.toString())
        formData.append('api_key', apiKey)
        formData.append('signature', signature)

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) return null
        const data = await response.json()
        return data.secure_url || null
    } catch (err) {
        console.log(`  ⚠️  Error Cloudinary: ${err.message?.slice(0, 60)}`)
        return null
    }
}

// ── Insertar receta en BD ──────────────────────────────
async function insertarReceta(recetaPlan, dataIA, ingredientesDB) {
    const macros = await calcularMacros(ingredientesDB, dataIA.porciones || recetaPlan.porciones || 1)

    const { data: nueva, error } = await supabase.from('recetas').insert({
        nombre: dataIA.nombre || recetaPlan.nombre,
        descripcion: dataIA.descripcion || null,
        instrucciones: dataIA.instrucciones,
        porciones: dataIA.porciones || recetaPlan.porciones,
        tiempo_prep_min: dataIA.tiempo_prep_min || recetaPlan.tiempo_prep,
        tiempo_coccion_min: dataIA.tiempo_coccion_min || recetaPlan.tiempo_coccion,
        categoria: recetaPlan.categoria,
        tipo_plato: recetaPlan.tipo_plato,
        dificultad: recetaPlan.dificultad,
        estado: 'aprobada',
        fuente: 'ia-generada',
        fuente_tipo: 'ia_generada',
        coach_id: COACH_ID,
        notas_coach: 'Generada por DeepSeek v2. Revisar macros e imagen antes de usar con clientes.',
        kcal: macros?.kcal ?? null,
        proteinas: macros?.proteinas ?? null,
        carbohidratos: macros?.carbohidratos ?? null,
        grasas: macros?.grasas ?? null,
        fibra: macros?.fibra ?? null,
    }).select('id').single()

    if (error) throw new Error(`Insert receta: ${error.message}`)

    if (ingredientesDB.length > 0) {
        const inserts = ingredientesDB.map((ing, i) => ({
            receta_id: nueva.id,
            alimento_id: ing.alimento_id,
            nombre_libre: ing.nombre_libre,
            cantidad_gramos: ing.cantidad_gramos,
            orden: ing.orden ?? i,
        }))
        const { error: ingErr } = await supabase.from('receta_ingredientes').insert(inserts)
        if (ingErr) {
            await supabase.from('recetas').delete().eq('id', nueva.id)
            throw new Error(`Insert ingredientes: ${ingErr.message}`)
        }
    }

    return nueva.id
}

const delay = ms => new Promise(r => setTimeout(r, ms))

// ── Procesar una receta ────────────────────────────────
async function procesarReceta(receta, index, total) {
    const t0 = Date.now()
    try {
        // 1. Generar con IA
        const { data, total_tokens } = await generarRecetaConIA(receta)

        // 2. Match ingredientes (con guard)
        const match = await autoMatchIngredientes(data.ingredientes)

        // 3. Insertar en BD (o dry-run)
        let recetaId = null
        if (!DRY_RUN) {
            recetaId = await insertarReceta(receta, data, match.ingredientesDB)
        } else {
            recetaId = `dry-${index}`
        }

        // 4. Generar foto
        let imagenUrl = null
        if (!SIN_FOTOS && !DRY_RUN && recetaId && OPENAI_API_KEY) {
            const ingredientesPrincipales = match.ingredientesDB
                .filter(i => i.nombre_libre && i.cantidad_gramos > 20)
                .map(i => i.nombre_libre)
            const imgBuffer = await generarFoto(receta, data.nombre, ingredientesPrincipales)
            if (imgBuffer) {
                imagenUrl = await subirFotoCloudinary(imgBuffer, recetaId)
                if (imagenUrl) {
                    await supabase.from('recetas').update({ imagen_url: imagenUrl }).eq('id', recetaId)
                }
            }
        }

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
        const fotoIcon = imagenUrl ? '📷' : (SIN_FOTOS ? '⏭️' : '🚫')
        console.log(`✅ [${index}/${total}] ${data.nombre.slice(0, 48).padEnd(50)} ${match.matched}✓ ${match.unmatched}✗ ${fotoIcon} ${total_tokens}tok ${elapsed}s`)
        return { ok: true, nombre: data.nombre, id: recetaId, tokens: total_tokens }

    } catch (err) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
        console.log(`❌ [${index}/${total}] ${receta.nombre.slice(0, 48).padEnd(50)} ${(err.message || '').slice(0, 50)} ${elapsed}s`)
        return { ok: false, nombre: receta.nombre, error: err.message || '' }
    }
}

// ═══════════════════════════════════════════════════════
// LISTA DE RECETAS A GENERAR — healthy, mediterráneas, variadas
// ═══════════════════════════════════════════════════════
const RECETAS_A_GENERAR = [

    // ══════════════════════════════════
    // DESAYUNOS — variados y nutritivos
    // ══════════════════════════════════
    { nombre: 'Overnight oats de plátano y mantequilla de almendra', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Chia pudding de coco con mango y lima', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Tostada de aguacate con huevo escalfado y semillas', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 5 },
    { nombre: 'Tortitas de avena y plátano sin harina', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Yogur griego con granada fresca y nueces', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 3, tiempo_coccion: 0 },
    { nombre: 'Granola casera con frutos secos y semillas', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 6, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Açaí bowl con frutas del bosque y coco', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Crepes proteicos de claras y avena con fresas', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Tostada integral con queso fresco y tomate en rodajas', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 2 },
    { nombre: 'Huevos revueltos con espinacas y jamón serrano', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Tortilla francesa proteica con queso y champiñones', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 6 },
    { nombre: 'Tostadas con salmón ahumado y queso fresco', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Bowl salado de quinoa con huevo y aguacate', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Scrambled eggs con pimiento verde y cebolla', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Shakshuka ligera con tomate y pimiento', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'media', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Porridge de avena con manzana y canela', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 2, tiempo_coccion: 8 },
    { nombre: 'Tosta de pan de centeno con atún y pepino', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Smoothie bowl de espinacas y piña con toppings', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },

    // ══════════════════════════════════
    // COMIDAS — equilibradas y variadas
    // ══════════════════════════════════
    { nombre: 'Buddha bowl mediterráneo con garbanzos asados y tahini', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 1, tiempo_prep: 15, tiempo_coccion: 20 },
    { nombre: 'Ensalada niçoise con atún fresco y judías verdes', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 10 },
    { nombre: 'Poke bowl de salmón con arroz integral y aguacate', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 1, tiempo_prep: 15, tiempo_coccion: 20 },
    { nombre: 'Wok de pollo con brócoli y salsa de soja', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Bowl de quinoa con langostinos y mango', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 15 },
    { nombre: 'Gazpacho andaluz con jamón ibérico', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 0 },
    { nombre: 'Salmorejo cordobés con huevo duro y cebollino', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 10 },
    { nombre: 'Arroz caldoso con rape y gambas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Arroz a banda con alioli casero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 35 },
    { nombre: 'Fideuà de pescado y marisco valenciana', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Pasta integral con atún y tomate casero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Espaguetis con gambas al ajillo y perejil', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Macarrones con carne picada y tomate casero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Lentejas estofadas con chorizo y verduras', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 40 },
    { nombre: 'Potaje de garbanzos con espinacas y bacalao', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 35 },
    { nombre: 'Guiso de lentejas rojas con cúrcuma y leche de coco', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Muslos de pollo al horno con patatas panaderas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 15, tiempo_coccion: 45 },
    { nombre: 'Dorada al horno con verduras mediterráneas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Estofado de ternera con patatas y zanahorias', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 4, tiempo_prep: 20, tiempo_coccion: 70 },
    { nombre: 'Pollo en pepitoria con almendras y azafrán', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 20, tiempo_coccion: 40 },
    { nombre: 'Hummus casero con crudités y pan de pita integral', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Ensalada completa de pollo a la plancha con aguacate', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 10 },
    { nombre: 'Arroz negro con sepia y alioli', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Risotto de espárragos trigueros y parmesano', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },

    // ══════════════════════════════════
    // CENAS — ligeras y proteicas
    // ══════════════════════════════════
    { nombre: 'Crema de calabaza asada con semillas de calabaza', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 4, tiempo_prep: 10, tiempo_coccion: 35 },
    { nombre: 'Salmón al horno con espárragos y limón', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 18 },
    { nombre: 'Pollo al limón con brócoli al vapor', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Merluza al horno con pisto de verduras', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Sepia a la plancha con alioli y perejil', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Bacalao al pil pil con pimientos asados', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 20 },
    { nombre: 'Gambas al ajillo con limón y pan integral', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Atún a la plancha con ensalada de tomate y aceitunas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 6 },
    { nombre: 'Dorada a la sal con patatas al vapor', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 35 },
    { nombre: 'Lubina a la plancha con salsa verde de perejil', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 12 },
    { nombre: 'Revuelto de espárragos trigueros con gambas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Pechuga de pavo al horno con limón y hierbas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Filete de ternera a la plancha con espinacas salteadas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Tortilla española de patata con cebolla', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 4, tiempo_prep: 20, tiempo_coccion: 15 },
    { nombre: 'Pisto manchego con huevos al plato', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Crema de brócoli con queso fresco y almendras', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Frittata de verduras al horno con queso feta', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 20 },
    { nombre: 'Coliflor asada con salsa de yogur y especias', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 30 },
    { nombre: 'Sopa de tomate asado con albahaca y huevo pochado', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Albóndigas de pavo en salsa de champiñones', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 3, tiempo_prep: 20, tiempo_coccion: 25 },
    { nombre: 'Champiñones rellenos de atún y queso gratinados', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 15 },
    { nombre: 'Pollo a la plancha con ensalada de rúcula y parmesano', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 12 },
    { nombre: 'Ensalada de espinacas con salmón ahumado y nueces', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Caldo de pollo casero con verduras y fideos', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 40 },
    { nombre: 'Espinacas salteadas con huevo y jamón ibérico', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Boquerones al horno con ajo y limón', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Caballa al horno con tomate y orégano', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Pulpo a la gallega con pimentón ahumado', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 5, tiempo_coccion: 45 },
    { nombre: 'Mejillones al vapor con salsa de tomate casera', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 12 },
    { nombre: 'Lomo de cerdo a la plancha con manzana y mostaza', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Verduras asadas al horno con hummus y pan integral', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 30 },

    // ══════════════════════════════════
    // MERIENDAS — nutritivas
    // ══════════════════════════════════
    { nombre: 'Tostada de pan de centeno con mantequilla de almendra y plátano', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 3, tiempo_coccion: 0 },
    { nombre: 'Queso fresco con higos frescos y nueces', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Mini tortilla de claras con espinacas', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Dátiles rellenos de almendra y chocolate negro', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 5 },
    { nombre: 'Arroz con leche de avena y canela sin azúcar', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 25 },
]

// ── Main ───────────────────────────────────────────────
async function main() {
    console.log('')
    console.log('╔═══════════════════════════════════════════════════════╗')
    console.log('║   🍳 GENERACIÓN MASIVA DE RECETAS v2 — NutriCoach   ║')
    console.log('╚═══════════════════════════════════════════════════════╝')
    if (DRY_RUN) console.log('  ⚠️  DRY-RUN: no se insertará nada en BD')
    if (SIN_FOTOS) console.log('  ⚠️  Sin generación de fotos')
    console.log('')

    const { count: recetasActuales } = await supabase.from('recetas').select('*', { count: 'exact', head: true })
    console.log(`📊 Recetas en BD: ${recetasActuales}`)

    const { data: existentes } = await supabase.from('recetas').select('nombre')
    const nombresExistentes = new Set(existentes?.map(r => r.nombre.toLowerCase().trim()) || [])

    const nuevas = RECETAS_A_GENERAR.filter(r => !nombresExistentes.has(r.nombre.toLowerCase().trim()))
    const omitidas = RECETAS_A_GENERAR.length - nuevas.length
    if (omitidas > 0) console.log(`⚠️  ${omitidas} ya existen, omitidas`)

    const aProcesar = nuevas.slice(0, LIMITE)
    console.log(`🚀 Generando ${aProcesar.length} recetas nuevas...`)
    console.log('')

    const MAX_CONCURRENT = 2 // Reducido a 2 para evitar rate limits
    let ok = 0, failed = 0, totalTokens = 0
    const t0 = Date.now()

    for (let i = 0; i < aProcesar.length; i += MAX_CONCURRENT) {
        const batch = aProcesar.slice(i, i + MAX_CONCURRENT)
        const results = await Promise.all(
            batch.map((r, idx) => procesarReceta(r, i + idx + 1, aProcesar.length))
        )
        for (const result of results) {
            if (result.ok) { ok++; totalTokens += result.tokens || 0 }
            else failed++
        }
        if (i + MAX_CONCURRENT < aProcesar.length) await delay(800)
    }

    const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1)
    const { count: recetasFinales } = await supabase.from('recetas').select('*', { count: 'exact', head: true })

    console.log('')
    console.log('╔══════════════════════════════════════════╗')
    console.log('║   📊 RESUMEN                            ║')
    console.log('╚══════════════════════════════════════════╝')
    console.log(`  Recetas antes:  ${recetasActuales}`)
    console.log(`  Recetas después: ${recetasFinales}`)
    console.log(`  ✅ Creadas:      ${ok}`)
    console.log(`  ❌ Fallos:       ${failed}`)
    console.log(`  📊 Tokens:       ${totalTokens}`)
    console.log(`  ⏱️  Tiempo:       ${elapsed} min`)
    console.log(`  💰 Coste aprox:  ~$${(totalTokens * 0.00000075).toFixed(4)}`)
    console.log('')
}

main().catch(err => { console.error('Error:', err); process.exit(1) })
