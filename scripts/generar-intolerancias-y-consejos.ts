/**
 * generar-intolerancias-y-consejos.ts
 *
 * FASE 1: Deduce intolerancias de cada receta desde sus ingredientes
 *          (local, sin llamadas a API — se basa en keywords de alimentos)
 *
 * FASE 2: Genera consejos_preparacion, notas_coach y video_url
 *          vía DeepSeek (batch) para recetas que faltan.
 *
 * USO: npx tsx scripts/generar-intolerancias-y-consejos.ts
 * USO (solo intolerancias): INTOLERANCIAS=true npx tsx scripts/generar-intolerancias-y-consejos.ts
 * USO (solo consejos): CONSEJOS=true npx tsx scripts/generar-intolerancias-y-consejos.ts
 * USO (dry-run): DRY_RUN=true npx tsx scripts/generar-intolerancias-y-consejos.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ──────────────────────────────────────────────────────
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const BATCH_SIZE = parseInt(process.env.BATCH || '10', 10)
const DRY_RUN = process.env.DRY_RUN === 'true'
const SOLO_INTOLERANCIAS = process.env.INTOLERANCIAS === 'true'
const SOLO_CONSEJOS = process.env.CONSEJOS === 'true'
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '120', 10) * 1000

// ─── Load env ────────────────────────────────────────────────────
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

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

// ─── Palabras clave para intolerancias ───────────────────────────
// Basado en nombres de alimentos de la tabla 'alimentos' (8118 rows)
const KEYWORDS = {
    SIN_GLUTEN: [
        // Harinas y cereales con gluten
        'harina de trigo', 'harina de espelta', 'harina de centeno', 'harina de cebada',
        'trigo', 'espelta', 'centeno', 'cebada',
        'pan de molde', 'pan integral', 'pan blanco', 'pan de centeno', 'pan tostado',
        'pasta', 'espagueti', 'macarrón', 'fideos', 'tallarín', 'canelón', 'lasaña',
        'galleta', 'magdalena', 'bizcocho', 'croissant', 'donut', 'muffin',
        'pizza', 'masa de pizza', 'empanada', 'empanadilla',
        'seitán', 'gluten', 'sémola', 'cous-cous', 'cuscús',
        'cerveza',
        'pan rallado', 'pan de hamburguesa', 'pan de perrito',
        'pretzel', 'bagel', 'brioche', 'churro', 'berlin',
    ],
    SIN_LACTOSA: [
        // Lácteos
        'leche', 'leche entera', 'leche semidesnatada', 'leche desnatada', 'leche evaporada',
        'queso', 'queso fresco', 'queso cottage', 'queso ricotta', 'queso crema',
        'queso mozzarella', 'queso cheddar', 'queso parmesano', 'queso suizo',
        'queso de cabra', 'queso azul', 'queso manchego', 'queso gouda',
        'yogur', 'yogur natural', 'yogur griego', 'yogur de frutas',
        'nata', 'crema de leche', 'crema para cocinar', 'crema agria',
        'lactosa', 'suero de leche', 'requesón',
        'mantequilla', 'mantequilla clarificada', 'ghee',
        'batido de leche', 'helado de leche', 'natillas',
        'cuajada', 'kéfir de leche',
    ],
    SIN_HUEVO: [
        'huevo', 'huevo entero', 'clara de huevo', 'yema de huevo',
        'huevo cocido', 'huevo frito', 'huevo revuelto', 'huevo poché',
        'mayonesa', 'mahonesa', 'tortilla',
        'merengue', 'suflé', 'crema pastelera',
        'huevo en polvo', 'albúmina',
    ],
    SIN_FRUTOS_SECOS: [
        'almendra', 'nuez', 'avellana', 'cacahuete', 'pistacho', 'anacardo',
        'piñón', 'nuez de macadamia', 'nuez pecana', 'nuez pecan',
        'crema de cacahuete', 'mantequilla de cacahuete', 'mantequilla de almendra',
        'leche de almendra', 'harina de almendra',
        'fruto seco', 'frutos secos', 'mix de frutos secos',
        'turrón', 'mazapán', 'nogada', 'pesto',
    ],
    VEGANO: [] as string[],  // Se rellena en detección
    VEGETARIANO: [] as string[],  // Se rellena en detección
}

// Para vegano/vegetariano, detectamos ingredientes de origen animal
const ANIMAL_KEYWORDS = [
    'pollo', 'pechuga de pollo', 'ala de pollo', 'muslo de pollo', 'contramuslo de pollo',
    'pavo', 'pechuga de pavo', 'pierna de pavo',
    'ternera', 'carne picada', 'carne de vacuno', 'vaca', 'buey',
    'cerdo', 'lomo de cerdo', 'solomillo de cerdo', 'costilla de cerdo',
    'cordero', 'conejo',
    'jamón', 'jamón serrano', 'jamón cocido', 'jamon', 'lacón',
    'chorizo', 'salchicha', 'salchichón', 'butifarra', 'fuet',
    'tocino', 'panceta', 'bacón', 'bacon',
    'pescado', 'salmón', 'atún', 'merluza', 'bacalao', 'lubina', 'dorada',
    'rape', 'rodabajo', 'trucha', 'sardina', 'boquerón', 'anchoa',
    'gamba', 'langostino', 'camarón', 'calamar', 'pulpo', 'mejillón',
    'almeja', 'berberecho', 'vieira', 'navaja',
    'huevo', 'clara de huevo',
    'leche', 'queso', 'yogur', 'nata', 'requesón', 'mantequilla',
    'miel',
    'sobrasada', 'mortadela', 'pastrami',
]

// ─── Normalizar texto ────────────────────────────────────────────
function normalizar(n: string): string {
    return n
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

// ─── FASE 1: Deducir intolerancias ──────────────────────────────
interface IntoleranciaSet {
    sinGluten: boolean
    sinLactosa: boolean
    sinHuevo: boolean
    sinFrutosSecos: boolean
    vegano: boolean
    vegetariano: boolean
}

function detectarIntoleranciasPorNombre(nombreNormalizado: string): Partial<IntoleranciaSet> {
    const result: Partial<IntoleranciaSet> = {}

    // Sin Gluten
    if (KEYWORDS.SIN_GLUTEN.some(kw => nombreNormalizado.includes(kw))) {
        result.sinGluten = false
    }

    // Sin Lactosa
    if (KEYWORDS.SIN_LACTOSA.some(kw => nombreNormalizado.includes(kw))) {
        result.sinLactosa = false
    }

    // Sin Huevo
    if (KEYWORDS.SIN_HUEVO.some(kw => nombreNormalizado.includes(kw))) {
        result.sinHuevo = false
    }

    // Sin Frutos Secos
    if (KEYWORDS.SIN_FRUTOS_SECOS.some(kw => nombreNormalizado.includes(kw))) {
        result.sinFrutosSecos = false
    }

    // Origen animal (para vegano/vegetariano)
    const esAnimal = ANIMAL_KEYWORDS.some(kw => nombreNormalizado.includes(kw))
    if (esAnimal) {
        result.vegano = false
        result.vegetariano = false
    }

    return result
}

function combinarDetecciones(resultados: Partial<IntoleranciaSet>[]): string[] {
    const final: IntoleranciaSet = {
        sinGluten: true,
        sinLactosa: true,
        sinHuevo: true,
        sinFrutosSecos: true,
        vegano: true,
        vegetariano: true,
    }

    for (const r of resultados) {
        if (r.sinGluten === false) final.sinGluten = false
        if (r.sinLactosa === false) final.sinLactosa = false
        if (r.sinHuevo === false) final.sinHuevo = false
        if (r.sinFrutosSecos === false) final.sinFrutosSecos = false
        if (r.vegano === false) final.vegano = false
        if (r.vegetariano === false) final.vegetariano = false
    }

    // Construir array
    const tags: string[] = []

    // Si es vegano, ya implica vegetariano y excluye productos animales
    if (!final.vegano) {
        // Tiene ingredientes animales -> no vegano, no vegetariano (si tiene carne/pescado)
        // Pero podría ser vegetariano si solo tiene lácteos/huevo
        // Tenemos que distinguir: si tiene carne/pescado -> no vegetariano
        // Si solo tiene lácteos/huevo -> vegetariano sí, vegano no
        // Esto lo manejamos mejor revisando las detecciones individuales

        // Check if ANY ingredient was meat/fish (not just dairy/eggs)
        const tuvoCarne = resultados.some(r => r.vegano === false && r.vegetariano === false)
        if (tuvoCarne) {
            final.vegetariano = false
        }
        // Si SOLO tuvo lácteos/huevo pero no carne, vegetariano sigue siendo true
    }

    if (!final.sinGluten) tags.push('Sin Gluten')
    if (!final.sinLactosa) tags.push('Sin Lactosa')
    if (!final.sinHuevo) tags.push('Sin Huevo')
    if (!final.sinFrutosSecos) tags.push('Sin Frutos Secos')
    if (final.vegano) tags.push('Vegano')
    if (final.vegetariano) tags.push('Vegetariano')

    return tags
}

// ─── FASE 1: Main ────────────────────────────────────────────────
async function faseIntolerancias() {
    console.log('\n📋 FASE 1: DEDUCIR INTOLERANCIAS DESDE INGREDIENTES\n')

    // Cargar todas las recetas con sus ingredientes
    const { data: recetas } = await supabase.from('recetas').select('id, nombre, intolerancias')
    if (!recetas) { console.log('❌ No se pudieron cargar recetas'); return }

    // Cargar todos los ingredientes con alimento_id
    const { data: ingredientes } = await supabase
        .from('receta_ingredientes')
        .select('receta_id, alimento_id, nombre_libre')

    if (!ingredientes) { console.log('❌ No se pudieron cargar ingredientes'); return }

    // Cargar alimentos para tener los nombres
    let alimentos: any[] = []
    let from = 0
    const limit = 1000
    while (true) {
        const { data } = await supabase.from('alimentos').select('id, nombre').range(from, from + limit - 1)
        if (!data || data.length === 0) break
        alimentos = alimentos.concat(data)
        from += limit
        if (data.length < limit) break
    }
    const alimentosMap = new Map(alimentos.map(a => [a.id, a.nombre]))

    // Agrupar ingredientes por receta
    const ingsPorReceta = new Map<string, { alimento_id: string | null; nombre_libre: string | null }[]>()
    for (const ing of ingredientes) {
        if (!ingsPorReceta.has(ing.receta_id)) {
            ingsPorReceta.set(ing.receta_id, [])
        }
        ingsPorReceta.get(ing.receta_id)!.push(ing)
    }

    let actualizados = 0
    let saltados = 0

    for (const receta of recetas) {
        // Saltar si ya tiene intolerancias
        if (receta.intolerancias && Array.isArray(receta.intolerancias) && receta.intolerancias.length > 0) {
            saltados++
            continue
        }

        const ings = ingsPorReceta.get(receta.id) || []
        if (ings.length === 0) {
            saltados++
            continue
        }

        // Analizar cada ingrediente
        const detecciones: Partial<IntoleranciaSet>[] = []
        let tuvoCarne = false
        let tuvoLacteoOHuevo = false
        let tuvoVegetal = false

        for (const ing of ings) {
            const nombreAlimento = ing.alimento_id ? alimentosMap.get(ing.alimento_id) : null
            const nombreAnalizar = normalizar(nombreAlimento || ing.nombre_libre || '')

            if (!nombreAnalizar) continue

            const det = detectarIntoleranciasPorNombre(nombreAnalizar)
            detecciones.push(det)

            // Track qué tipo de ingrediente es
            const esCarnePescado = ANIMAL_KEYWORDS.slice(0, 45).some(kw => nombreAnalizar.includes(kw))
            const esLacteo = KEYWORDS.SIN_LACTOSA.some(kw => nombreAnalizar.includes(kw))
            const esHuevo = KEYWORDS.SIN_HUEVO.some(kw => nombreAnalizar.includes(kw))

            if (esCarnePescado) tuvoCarne = true
            if (esLacteo || esHuevo) tuvoLacteoOHuevo = true
            if (!esCarnePescado && !esLacteo && !esHuevo) tuvoVegetal = true
        }

        // Determinar intolerancias
        const tags: string[] = []

        // Sin Gluten: si ningún ingrediente contiene gluten
        const tieneGluten = detecciones.some(d => d.sinGluten === false)
        if (!tieneGluten) tags.push('Sin Gluten')

        // Sin Lactosa: si ningún ingrediente es lácteo
        const tieneLactosa = detecciones.some(d => d.sinLactosa === false)
        if (!tieneLactosa) tags.push('Sin Lactosa')

        // Sin Huevo: si ningún ingrediente es huevo
        const tieneHuevo = detecciones.some(d => d.sinHuevo === false)
        if (!tieneHuevo) tags.push('Sin Huevo')

        // Sin Frutos Secos: si ningún ingrediente es fruto seco
        const tieneFrutosSecos = detecciones.some(d => d.sinFrutosSecos === false)
        if (!tieneFrutosSecos) tags.push('Sin Frutos Secos')

        // Vegano: si no tiene ningún ingrediente animal
        if (!tuvoCarne && !tuvoLacteoOHuevo && !receta.nombre.toLowerCase().includes('miel')) {
            tags.push('Vegano')
        }

        // Vegetariano: si no tiene carne/pescado
        if (!tuvoCarne) {
            tags.push('Vegetariano')
        }

        if (tags.length === 0) {
            saltados++
            continue
        }

        // Actualizar en DB
        if (!DRY_RUN) {
            const { error } = await supabase
                .from('recetas')
                .update({ intolerancias: tags })
                .eq('id', receta.id)

            if (error) {
                console.log(`  ❌ Error actualizando ${receta.nombre.substring(0, 40)}: ${error.message}`)
                continue
            }
        }

        actualizados++
        if (actualizados <= 10 || actualizados % 20 === 0) {
            console.log(`  ✅ [${actualizados}] ${receta.nombre.substring(0, 40).padEnd(42)} → [${tags.join(', ')}]`)
        }
    }

    console.log(`\n  📊 Intolerancias: ${actualizados} actualizadas, ${saltados} saltadas`)
}

// ─── FASE 2: Generar consejos con DeepSeek ──────────────────────
function extraerJSON(texto: string): string {
    let limpio = texto.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '')
    const arrIdx = limpio.indexOf('[')
    const objIdx = limpio.indexOf('{')
    if (arrIdx >= 0 && (objIdx < 0 || arrIdx < objIdx)) {
        limpio = limpio.substring(arrIdx)
    } else if (objIdx >= 0) {
        limpio = limpio.substring(objIdx)
    }
    const lastArr = limpio.lastIndexOf(']')
    const lastObj = limpio.lastIndexOf('}')
    if (lastArr >= 0 && lastObj >= 0) {
        limpio = limpio.substring(0, Math.max(lastArr, lastObj) + 1)
    } else if (lastArr >= 0) {
        limpio = limpio.substring(0, lastArr + 1)
    } else if (lastObj >= 0) {
        limpio = limpio.substring(0, lastObj + 1)
    }
    return limpio.trim()
}

async function llamarDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY no configurada')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

    let response: Response
    try {
        response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 4096,
            }),
            signal: controller.signal,
        })
    } catch (err: any) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') throw new Error(`Timeout tras ${API_TIMEOUT / 1000}s`)
        throw err
    }
    clearTimeout(timeoutId)

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${text}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    const usage = data.usage
    if (usage) {
        const cost = (usage.prompt_tokens / 1_000_000 * 0.15) + (usage.completion_tokens / 1_000_000 * 0.60)
        console.log(`  💰 Tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out ($${cost.toFixed(4)})`)
    }

    const jsonStr = extraerJSON(content)
    JSON.parse(jsonStr)
    return jsonStr
}

function construirSystemPromptConsejos(): string {
    return `Eres un chef nutricionista experto. Analiza cada receta y genera:

1. "consejos": 1-2 frases de consejos de preparación o presentación (texto corto, útil, en español)
2. "notas_coach": 1-2 frases con notas internas para el coach (texto corto, profesional, en español)

RESPONDE SOLO CON UN ARRAY JSON VÁLIDO. SIN markdown.
Formato:
[
  {
    "receta_id": "uuid",
    "consejos": "texto del consejo aquí",
    "notas_coach": "nota para el coach aquí"
  }
]`
}

async function faseConsejos() {
    console.log('\n📋 FASE 2: GENERAR CONSEJOS CON DEEPSEEK\n')

    // Cargar recetas sin consejos
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, instrucciones, descripcion, porciones, kcal, intolerancias, tags, tipo_coccion, tipo_plato')
        .or('consejos.is.null,consejos.eq.')

    if (!recetas || recetas.length === 0) {
        console.log('✅ Todas las recetas tienen consejos')
        return
    }

    console.log(`📊 Recetas sin consejos: ${recetas.length}`)

    const systemPrompt = construirSystemPromptConsejos()
    let totalActualizados = 0
    let totalErrores = 0

    for (let i = 0; i < recetas.length; i += BATCH_SIZE) {
        const batch = recetas.slice(i, i + BATCH_SIZE)
        console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recetas.length / BATCH_SIZE)} (${batch.length} recetas)`)

        const userPrompt = `Genera consejos y notas_coach para estas ${batch.length} recetas:

${batch.map((r, idx) => `
=== RECETA ${idx + 1} ===
ID: ${r.id}
NOMBRE: ${r.nombre}
DESCRIPCIÓN: ${r.descripcion || '(sin descripción)'}
TIPO: ${r.tipo_plato || ''} | COCCIÓN: ${r.tipo_coccion || ''}
TAGS: ${r.tags || ''}
INTOLERANCIAS: ${Array.isArray(r.intolerancias) ? r.intolerancias.join(', ') : (r.intolerancias || 'ninguna')}
PORCIONES: ${r.porciones || 1}
KCAL: ${r.kcal ? Math.round(r.kcal) : '?'}
INSTRUCCIONES:
${(r.instrucciones || '(sin instrucciones)').substring(0, 500)}
`).join('\n---\n')}`

        try {
            const jsonStr = await llamarDeepSeek(systemPrompt, userPrompt)
            const resultados = JSON.parse(jsonStr)

            if (!Array.isArray(resultados)) {
                console.log(`  ❌ La respuesta no es un array`)
                totalErrores += batch.length
                continue
            }

            for (const res of resultados) {
                const receta = batch.find(r => r.id === res.receta_id)
                if (!receta) {
                    console.log(`  ⚠️  Receta ID ${res.receta_id} no encontrada`)
                    continue
                }

                const updates: any = {}
                if (res.consejos) updates.consejos = res.consejos
                if (res.notas_coach) updates.notas_coach = res.notas_coach

                if (Object.keys(updates).length === 0) continue

                if (!DRY_RUN) {
                    const { error } = await supabase
                        .from('recetas')
                        .update(updates)
                        .eq('id', receta.id)

                    if (error) {
                        console.log(`  ❌ Error: ${error.message}`)
                        continue
                    }
                }

                totalActualizados++
                console.log(`  ✅ ${receta.nombre.substring(0, 45).padEnd(47)} consejos=✓ notas=✓`)
            }

        } catch (err: any) {
            console.log(`  ❌ Error en batch: ${err.message}`)
            totalErrores += batch.length
        }
    }

    console.log(`\n  📊 Consejos: ${totalActualizados} actualizados, ${totalErrores} errores`)
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
    console.log('')
    console.log('╔══════════════════════════════════════════════════╗')
    console.log('║   GENERAR INTOLERANCIAS Y CONSEJOS              ║')
    console.log('╚══════════════════════════════════════════════════╝')
    console.log('')
    console.log(`  Modo: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 REAL'}`)
    console.log(`  Fases: ${SOLO_INTOLERANCIAS ? 'solo intolerancias' : SOLO_CONSEJOS ? 'solo consejos' : 'ambas'}`)
    console.log('')

    if (!SOLO_CONSEJOS) {
        await faseIntolerancias()
    }

    if (!SOLO_INTOLERANCIAS) {
        await faseConsejos()
    }

    console.log('\n✅ PROCESO COMPLETADO\n')
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
