/**
 * Script para enriquecer nutricionalmente todos los alimentos pendientes
 * usando DeepSeek vía Vercel AI SDK.
 *
 * USO: node scripts/enriquecer-alimentos.mjs
 * O carga en lote: node scripts/enriquecer-alimentos.mjs --limite 50
 */

import { createClient } from '@supabase/supabase-js'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ── Leer .env.local ──────────────────────────────────────────────
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!DEEPSEEK_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Faltan variables de entorno. Revisa .env.local')
    process.exit(1)
}

// ── Parsear args ─────────────────────────────────────────────────
const args = process.argv.slice(2)
const LIMITE = parseInt(args.find(a => a.startsWith('--limite'))?.split('=')[1] || '500', 10)
const MODELO = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
const TEMPERATURA = 0.1
const LOTES_POR_VEZ = 25
const MAX_INTENTOS = 3

// ── Inicializar ──────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
process.env.DEEPSEEK_API_KEY = DEEPSEEK_API_KEY
const deepseek = createDeepSeek()

// ── Prompt ────────────────────────────────────────────────────────
function construirPrompt(alimentos) {
    return `Eres un nutricionista experto. Para cada alimento de la lista, debes proporcionar:
1. **categoria_ia**: categoría nutricional precisa (elige de esta lista: Carnes rojas, Carnes blancas, Pescado azul, Pescado blanco, Mariscos, Huevos, Legumbres, Frutos secos y semillas, Lácteos enteros, Lácteos semidesnatados, Lácteos desnatados, Arroces y pastas, Pan y cereales, Patatas y tubérculos, Verduras de hoja verde, Verduras y hortalizas, Frutas frescas, Frutas deshidratadas, Aceites y grasas, Salsas y condimentos, Bebidas, Dulces y bollería, Platos preparados, Suplementos deportivos, Supermercado - Sin clasificar)
2. **calorias**: kcal por 100g
3. **proteinas**: gramos por 100g
4. **carbohidratos**: gramos por 100g
5. **grasas**: gramos por 100g
6. **fibra**: gramos por 100g (0 si no aplica)
7. **confianza**: "alta" si conoces el valor exacto, "media" si es estimación

IMPORTANTE: Responde SOLO con un array JSON válido, sin markdown ni explicaciones.
Usa valores realistas basados en tablas de composición de alimentos españolas (BEDCA).

Alimentos a procesar:
${JSON.stringify(alimentos, null, 2)}

Formato de respuesta (array JSON):
[
  {
    "alimento_id": "uuid",
    "nombre": "nombre del alimento",
    "categoria_ia": "Categoría exacta de la lista",
    "calorias": 0,
    "proteinas": 0,
    "carbohidratos": 0,
    "grasas": 0,
    "fibra": 0,
    "confianza": "alta|media"
  }
]`
}

// ── Enviar lote a DeepSeek ──────────────────────────────────────
async function enriquecerLote(alimentos) {
    const prompt = construirPrompt(alimentos)

    const { text } = await generateText({
        model: deepseek(MODELO),
        prompt,
        temperature: TEMPERATURA,
        maxOutputTokens: 4000,
    })

    // Limpiar markdown code blocks antes de extraer JSON
    const limpio = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

    // Intentar parsear directamente primero
    try {
        const direct = JSON.parse(limpio)
        return Array.isArray(direct) ? direct : [direct]
    } catch { /* sigue con regex */ }

    // Extraer primer array JSON válido del texto
    const arrayMatch = limpio.match(/\[[\s\S]*?\](?=\s*$|\s*\n)/) || limpio.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
        try {
            const parsed = JSON.parse(arrayMatch[0])
            return Array.isArray(parsed) ? parsed : [parsed]
        } catch { /* sigue */ }
    }

    // Extraer objetos JSON individuales y agruparlos
    const objetos = []
    const objRegex = /\{[^{}]*\}/g
    let match
    while ((match = objRegex.exec(limpio)) !== null) {
        try { objetos.push(JSON.parse(match[0])) } catch { /* skip */ }
    }
    if (objetos.length > 0) return objetos

    throw new Error(`No se pudo extraer JSON. Texto: ${text.slice(0, 300)}`)
}

// ── Obtener pendientes ────────────────────────────────────────────
async function obtenerPendientes() {
    // Primero añadimos los alimentos sin macros a la cola
    const { error: colaError } = await supabase.rpc('añadir_a_cola_enriquecimiento', {})
    if (colaError) console.warn('⚠️  add cola:', colaError.message)

    const { data, error, count } = await supabase
        .from('alimentos_pendientes_enriquecer')
        .select('*', { count: 'exact' })
        .limit(LIMITE)
        .order('nombre')

    if (error) throw new Error(`Error al obtener pendientes: ${error.message}`)
    return { alimentos: data ?? [], total: count ?? data?.length ?? 0 }
}

// ── Actualizar en Supabase ────────────────────────────────────────
async function actualizarAlimento(r) {
    const { error } = await supabase.rpc('actualizar_alimento_con_ia', {
        p_alimento_id: r.alimento_id,
        p_categoria_ia: r.categoria_ia,
        p_calorias: r.calorias,
        p_proteinas: r.proteinas,
        p_carbohidratos: r.carbohidratos,
        p_grasas: r.grasas,
        p_fibra: r.fibra ?? null,
        p_resultado_json: JSON.stringify(r),
    })
    return error
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
    console.log('🧬 ENRIQUECIMIENTO NUTRICIONAL CON DEEPSEEK\n')
    console.log(`🔑 DeepSeek API: ${DEEPSEEK_API_KEY.slice(0, 8)}...`)
    console.log(`📡 Supabase: ${SUPABASE_URL}`)
    console.log(`📊 Límite: ${LIMITE} alimentos, lotes de ${LOTES_POR_VEZ}\n`)

    // Obtener pendientes
    const { alimentos, total } = await obtenerPendientes()
    console.log(`📋 Total pendientes en BD: ${total}`)
    console.log(`📋 A procesar ahora: ${alimentos.length}\n`)

    if (alimentos.length === 0) {
        console.log('✅ No hay alimentos pendientes de enriquecer.')
        return
    }

    let procesados = 0
    let actualizados = 0
    let erroresLote = 0
    const inicio = Date.now()
    const totalLotes = Math.ceil(alimentos.length / LOTES_POR_VEZ)

    for (let i = 0; i < alimentos.length; i += LOTES_POR_VEZ) {
        const lote = alimentos.slice(i, i + LOTES_POR_VEZ)
        const numLote = Math.floor(i / LOTES_POR_VEZ) + 1
        const loteParaIA = lote.map(a => ({
            id: a.id,
            nombre: a.nombre,
            categoria_actual: a.categoria,
        }))

        let intentos = 0
        let exito = false

        while (intentos < MAX_INTENTOS && !exito) {
            try {
                process.stdout.write(`  📦 Lote ${numLote}/${totalLotes} (${lote.length} alimentos) — consultando DeepSeek... `)

                const resultados = await enriquecerLote(loteParaIA)
                procesados += resultados.length

                // Actualizar cada uno
                let ok = 0, fail = 0
                for (const r of resultados) {
                    const err = await actualizarAlimento(r)
                    if (err) {
                        fail++
                        console.error(`    ❌ ${r.nombre}: ${err.message}`)
                    } else {
                        ok++
                    }
                }

                actualizados += ok
                erroresLote += fail

                const elapsed = ((Date.now() - inicio) / 1000).toFixed(1)
                process.stdout.clearLine?.()
                process.stdout.cursorTo?.(0)
                console.log(`  ✅ Lote ${numLote}/${totalLotes}: ${ok} OK, ${fail} errores (${elapsed}s)`)

                exito = true

                // Pausa entre lotes
                if (i + LOTES_POR_VEZ < alimentos.length) {
                    await new Promise(r => setTimeout(r, 800))
                }
            } catch (err) {
                intentos++
                const msg = err instanceof Error ? err.message : String(err)
                process.stdout.write(`❌ (intento ${intentos}/${MAX_INTENTOS}): ${msg.slice(0, 80)}\n`)
                if (intentos >= MAX_INTENTOS) {
                    erroresLote++
                    console.error(`    ❌ Lote ${numLote} falló tras ${MAX_INTENTOS} intentos`)
                } else {
                    await new Promise(r => setTimeout(r, 2000 * intentos))
                }
            }
        }
    }

    const duracion = ((Date.now() - inicio) / 1000).toFixed(1)

    console.log(`\n📊 RESULTADO FINAL`)
    console.log(`   ⏱  Duración: ${duracion}s`)
    console.log(`   ✅ Procesados: ${procesados}`)
    console.log(`   💾 Actualizados: ${actualizados}`)
    console.log(`   ❌ Errores: ${erroresLote}`)

    // Verificar estado final
    const { count: restantes } = await supabase
        .from('alimentos_pendientes_enriquecer')
        .select('*', { count: 'exact', head: true })

    const { count: completados } = await supabase
        .from('alimentos_enriquecimiento_cola')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'completado')

    console.log(`   📋 Pendientes restantes: ${restantes ?? '?'}`)
    console.log(`   ✅ Completados totales: ${completados ?? '?'}`)

    if (restantes > 0) {
        console.log(`\n⚠️  Quedan ${restantes} alimentos pendientes.`)
        console.log(`   Vuelve a ejecutar: node scripts/enriquecer-alimentos.mjs`)
    } else {
        console.log(`\n🎉 ¡Todos los alimentos enriquecidos!`)
    }
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})
