/**
 * 🛠️ REPARACIÓN MASIVA DE RECETAS CON DEEPSEEK
 *
 * Procesa TODAS las recetas que tienen:
 * - Instrucciones = 1 palabra o null/vacío
 * - Solo 1 ingrediente en la BD
 * - url_origen con método cocción o tiempo (no URL)
 *
 * Pipeline por receta:
 * 1. Construir prompt sintético (nombre + ingrediente actual + método cocción)
 * 2. Enviar a DeepSeek → recibe ingredientes completos + instrucciones + macros
 * 3. Auto-match ingredientes contra DB (con auto-creación si no existen)
 * 4. Limpiar ingredientes antiguos e insertar nuevos
 * 5. Actualizar receta (instrucciones, descripcion, macros, porciones, tiempos)
 *
 * Uso: npx tsx scripts/batch-repair-recetas.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Cargar .env.local ─────────────────────────────────
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Interfaces ────────────────────────────────────────
interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}
interface DeepSeekResponse {
    choices: { message: { content: string } }[]
    usage: { total_tokens: number }
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

interface RecetaPendiente {
    id: string
    nombre: string
    instrucciones: string | null
    url_origen: string | null
    descripcion: string | null
    porciones: number | null
    tiempo_prep_min: number | null
    tiempo_coccion_min: number | null
    ingrediente_actual: { nombre: string; gramos: number } | null
    coach_id?: string
}

// ── Normalizar nombre (para auto-match) ───────────────
function normalizarNombre(nombre: string): string {
    const map: Record<string, string> = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ñ': 'n', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N',
    }
    let n = nombre.toLowerCase().trim()
    for (const [k, v] of Object.entries(map)) n = n.replaceAll(k, v)
    // Plural → singular simple
    if (n.endsWith('es') && n.length > 4) n = n.slice(0, -2)
    else if (n.endsWith('s') && n.length > 3) n = n.slice(0, -1)
    return n
}

// ── Auto-match ingredientes (copia de backfill-recetas) ──
async function autoMatchIngredientesIA(
    ingredientesRefinados: { nombre_limpio: string; cantidad_gramos: number; macros_100g?: any }[],
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

            // Si falló, push sin alimento_id
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
            unmatched++
        } else {
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
            unmatched++
        }
    }

    return { ingredientesDB, matched, unmatched, autoCreados }
}

// ── Calcular macros ──────────────────────────────────
async function calcularMacros(
    ingredientes: { alimento_id: string | null; cantidad_gramos: number }[],
    porciones: number
): Promise<{ kcal: number | null; proteinas: number | null; carbohidratos: number | null; grasas: number | null; fibra: number | null }> {
    const ids = ingredientes.filter(i => i.alimento_id).map(i => i.alimento_id!)
    if (ids.length === 0) return { kcal: null, proteinas: null, carbohidratos: null, grasas: null, fibra: null }

    const { data: alimentos } = await supabase.from('alimentos').select('id, calorias, proteinas, carbohidratos, grasas, fibra').in('id', ids)
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

    if (porciones > 0) {
        return {
            kcal: Math.round(kcal / porciones),
            proteinas: Math.round(proteinas / porciones * 10) / 10,
            carbohidratos: Math.round(carbohidratos / porciones * 10) / 10,
            grasas: Math.round(grasas / porciones * 10) / 10,
            fibra: Math.round(fibra / porciones * 10) / 10,
        }
    }
    return { kcal: Math.round(kcal), proteinas: Math.round(proteinas * 10) / 10, carbohidratos: Math.round(carbohidratos * 10) / 10, grasas: Math.round(grasas * 10) / 10, fibra: Math.round(fibra * 10) / 10 }
}

// ── Obtener recetas pendientes ──────────────────────────
async function getRecetasPendientes(): Promise<RecetaPendiente[]> {
    const { data: todas } = await supabase.from('recetas').select('id, nombre, instrucciones, url_origen, descripcion, porciones, tiempo_prep_min, tiempo_coccion_min')
    if (!todas) return []

    // Filtrar recetas con instrucciones incorrectas
    const pendientes = todas.filter(r => {
        const instr = r.instrucciones?.trim() || ''
        return instr.length < 100 // menos de 100 chars = incompleta
    })

    console.log(`📋 Recetas totales: ${todas.length}`)
    console.log(`📋 Recetas pendientes: ${pendientes.length}\n`)

    // Obtener ingrediente actual de cada una
    const result: RecetaPendiente[] = []

    for (const r of pendientes) {
        const { data: ing } = await supabase
            .from('receta_ingredientes')
            .select('nombre_libre, cantidad_gramos')
            .eq('receta_id', r.id)
            .limit(1)

        // Obtener coach_id de la primera receta (todas comparten el mismo coach)
        const { data: recetaCoach } = await supabase.from('recetas').select('coach_id').eq('id', r.id).single()

        result.push({
            ...r,
            ingrediente_actual: ing?.[0]?.nombre_libre
                ? { nombre: ing[0].nombre_libre, gramos: ing[0].cantidad_gramos }
                : null,
            coach_id: recetaCoach?.coach_id || undefined
        })
    }

    return result
}

// ── Construir prompt para DeepSeek ──────────────────────
function construirPrompt(receta: RecetaPendiente, ingredientesExtra?: string): string {
    const metodoCoccion = receta.url_origen && !receta.url_origen.startsWith('http')
        ? receta.url_origen
        : 'No especificado'

    const tiempo = receta.url_origen && !receta.url_origen.startsWith('http') && /^\d+$/.test(receta.url_origen)
        ? `Tiempo estimado: ${receta.url_origen} minutos`
        : ''

    const tiempoPrep = receta.tiempo_prep_min ? `Preparación: ${receta.tiempo_prep_min} min` : ''
    const tiempoCocc = receta.tiempo_coccion_min ? `Cocción: ${receta.tiempo_coccion_min} min` : ''

    let ingStr = '(sin ingredientes registrados)'
    if (receta.ingrediente_actual) {
        ingStr = `- ${receta.ingrediente_actual.nombre}: ${receta.ingrediente_actual.gramos}g (este es el ÚNICO ingrediente registrado. INFIERE los demás según el nombre del plato)`
    }

    return `INSTRUCCIÓN: Completa esta receta con tus conocimientos culinarios.

NOMBRE: "${receta.nombre}"
MÉTODO COCCIÓN: ${metodoCoccion}
${tiempo}
${tiempoPrep}
${tiempoCocc}

INGREDIENTE CONOCIDO EN BD:
${ingStr}

${ingredientesExtra ? `INGREDIENTES ADICIONALES (extraídos de la descripción actual):\n${ingredientesExtra}\n` : ''}

INSTRUCCIONES ACTUALES: "${receta.instrucciones?.substring(0, 60) || '(vacío)'}"

Tu trabajo:
1. Basándote en el nombre, INFIERE la lista COMPLETA de ingredientes con cantidades.
2. Escribe instrucciones profesionales (4-8 pasos numerados).
3. Estima macros/100g para cada ingrediente (BEDCA/USDA).
4. Calcula macros totales por porción.
5. Si es repostería (cake, bizcocho, donuts, brownie, gofre) usa ingredientes típicos.
6. Si es snack frío (hummus, tostas, mix), preparación en frío.
7. Si tiene carne/pescado, incluye condimentos y guarniciones típicas.
8. NO incluyas ingredientes de decoración opcional (a menos que sea esencial).`
}

// ── Llamar a DeepSeek ─────────────────────────────────
async function refinarConIA(
    textoCrudo: string,
    urlOrigen: string
): Promise<{ data: any; total_tokens: number }> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const systemPrompt = `Eres un nutricionista y chef experto. Transformas recetas incompletas en recetas profesionales completas.

NORMAS:
1. INFIERE ingredientes faltantes por el nombre del plato y tus conocimientos culinarios.
2. IDIOMA: Todo en español.
3. MEDIDAS: Sistema métrico (gramos/ml).
4. INSTRUCCIONES: Pasos numerados detallados (4-8 pasos) en lenguaje culinario profesional.
5. MACROS/100g: Para cada ingrediente, estima valores basados en BEDCA/USDA.
6. MACROS TOTALES: Calcula por porción sumando ingredientes y dividiendo entre porciones.
7. NO incluyas ingredientes opcionales de decoración.
8. Sé realista con cantidades: una receta para 1 persona no lleva 1kg de ingredientes.

RESPONDE ÚNICAMENTE CON JSON VÁLIDO. SIN markdown, SIN texto adicional.

{
  "nombre": "Nombre exacto de la receta",
  "descripcion": "Descripción profesional y apetitosa (1-2 frases)",
  "instrucciones": "1. Paso uno...\\n2. Paso dos...\\n",
  "imagen_url": null,
  "porciones": 1,
  "tiempo_prep_min": 5,
  "tiempo_coccion_min": 10,
  "ingredientes": [
    {
      "nombre_original": "nombre del ingrediente en español",
      "nombre_limpio": "nombre normalizado (singular, español)",
      "cantidad_gramos": 100,
      "macros_100g": { "kcal": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "fibra": 0 }
    }
  ],
  "macros_por_porcion": {
    "kcal": 0,
    "proteinas": 0,
    "carbohidratos": 0,
    "grasas": 0,
    "fibra": 0
  }
}`

    const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATOS DE LA RECETA:\n\n${textoCrudo}\n\nURL/Origen: ${urlOrigen}` },
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            temperature: 0.2,
            max_tokens: 4096,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    const data: DeepSeekResponse = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`DeepSeek: respuesta no contiene JSON: ${content.slice(0, 200)}`)

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.nombre || !parsed.ingredientes || !parsed.macros_por_porcion) {
        throw new Error('DeepSeek: JSON incompleto')
    }

    // Asegurar que los ingredientes tengan cantidad_gramos > 0
    parsed.ingredientes = parsed.ingredientes.filter((i: any) => i.cantidad_gramos > 0 && i.nombre_limpio?.length > 1)

    return { data: parsed, total_tokens: data.usage.total_tokens }
}

// ── Actualizar receta en BD ────────────────────────────
async function actualizarRecetaEnBD(
    recetaId: string,
    data: any,
    ingredientesDB: { alimento_id: string | null; nombre_libre: string; cantidad_gramos: number; orden: number }[],
    coach_id: string
): Promise<boolean> {
    try {
        // Calcular macros reales con los alimentos de la DB
        const macros = await calcularMacros(ingredientesDB, data.porciones || 1)

        // Actualizar receta
        const { error: updateError } = await supabase.from('recetas').update({
            instrucciones: data.instrucciones,
            descripcion: data.descripcion || null,
            porciones: data.porciones || 1,
            tiempo_prep_min: data.tiempo_prep_min ?? null,
            tiempo_coccion_min: data.tiempo_coccion_min ?? null,
            kcal: macros.kcal,
            proteinas: macros.proteinas,
            carbohidratos: macros.carbohidratos,
            grasas: macros.grasas,
            fibra: macros.fibra,
        }).eq('id', recetaId)

        if (updateError) {
            console.error(`     ❌ Error actualizando receta: ${updateError.message}`)
            return false
        }

        // Eliminar ingredientes antiguos
        const { error: deleteError } = await supabase.from('receta_ingredientes').delete().eq('receta_id', recetaId)
        if (deleteError) {
            console.error(`     ❌ Error eliminando ingredientes antiguos: ${deleteError.message}`)
            return false
        }

        // Insertar nuevos ingredientes
        if (ingredientesDB.length > 0) {
            const inserts = ingredientesDB.map(ing => ({
                receta_id: recetaId,
                alimento_id: ing.alimento_id,
                nombre_libre: ing.nombre_libre,
                cantidad_gramos: ing.cantidad_gramos,
                orden: ing.orden,
            }))
            const { error: insertError } = await supabase.from('receta_ingredientes').insert(inserts)
            if (insertError) {
                console.error(`     ❌ Error insertando ingredientes: ${insertError.message}`)
                return false
            }
        }

        return true
    } catch (err) {
        console.error(`     ❌ Error en actualizarRecetaBD:`, err)
        return false
    }
}

// ── Procesar una receta ────────────────────────────────
async function procesarReceta(receta: RecetaPendiente): Promise<{
    ok: boolean; tokens: number; ingredientes: number; autoCreados: number; matched: number; error?: string
}> {
    const defaultCoach = receta.coach_id || '00000000-0000-0000-0000-000000000000'

    try {
        // 1. Enviar a DeepSeek
        const prompt = construirPrompt(receta)
        const { data, total_tokens } = await refinarConIA(prompt, receta.url_origen || 'sin-origen')

        // 2. Validar que DeepSeek devolvió ingredientes suficientes
        if (!data.ingredientes || data.ingredientes.length < 2) {
            return { ok: false, tokens: total_tokens, ingredientes: 0, autoCreados: 0, matched: 0, error: 'DeepSeek devolvió <2 ingredientes' }
        }

        // 3. Auto-match ingredientes contra la DB
        const matchResult = await autoMatchIngredientesIA(data.ingredientes, defaultCoach)

        // 4. Actualizar receta en BD
        const success = await actualizarRecetaEnBD(receta.id, data, matchResult.ingredientesDB, defaultCoach)

        return {
            ok: success,
            tokens: total_tokens,
            ingredientes: data.ingredientes.length,
            autoCreados: matchResult.autoCreados,
            matched: matchResult.matched,
            error: success ? undefined : 'Error al actualizar BD'
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        return { ok: false, tokens: 0, ingredientes: 0, autoCreados: 0, matched: 0, error: msg }
    }
}

// ── Main ───────────────────────────────────────────────
async function main() {
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║   🛠️  REPARACIÓN MASIVA DE RECETAS CON DEEPSEEK        ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log('')

    // Obtener recetas pendientes
    const pendientes = await getRecetasPendientes()
    if (pendientes.length === 0) {
        console.log('✅ No hay recetas pendientes de reparar.')
        return
    }

    // Resumen de pendientes
    const conUrl = pendientes.filter(r => r.url_origen?.startsWith('http') ?? false)
    const conMetodo = pendientes.filter(r => r.url_origen && !r.url_origen.startsWith('http') && isNaN(Number(r.url_origen)))
    const conNumero = pendientes.filter(r => r.url_origen && !r.url_origen.startsWith('http') && !isNaN(Number(r.url_origen)))
    const sinUrl = pendientes.filter(r => !r.url_origen)

    console.log(`📊 DISTRIBUCIÓN:`)
    console.log(`   URL válida:         ${conUrl.length}`)
    console.log(`   Método cocción:     ${conMetodo.length}`)
    console.log(`   Tiempo (número):    ${conNumero.length}`)
    console.log(`   Sin url_origen:     ${sinUrl.length}`)
    console.log(`   TOTAL:              ${pendientes.length}`)
    console.log('')

    // ── Procesar con pool de concurrencia ──
    const MAX_CONCURRENT = 3
    let processed = 0
    let ok = 0, failed = 0
    let totalTokens = 0
    let totalAutoCreados = 0
    let totalMatched = 0
    let startTime = Date.now()

    // Procesar en lotes de MAX_CONCURRENT
    for (let i = 0; i < pendientes.length; i += MAX_CONCURRENT) {
        const batch = pendientes.slice(i, i + MAX_CONCURRENT)
        const results = await Promise.all(batch.map(r => procesarReceta(r)))

        for (let j = 0; j < batch.length; j++) {
            const receta = batch[j]
            const result = results[j]
            processed++

            if (result.ok) {
                ok++
                console.log(`✅ [${processed}/${pendientes.length}] ${receta.nombre}`)
                console.log(`     Ingredientes: ${result.ingredientes} | Matched: ${result.matched} | Creados: ${result.autoCreados} | Tokens: ${result.tokens}`)
            } else {
                failed++
                console.log(`❌ [${processed}/${pendientes.length}] ${receta.nombre} → ${result.error?.substring(0, 80)}`)
            }

            totalTokens += result.tokens
            totalAutoCreados += result.autoCreados
            totalMatched += result.matched
        }

        // Pequeña pausa entre lotes
        if (i + MAX_CONCURRENT < pendientes.length) {
            await new Promise(r => setTimeout(r, 500))
        }
    }

    // ── Resumen final ──
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    console.log('')
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║   📊 RESUMEN FINAL                          ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log(`  Procesadas:  ${pendientes.length}`)
    console.log(`  ✅ Correctas: ${ok}`)
    console.log(`  ❌ Fallos:    ${failed}`)
    console.log(`  🥗 Ingredientes matched: ${totalMatched}`)
    console.log(`  🆕 Alimentos auto-creados: ${totalAutoCreados}`)
    console.log(`  📊 Tokens totales: ${totalTokens}`)
    console.log(`  ⏱️  Tiempo: ${elapsed} min`)
    console.log(`  💰 Coste: ~$${(totalTokens * 0.00000015 + totalTokens * 0.0000006 * 0.3).toFixed(4)}`)
    console.log('')
}

main().catch(err => {
    console.error('Error general:', err)
    process.exit(1)
})
