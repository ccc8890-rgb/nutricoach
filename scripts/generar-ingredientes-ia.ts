/**
 * generar-ingredientes-ia.ts
 *
 * Genera ingredientes para las recetas que no tienen usando DeepSeek.
 * Para cada receta sin ingredientes, envía nombre + instrucciones a DeepSeek,
 * extrae la lista de ingredientes, hace matching contra la tabla alimentos real
 * e inserta en receta_ingredientes.
 *
 * USO: npx tsx scripts/generar-ingredientes-ia.ts
 * USO (dry-run): DRY_RUN=true npx tsx scripts/generar-ingredientes-ia.ts
 * USO (batch): BATCH=10 npx tsx scripts/generar-ingredientes-ia.ts
 * USO (skip-matching): SKIP_MATCH=true npx tsx scripts/generar-ingredientes-ia.ts (solo muestra)
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ──────────────────────────────────────────────────────
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const BATCH_SIZE = parseInt(process.env.BATCH || '5', 10)
const DRY_RUN = process.env.DRY_RUN === 'true'
const SKIP_MATCH = process.env.SKIP_MATCH === 'true'
const COST_PER_INPUT_1M = 0.15
const COST_PER_OUTPUT_1M = 0.60
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '120', 10) * 1000 // ms
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10)
const CHECKPOINT_PATH = path.resolve(process.cwd(), '.checkpoint-generar-ingredientes.json')

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

// ─── Interfaces ──────────────────────────────────────────────────
interface RecetaSimple {
    id: string
    nombre: string
    instrucciones: string | null
    descripcion: string | null
    porciones: number | null
    kcal: number | null
}

interface IngredienteExtraido {
    nombre_limpio: string
    cantidad_gramos: number
}

// ─── Cargar alimentos en memoria ─────────────────────────────────
let alimentosCache: { id: string; nombre: string; nombre_normalizado: string }[] = []

async function cargarAlimentos() {
    console.log('📦 Cargando alimentos desde Supabase...')
    let all: any[] = []
    let from = 0
    const limit = 1000
    while (true) {
        const { data, error } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .range(from, from + limit - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all = all.concat(data)
        from += limit
        if (data.length < limit) break
    }
    alimentosCache = all.map(a => ({
        id: a.id,
        nombre: a.nombre,
        nombre_normalizado: normalizarNombre(a.nombre),
    }))
    console.log(`  ✅ ${alimentosCache.length} alimentos cargados`)
}

function normalizarNombre(n: string): string {
    return n
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function buscarAlimento(nombreLimpio: string): { id: string; nombre: string } | null {
    const norm = normalizarNombre(nombreLimpio)

    // 1. Match exacto
    const exacto = alimentosCache.find(a => a.nombre_normalizado === norm)
    if (exacto) return { id: exacto.id, nombre: exacto.nombre }

    // 2. Match exacto de una palabra clave (el más largo)
    //    Ej: "pechuga de pollo" -> busca "pechuga" y "pollo" por separado
    const palabras = norm.split(/\s+/).filter(p => p.length > 2)

    if (palabras.length > 0) {
        let mejor: { id: string; nombre: string; score: number } | null = null
        for (const a of alimentosCache) {
            const aNorm = a.nombre_normalizado
            let score = 0
            for (const p of palabras) {
                if (aNorm.includes(p)) score++
                // Bonus por palabras largas
                if (p.length > 5 && aNorm.includes(p)) score += 0.5
            }
            // Bonus si nombre completo está contenido
            if (aNorm.includes(norm) || norm.includes(aNorm)) score += 2
            // Penalización si hay demasiadas palabras extra en el match
            const aPalabras = aNorm.split(/\s+/)
            const extraLen = aPalabras.length - palabras.length
            if (extraLen > 3) score -= 1

            if (score > 0 && (!mejor || score > mejor.score)) {
                mejor = { id: a.id, nombre: a.nombre, score }
            }
        }
        if (mejor && mejor.score >= 1.5) {
            return { id: mejor.id, nombre: mejor.nombre }
        }
    }

    // 3. Fallback: contiene palabra clave
    if (palabras.length >= 1) {
        for (const a of alimentosCache) {
            for (const p of palabras) {
                if (a.nombre_normalizado.includes(p) && p.length > 3) {
                    return { id: a.id, nombre: a.nombre }
                }
            }
        }
    }

    return null
}

// ─── Extraer JSON de respuesta DeepSeek ──────────────────────────
function extraerJSON(texto: string): string {
    // Quitar bloques markdown ```json ... ```
    let limpio = texto.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '')
    // Quitar cualquier texto antes del primer [ o {
    const arrIdx = limpio.indexOf('[')
    const objIdx = limpio.indexOf('{')
    if (arrIdx >= 0 && (objIdx < 0 || arrIdx < objIdx)) {
        limpio = limpio.substring(arrIdx)
    } else if (objIdx >= 0) {
        limpio = limpio.substring(objIdx)
    }
    // Quitar trailing después del último ] o }
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

// ─── DeepSeek API con timeout ────────────────────────────────────
async function llamarDeepSeek(systemPrompt: string, userPrompt: string, intento: number = 1): Promise<string> {
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
                temperature: 0.1,
                max_tokens: 4096,
            }),
            signal: controller.signal,
        })
    } catch (err: any) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
            throw new Error(`Timeout tras ${API_TIMEOUT / 1000}s`)
        }
        throw err
    }
    clearTimeout(timeoutId)

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${text}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
        // Reintentar si respuesta vacía (puede ser inestabilidad del modelo)
        if (intento < MAX_RETRIES) {
            const wait = intento * 5000
            console.log(`  🔄 Respuesta vacía — reintento ${intento + 1}/${MAX_RETRIES} en ${wait / 1000}s...`)
            await new Promise(r => setTimeout(r, wait))
            return llamarDeepSeek(systemPrompt, userPrompt, intento + 1)
        }
        throw new Error('DeepSeek: respuesta vacía (tras reintentos)')
    }

    const usage = data.usage
    if (usage) {
        const cost = (usage.prompt_tokens / 1_000_000 * COST_PER_INPUT_1M) +
            (usage.completion_tokens / 1_000_000 * COST_PER_OUTPUT_1M)
        console.log(`  💰 Tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out ($${cost.toFixed(4)})`)
    }

    const jsonStr = extraerJSON(content)
    // Validate it's parseable
    JSON.parse(jsonStr)
    return jsonStr
}

// ─── Checkpoint ──────────────────────────────────────────────────
function leerCheckpoint(): Set<string> {
    if (!fs.existsSync(CHECKPOINT_PATH)) return new Set()
    try {
        const data = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'))
        return new Set(data.recetasProcesadas || [])
    } catch {
        return new Set()
    }
}

function guardarCheckpoint(recetasProcesadas: Set<string>) {
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({
        recetasProcesadas: Array.from(recetasProcesadas),
        updatedAt: new Date().toISOString(),
    }))
}

// ─── Construir prompts ───────────────────────────────────────────
function construirSystemPrompt(): string {
    return `Eres un nutricionista experto analizando recetas.

Tu tarea es extraer la lista de ingredientes de cada receta proporcionada, calculando las cantidades aproximadas en gramos.

REGLAS:
1. Extrae SOLO ingredientes reales de la receta. OMITE sal, pimienta, especias al gusto, edulcorante.
2. NORMALIZA los nombres: plural -> singular ("huevos" -> "huevo"), estandariza al español.
3. CONVIERTE medidas a gramos (estima si no hay cantidad exacta):
   - 1 cucharada sopera = 15g
   - 1 cucharadita = 5g
   - 1 taza / 1 vaso = 200g
   - 1 huevo M = 60g
   - 1 diente de ajo = 5g
   - 1 cebolla mediana = 150g
   - 1 unidad de fruta mediana (manzana, naranja, plátano) = 150g
   - 1 pechuga de pollo = 200g
   - 1 filete de pescado = 150g
4. Si la receta no especifica cantidad para un ingrediente, ESTIMA una cantidad razonable basada en el contexto (número de porciones, tipo de plato).
   Por ejemplo: "aceite de oliva" para saltear ≈ 15g por porción
5. USA nombres de ingredientes que puedan existir en una base de datos de alimentos española:
   - "huevo" (no "huevos")
   - "leche desnatada"
   - "aceite de oliva"
   - "pechuga de pollo" (no solo "pollo")
   - "arroz blanco" (no solo "arroz")
   - "pan de molde integral" (no solo "pan")
   - "tomate" (no "tomates")
   - "cebolla"
   - "ajo"
   - "calabacín"
   - "pimiento"
   - "champiñón"
   - "espinaca"
   - "clara de huevo" (no "claras")
   - "proteína en polvo sabor vainilla"
   - "avena en copos"
   - "requesón"
   - "yogur natural desnatado"

RESPONDE SOLO CON UN ARRAY JSON VÁLIDO. SIN markdown, SIN explicaciones, SOLO el JSON.

Formato:
[
  {
    "receta_id": "uuid-exacto",
    "ingredientes": [
      { "nombre_limpio": "nombre del ingrediente", "cantidad_gramos": 150 }
    ]
  }
]

IMPORTANTE: cantidad_gramos debe ser SIEMPRE > 0. Si no puedes estimar, usa una cantidad razonable por defecto basada en el tipo de ingrediente y las porciones.`
}

function construirUserPrompt(recetas: RecetaSimple[]): string {
    return `Analiza estas ${recetas.length} recetas y extrae todos sus ingredientes con cantidades en gramos:

${recetas.map((r, i) => `
=== RECETA ${i + 1} ===
ID: ${r.id}
NOMBRE: ${r.nombre}
PORCIONES: ${r.porciones || 1}
KCAL APROX: ${r.kcal ? Math.round(r.kcal) : '?'}
DESCRIPCIÓN: ${r.descripcion || '(sin descripción)'}
INSTRUCCIONES:
${r.instrucciones || '(sin instrucciones)'}
`).join('\n---\n')}`
}

// ─── Insertar ingredientes en DB ─────────────────────────────────
async function insertarIngredientes(recetaId: string, ingredientes: IngredienteExtraido[]) {
    if (ingredientes.length === 0) {
        console.log(`    ⏭️  Sin ingredientes`)
        return { insertados: 0, matched: 0, sinMatch: 0 }
    }

    let insertados = 0
    let matched = 0
    let sinMatch = 0

    for (let i = 0; i < ingredientes.length; i++) {
        const ing = ingredientes[i]
        const match = buscarAlimento(ing.nombre_limpio)

        if (match) {
            matched++
            console.log(`    ${String(ing.cantidad_gramos).padStart(6)}g ${ing.nombre_limpio.padEnd(32)} ✅ → ${match.nombre.substring(0, 35)}`)
            if (!DRY_RUN && !SKIP_MATCH) {
                const { error } = await supabase.from('receta_ingredientes').insert({
                    receta_id: recetaId,
                    alimento_id: match.id,
                    cantidad_gramos: ing.cantidad_gramos,
                    orden: i + 1,
                })
                if (error) {
                    console.log(`       ❌ Error: ${error.message}`)
                    continue
                }
            }
            insertados++
        } else {
            sinMatch++
            console.log(`    ${String(ing.cantidad_gramos).padStart(6)}g ${ing.nombre_limpio.padEnd(32)} ⚠️  → SIN MATCH (nombre_libre)`)
            if (!DRY_RUN) {
                const { error } = await supabase.from('receta_ingredientes').insert({
                    receta_id: recetaId,
                    nombre_libre: ing.nombre_limpio,
                    cantidad_gramos: ing.cantidad_gramos,
                    orden: i + 1,
                })
                if (error) {
                    console.log(`       ❌ Error: ${error.message}`)
                    continue
                }
            }
            insertados++
        }
    }

    return { insertados, matched, sinMatch }
}

// ─── Recalcular macros ───────────────────────────────────────────
async function recalcularMacros(recetaId: string) {
    if (DRY_RUN || SKIP_MATCH) return
    const { error } = await supabase.rpc('calcular_macros_receta', { p_receta_id: recetaId })
    if (error) {
        console.log(`    ⚠️  No se pudo recalcular macros: ${error.message}`)
    }
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
    console.log('')
    console.log('╔══════════════════════════════════════════════════╗')
    console.log('║   GENERAR INGREDIENTES CON DEEPSEEK             ║')
    console.log('╚══════════════════════════════════════════════════╝')
    console.log('')
    console.log(`  Modo: ${DRY_RUN ? '🔍 DRY RUN (no se inserta nada)' : '🚀 REAL'}`)
    console.log(`  Batch size: ${BATCH_SIZE}`)
    console.log(`  API timeout: ${API_TIMEOUT / 1000}s`)
    console.log(`  Modelo: ${MODEL}`)
    console.log('')

    // Cargar alimentos
    await cargarAlimentos()

    // Obtener recetas sin ingredientes
    const { data: recetas } = await supabase.from('recetas').select('id, nombre, instrucciones, descripcion, porciones, kcal')
    if (!recetas || recetas.length === 0) {
        console.log('❌ No se pudieron obtener recetas')
        return
    }

    // FIX: Paginación correcta - Supabase limita a 1000 filas por página
    let allIngs: { receta_id: string }[] = []
    let from = 0
    const pageLimit = 1000
    while (true) {
        const { data, error } = await supabase
            .from('receta_ingredientes')
            .select('receta_id')
            .order('receta_id')
            .range(from, from + pageLimit - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        allIngs = allIngs.concat(data)
        from += pageLimit
        if (data.length < pageLimit) break
    }
    const idsConIng = new Set(allIngs.map(i => i.receta_id))
    console.log(`  📊 Filas de ingredientes: ${allIngs.length}`)

    const sinIng = recetas.filter((r: any) => !idsConIng.has(r.id)) as RecetaSimple[]
    console.log(`📊 Total recetas: ${recetas.length}`)
    console.log(`📊 Recetas SIN ingredientes: ${sinIng.length}`)
    console.log('')

    if (sinIng.length === 0) {
        console.log('✅ Todas las recetas tienen ingredientes!')
        // Clean up checkpoint
        if (fs.existsSync(CHECKPOINT_PATH)) fs.unlinkSync(CHECKPOINT_PATH)
        return
    }

    // Cargar checkpoint de ejecuciones anteriores
    const recetasProcesadas = leerCheckpoint()
    const pendientes = sinIng.filter(r => !recetasProcesadas.has(r.id))
    if (recetasProcesadas.size > 0) {
        console.log(`📌 Checkpoint: ${recetasProcesadas.size} recetas ya procesadas, ${pendientes.length} pendientes`)
        console.log('')
    }

    // Mostrar lista
    console.log('  Recetas a procesar:')
    pendientes.forEach((r, i) => {
        const kcal = r.kcal ? `${Math.round(r.kcal)}kcal` : '?kcal'
        console.log(`  ${String(i + 1).padStart(2)}. [${kcal.padEnd(8)}] ${r.nombre.substring(0, 50)}`)
    })
    console.log('')

    const systemPrompt = construirSystemPrompt()
    let totalInsertados = 0
    let totalMatched = 0
    let totalSinMatch = 0
    let totalErrores = 0

    for (let i = 0; i < pendientes.length; i += BATCH_SIZE) {
        const batch = pendientes.slice(i, i + BATCH_SIZE)
        console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendientes.length / BATCH_SIZE)} (${batch.length} recetas)`)

        const userPrompt = construirUserPrompt(batch)
        const startTime = Date.now()

        let jsonStr: string
        let batchExito = false
        let batchErr: Error | null = null

        for (let intento = 1; intento <= MAX_RETRIES; intento++) {
            try {
                jsonStr = await llamarDeepSeek(systemPrompt, userPrompt, 1)
                batchExito = true
                batchErr = null
                break
            } catch (err: any) {
                batchErr = err
                if (intento < MAX_RETRIES) {
                    const wait = intento * 10000
                    console.log(`  🔄 Error en batch: ${err.message} — reintento ${intento + 1}/${MAX_RETRIES} en ${wait / 1000}s...`)
                    await new Promise(r => setTimeout(r, wait))
                }
            }
        }

        if (!batchExito) {
            console.log(`  ❌ Error en batch tras ${MAX_RETRIES} intentos: ${batchErr?.message}`)
            totalErrores += batch.length
            continue
        }

        try {
            const resultados = JSON.parse(jsonStr!)

            if (!Array.isArray(resultados)) {
                console.log(`  ❌ La respuesta no es un array`)
                totalErrores += batch.length
                continue
            }

            let batchOk = true
            for (const res of resultados) {
                const receta = batch.find(r => r.id === res.receta_id)
                if (!receta) {
                    console.log(`  ⚠️  Receta ID ${res.receta_id} no encontrada en el batch`)
                    continue
                }

                console.log(`\n  📝 ${receta.nombre.substring(0, 50)} (${res.ingredientes?.length || 0} ingredientes)`)

                if (!res.ingredientes || res.ingredientes.length === 0) {
                    console.log(`    ⏭️  Sin ingredientes detectados`)
                    // Still mark as processed so we skip it next time
                    recetasProcesadas.add(res.receta_id)
                    continue
                }

                const { insertados, matched, sinMatch } = await insertarIngredientes(
                    res.receta_id, res.ingredientes
                )
                totalInsertados += insertados
                totalMatched += matched
                totalSinMatch += sinMatch

                if (!DRY_RUN && !SKIP_MATCH && insertados > 0) {
                    await recalcularMacros(res.receta_id)
                }

                // Mark as processed
                recetasProcesadas.add(res.receta_id)
            }

            // Guardar checkpoint después de cada batch exitoso
            if (!DRY_RUN) {
                guardarCheckpoint(recetasProcesadas)
                console.log(`  💾 Checkpoint guardado (${recetasProcesadas.size} recetas)`)
            }

        } catch (err: any) {
            console.log(`  ❌ Error en batch: ${err.message}`)
            totalErrores += batch.length
        }
    }

    // ─── Resumen final ──────────────────────────────────────────
    console.log('')
    console.log('='.repeat(55))
    console.log('  📊 RESUMEN FINAL')
    console.log('='.repeat(55))
    console.log(`  Recetas procesadas:    ${pendientes.length - totalErrores}/${pendientes.length}`)
    console.log(`  Ingredientes totales:  ${totalInsertados}`)
    console.log(`  ✅ Match en alimentos: ${totalMatched}`)
    console.log(`  ⚠️  Nombre libre:       ${totalSinMatch}`)
    console.log(`  ❌ Errores:            ${totalErrores}`)
    if (DRY_RUN) console.log('\n  🔍 DRY RUN - No se realizaron cambios')
    console.log('')

    // Clean up checkpoint if all done
    if (totalErrores === 0 && fs.existsSync(CHECKPOINT_PATH)) {
        fs.unlinkSync(CHECKPOINT_PATH)
        console.log('  ✅ Checkpoint eliminado (todo completado)')
    }
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
