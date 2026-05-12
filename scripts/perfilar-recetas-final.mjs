/**
 * perfilar-recetas-final.mjs
 *
 * Revisión de calidad completa de recetas con DeepSeek.
 * Detecta y corrige:
 *   1. Instrucciones en párrafo → pasos numerados (4-8 pasos)
 *   2. Ingredientes duplicados → mergeados y macros recalculados
 *   3. Cantidades sin sentido (demasiado altas o bajas) → corregidas
 *   4. Orden de ingredientes incorrecto → mayor a menor en gramos
 *   5. Macros incorrectos o a cero → recalculados desde ingredientes
 *   6. Descripción vacía o genérica → generada
 *
 * USO:
 *   node scripts/perfilar-recetas-final.mjs              → solo recetas con problemas
 *   node scripts/perfilar-recetas-final.mjs --todas      → todas las recetas
 *   node scripts/perfilar-recetas-final.mjs --dry-run    → muestra qué haría sin guardar
 *   node scripts/perfilar-recetas-final.mjs --slug "brownie"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
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

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
const DRY_RUN = process.argv.includes('--dry-run')
const TODAS = process.argv.includes('--todas')
const slugIdx = process.argv.indexOf('--slug')
const SLUG_FILTRO = slugIdx !== -1 ? process.argv[slugIdx + 1] : null

// ── Detectar problemas ────────────────────────────────────────────────────────
function detectarProblemas(receta, ingredientes) {
    const instr = receta.instrucciones?.trim() || ''
    const tienePasos = /^\s*\d+[\.\)]/m.test(instr)

    // Duplicados: mismo nombre normalizado más de una vez
    const nombresNorm = ingredientes.map(i =>
        (i.nombre_libre || '').toLowerCase().trim().replace(/s$/, '')
    )
    const duplicados = nombresNorm.length !== new Set(nombresNorm).size

    // Orden incorrecto: algún ingrediente posterior tiene más gramos que el anterior
    const ordenIncorrecto = ingredientes.some((ing, idx) =>
        idx > 0 && ing.cantidad_gramos > ingredientes[idx - 1].cantidad_gramos * 1.5
    )

    // Cantidades absurdas: >1000g de algo que no sea agua/líquido, o <1g
    const cantidadesRaras = ingredientes.some(i =>
        i.cantidad_gramos > 1000 || (i.cantidad_gramos > 0 && i.cantidad_gramos < 1)
    )

    // Macros a cero o negativas
    const sinMacros = !receta.kcal || receta.kcal === 0

    // Instrucciones en párrafo
    const instrParrafo = instr.length > 80 && !tienePasos
    const instrCorta = instr.length < 80

    return {
        instrParrafo, instrCorta, sinMacros,
        duplicados, ordenIncorrecto, cantidadesRaras,
        sinIngredientes: ingredientes.length === 0,
        sinDescripcion: !receta.descripcion || receta.descripcion.trim().length < 20,
    }
}

function necesitaReparacion(p) {
    return p.instrParrafo || p.instrCorta || p.sinMacros ||
        p.duplicados || p.ordenIncorrecto || p.cantidadesRaras || p.sinIngredientes
}

// ── Construir prompt con datos reales completos ───────────────────────────────
function construirPrompt(receta, ingredientes) {
    const ingStr = ingredientes.length > 0
        ? ingredientes.map((i, idx) =>
            `  ${idx + 1}. ${i.nombre_libre || i.alimento?.nombre}: ${i.cantidad_gramos}g`
        ).join('\n')
        : '  (ninguno registrado)'

    const instr = receta.instrucciones?.trim() || '(vacío)'

    return `Revisa y corrige esta ficha de receta. Responde SOLO con JSON válido, sin markdown.

═══ RECETA ═══════════════════════════════════
NOMBRE: "${receta.nombre}"
CATEGORÍA: ${receta.categoria || 'no especificada'}
PORCIONES: ${receta.porciones || 1}
TIEMPO PREP: ${receta.tiempo_prep_min || '?'} min | COCCIÓN: ${receta.tiempo_coccion_min || '?'} min

INGREDIENTES ACTUALES EN BD:
${ingStr}

INSTRUCCIONES ACTUALES:
${instr}

MACROS ACTUALES (por porción): ${receta.kcal || 0} kcal | ${receta.proteinas || 0}g prot | ${receta.carbohidratos || 0}g carbs | ${receta.grasas || 0}g grasas

═══ TU TAREA ══════════════════════════════════
1. INGREDIENTES: Devuelve la lista corregida con estos criterios:
   - Elimina duplicados (mismo ingrediente con distinto nombre → uno solo, suma los gramos)
   - Corrige cantidades sin sentido (ej: 5g de avena en un desayuno → mínimo 40g; 500g de mantequilla → probablemente 20-30g)
   - Ordena de MAYOR a MENOR cantidad en gramos
   - Si no hay ingredientes, infiere la lista completa con cantidades reales
   - Usa los valores nutricionales de BEDCA o USDA para cada ingrediente

2. INSTRUCCIONES:
   - Si es un párrafo sin numerar → conviértelo en 4-8 pasos numerados claros
   - Si ya tiene pasos numerados y están bien → devuélvelos tal cual (copia exacta)

3. MACROS POR PORCIÓN (CRÍTICO):
   - Suma todos los ingredientes: total_kcal = Σ (gramos_ingrediente / 100 × kcal_100g)
   - Divide entre el número de porciones: kcal_por_porcion = total_kcal / porciones
   - NUNCA devuelvas los macros totales de la receta entera — siempre divididos por porción
   - Referencia de cordura: snack/postre fit → 100-400 kcal/porción; plato principal → 300-700 kcal/porción; bizcocho/tarta (1 trozo) → 150-350 kcal/porción
   - Si el resultado supera 800 kcal/porción en una receta fit, revisa las cantidades de ingredientes

4. MACROS POR 100g:
   - Calcula el peso total de la receta: peso_total = Σ gramos de todos los ingredientes
   - kcal_100g = (total_kcal_receta / peso_total) × 100
   - Incluye ambos en el JSON

5. DESCRIPCIÓN: Si falta o es genérica (<20 chars), escribe 1-2 frases apetitosas.

═══ JSON REQUERIDO ════════════════════════════
{
  "descripcion": "...",
  "instrucciones": "1. Paso.\\n2. Paso.\\n3. Paso.",
  "porciones": 1,
  "tiempo_prep_min": 10,
  "tiempo_coccion_min": 20,
  "ingredientes": [
    {
      "nombre": "nombre en español",
      "gramos": 100,
      "kcal_100g": 350,
      "prot_100g": 10,
      "carbs_100g": 50,
      "grasas_100g": 5,
      "fibra_100g": 2
    }
  ],
  "macros_por_porcion": {
    "kcal": 250,
    "proteinas": 20,
    "carbohidratos": 25,
    "grasas": 8,
    "fibra": 3
  },
  "macros_100g": {
    "kcal": 180,
    "proteinas": 14,
    "carbohidratos": 18,
    "grasas": 6,
    "fibra": 2
  }
}`
}

// ── Llamar a DeepSeek ─────────────────────────────────────────────────────────
async function llamarDeepSeek(prompt) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada en .env.local')

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Eres un dietista y chef experto. Revisas y corriges fichas de recetas. Respondes ÚNICAMENTE con JSON válido. Sin markdown, sin texto fuera del JSON.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.15,
            max_tokens: 3500,
        }),
        signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`DeepSeek ${response.status}: ${err.slice(0, 200)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('DeepSeek: sin JSON en respuesta')

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.ingredientes || !parsed.macros_por_porcion) throw new Error('DeepSeek: JSON incompleto')

    return { parsed, tokens: data.usage?.total_tokens || 0 }
}

// ── Actualizar en Supabase ────────────────────────────────────────────────────
async function actualizarReceta(receta, parsed, ingredientesOriginales) {
    const macros = parsed.macros_por_porcion

    // 1. Actualizar campos de la receta
    const { error: updateError } = await supabase.from('recetas').update({
        descripcion: parsed.descripcion || receta.descripcion,
        instrucciones: parsed.instrucciones,
        porciones: parsed.porciones || receta.porciones || 1,
        tiempo_prep_min: parsed.tiempo_prep_min ?? receta.tiempo_prep_min,
        tiempo_coccion_min: parsed.tiempo_coccion_min ?? receta.tiempo_coccion_min,
        kcal: Math.round(macros.kcal || 0),
        proteinas: Math.round((macros.proteinas || 0) * 10) / 10,
        carbohidratos: Math.round((macros.carbohidratos || 0) * 10) / 10,
        grasas: Math.round((macros.grasas || 0) * 10) / 10,
        fibra: Math.round((macros.fibra || 0) * 10) / 10,
    }).eq('id', receta.id)

    if (updateError) throw new Error(`Update receta: ${updateError.message}`)

    // 2. Reemplazar ingredientes si hay correcciones (duplicados, cantidades, orden)
    const ingCorregidos = parsed.ingredientes.filter(i => i.gramos > 0 && i.nombre?.length > 1)
    if (ingCorregidos.length > 0) {
        // Borrar los actuales
        await supabase.from('receta_ingredientes').delete().eq('receta_id', receta.id)

        // Intentar hacer match con alimentos existentes en BD para mantener alimento_id
        const { data: alimentos } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .limit(2000)

        const payloads = ingCorregidos.map((ing, idx) => {
            const nombreNorm = ing.nombre.toLowerCase().trim()
            const match = alimentos?.find(a =>
                a.nombre.toLowerCase().trim() === nombreNorm ||
                a.nombre.toLowerCase().includes(nombreNorm) ||
                nombreNorm.includes(a.nombre.toLowerCase())
            )

            return {
                receta_id: receta.id,
                nombre_libre: ing.nombre,
                cantidad_gramos: ing.gramos,
                alimento_id: match?.id || null,
                orden: idx + 1,
            }
        })

        const { error: insertError } = await supabase.from('receta_ingredientes').insert(payloads)
        if (insertError) throw new Error(`Insert ingredientes: ${insertError.message}`)
    }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🔍 Perfilamiento final de recetas con DeepSeek')
    if (DRY_RUN) console.log('   (dry-run — no se guardará nada)\n')

    // Cargar recetas
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, categoria, instrucciones, descripcion, porciones, tiempo_prep_min, tiempo_coccion_min, kcal, proteinas, carbohidratos, grasas, coach_id')
        .order('nombre')

    if (!recetas?.length) { console.log('❌ No hay recetas'); return }

    // Cargar todos los ingredientes de una sola vez
    const { data: todosIng } = await supabase
        .from('receta_ingredientes')
        .select('receta_id, nombre_libre, cantidad_gramos, alimento_id, orden, alimento:alimento_id(nombre)')
        .order('orden')

    const ingPorReceta = {}
    for (const i of (todosIng || [])) {
        if (!ingPorReceta[i.receta_id]) ingPorReceta[i.receta_id] = []
        ingPorReceta[i.receta_id].push(i)
    }

    // Filtrar recetas a procesar
    let aProcessar = recetas
    if (SLUG_FILTRO) {
        aProcessar = recetas.filter(r => r.nombre.toLowerCase().includes(SLUG_FILTRO.toLowerCase()))
    } else if (!TODAS) {
        aProcessar = recetas.filter(r => {
            const ings = ingPorReceta[r.id] || []
            return necesitaReparacion(detectarProblemas(r, ings))
        })
    }

    if (aProcessar.length === 0) {
        console.log('✅ Todas las recetas están en buen estado.')
        return
    }

    const costeEst = (aProcessar.length * 0.0005).toFixed(3)
    console.log(`📋 Recetas a perfilar: ${aProcessar.length} / ${recetas.length}`)
    console.log(`💰 Coste estimado DeepSeek: ~$${costeEst}\n`)

    let ok = 0, errores = 0, totalTokens = 0

    for (let i = 0; i < aProcessar.length; i++) {
        const receta = aProcessar[i]
        const ingredientes = ingPorReceta[receta.id] || []
        const p = detectarProblemas(receta, ingredientes)

        const flags = [
            p.instrParrafo && '¶párrafo',
            p.instrCorta && '¶corta',
            p.sinMacros && '⚡macros',
            p.duplicados && '🔁duplicados',
            p.ordenIncorrecto && '🔀orden',
            p.cantidadesRaras && '⚖️cantidades',
            p.sinIngredientes && '🥄sin-ing',
            p.sinDescripcion && '📝sin-desc',
        ].filter(Boolean).join(' ')

        console.log(`[${i + 1}/${aProcessar.length}] ${receta.nombre}`)
        console.log(`   ${flags || '(revisión general)'}`)

        if (DRY_RUN) { ok++; continue }

        try {
            const prompt = construirPrompt(receta, ingredientes)
            const { parsed, tokens } = await llamarDeepSeek(prompt)
            totalTokens += tokens

            await actualizarReceta(receta, parsed, ingredientes)

            const pasos = (parsed.instrucciones?.match(/^\s*\d+/gm) || []).length
            const numIng = parsed.ingredientes?.length || 0
            console.log(`   ✅ ${pasos} pasos | ${numIng} ing | ${Math.round(parsed.macros_por_porcion?.kcal || 0)} kcal | ${tokens} tokens\n`)
            ok++
        } catch (err) {
            console.error(`   ❌ ${err.message}\n`)
            errores++
        }

        if (i < aProcessar.length - 1) await new Promise(r => setTimeout(r, 1500))
    }

    console.log('═══════════════════════════════════════════')
    console.log(`  ✅ Perfiladas:  ${ok}`)
    console.log(`  ❌ Errores:     ${errores}`)
    console.log(`  🔤 Tokens:      ${totalTokens.toLocaleString()}`)
    console.log(`  💰 Coste real:  ~$${(totalTokens * 0.00000027).toFixed(4)}`)
    if (DRY_RUN) console.log('\n  (dry-run: nada guardado)')
    console.log('\n  ➡️  Revisa cambios en: localhost:3000/recetas\n')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
