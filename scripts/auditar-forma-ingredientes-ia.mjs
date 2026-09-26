/**
 * auditar-forma-ingredientes-ia.mjs
 *
 * Auditoría read-only semántica (petición de Carlos, 26-09-2026): detecta recetas donde
 * el ingrediente vinculado tiene una FORMA distinta a la que implican las instrucciones
 * (ej: "avena" mezclada para hacer una masa homogénea de tortitas → debería ser harina de
 * avena, no copos enteros; "tomate" en un sofrito que se cuece 20 min → no debería ser
 * "tomate cherry fresco" si la instrucción pide triturado, etc). No cubierto por T18
 * (que solo detecta patrones fijos tipo base→procesado o 0kcal) — aquí se usa DeepSeek
 * para comparar semánticamente instrucciones vs ingrediente vinculado.
 *
 * USO:
 *   node scripts/auditar-forma-ingredientes-ia.mjs                 # todas las recetas aprobadas
 *   node scripts/auditar-forma-ingredientes-ia.mjs --limite=50      # solo las primeras 50
 *
 * NO modifica la base de datos. Genera salidas/auditoria-forma-ingredientes-FECHA.json
 */

import { createClient } from '@supabase/supabase-js'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(projectRoot, '.env.local')
    const env = {}
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
        if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
    }
    return env
}
const env = loadEnv()

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
const deepseek = createDeepSeek()
const MODELO = env.DEEPSEEK_MODEL || 'deepseek-chat'

const args = process.argv.slice(2)
const LIMITE = parseInt(args.find(a => a.startsWith('--limite='))?.split('=')[1] || '0', 10)
const LOTE = 8

function construirPrompt(recetas) {
    return `Eres un chef y nutricionista experto revisando un recetario digital. Para cada receta, compara los INGREDIENTES VINCULADOS (nombre real de la base de datos) contra lo que las INSTRUCCIONES de preparación implican. Busca SOLO casos donde la FORMA/PREPARACIÓN del ingrediente vinculado es claramente incompatible con lo que describen los pasos (ejemplos reales de este recetario):
- Instrucciones piden mezclar/batir hasta "masa homogénea" o "líquida" con un ingrediente que en la base de datos es un producto entero/en trozos/en copos sin moler (ej: avena en copos cuando debería ser harina de avena para que la masa sea lisa).
- Instrucciones piden "triturar" o "batir" un ingrediente que en la base de datos aparece como producto ya troceado/preparado de otra forma incompatible.
- Instrucciones piden un ingrediente "cocido"/"hervido" pero está vinculado a la versión "cruda" (o viceversa cuando eso cambia mucho el peso/textura).
- Instrucciones piden explícitamente una textura (molido, en polvo, licuado, rallado) que el alimento vinculado no tiene.

ADEMÁS busca este otro tipo de problema, distinto del anterior:
- INGREDIENTE DE TÉCNICA QUE NO SE INGIERE: el ingrediente se usa solo como ayuda de cocción y se descarta (ej: "chorrito de vinagre" en el agua para escalfar un huevo — se tira el agua; sal/aceite en agua de hervir pasta que no se absorbe significativamente; papel de horno). Si las instrucciones dejan claro que ese ingrediente se añade al agua/aceite de cocción y NO se sirve ni se come, repórtalo con "problema": "no_se_ingiere" y "sugerencia": "eliminar_ingrediente" (no hace falta sustituto, se debe quitar de la receta).

NO reportes diferencias triviales de marca, de "extra virgen" vs "virgen", ni sinónimos razonables. Solo reporta cuando un cocinero real notaría que el resultado de la receta NO saldría bien con ese ingrediente tal cual está vinculado, o cuando el ingrediente claramente no se come.

IMPORTANTE: Responde SOLO con un array JSON válido (puede estar vacío si no hay problemas), sin markdown ni explicaciones.

Recetas a revisar:
${JSON.stringify(recetas, null, 2)}

Formato de respuesta (array JSON, un item por CADA problema encontrado, omite recetas sin problemas):
[
  {
    "receta_id": "uuid",
    "receta_nombre": "nombre",
    "ingrediente_id": "uuid del receta_ingrediente",
    "nombre_libre": "como aparece en la receta",
    "alimento_vinculado": "nombre del alimento en BD",
    "tipo": "forma_incorrecta" | "no_se_ingiere",
    "problema": "explicación breve",
    "sugerencia": "qué forma/alimento debería ser en su lugar, o 'eliminar_ingrediente' si no_se_ingiere"
  }
]`
}

async function auditarLote(recetas) {
    const prompt = construirPrompt(recetas)
    const { text } = await generateText({
        model: deepseek(MODELO),
        prompt,
        temperature: 0.1,
        maxOutputTokens: 4000,
    })
    if (!text || !text.trim()) return []
    let jsonStr = text.trim()
    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    jsonStr = jsonStr.slice(start, end + 1)
    try {
        return JSON.parse(jsonStr)
    } catch {
        console.log('  ⚠️  Error parseando respuesta de un lote, se omite.')
        return []
    }
}

async function main() {
    console.log(`🔍 Auditoría IA — forma de ingredientes vs instrucciones — ${new Date().toISOString().split('T')[0]}`)

    let query = supabase
        .from('recetas')
        .select('id, nombre, instrucciones')
        .eq('estado', 'aprobada')
        .order('created_at', { ascending: false })
    if (LIMITE > 0) query = query.limit(LIMITE)

    const { data: recetas, error } = await query
    if (error) { console.error('❌', error.message); process.exit(1) }
    console.log(`📦 ${recetas.length} recetas aprobadas a revisar (lotes de ${LOTE})`)

    const hallazgos = []
    let procesadas = 0

    for (let i = 0; i < recetas.length; i += LOTE) {
        const lote = recetas.slice(i, i + LOTE)
        const ids = lote.map(r => r.id)

        const { data: ingredientes } = await supabase
            .from('receta_ingredientes')
            .select('id, receta_id, nombre_libre, alimento:alimento_id(nombre)')
            .in('receta_id', ids)

        const porReceta = new Map(lote.map(r => [r.id, { id: r.id, nombre: r.nombre, instrucciones: r.instrucciones, ingredientes: [] }]))
        for (const ing of ingredientes || []) {
            const r = porReceta.get(ing.receta_id)
            if (!r || !ing.alimento) continue
            r.ingredientes.push({ ingrediente_id: ing.id, nombre_libre: ing.nombre_libre, alimento_vinculado: ing.alimento.nombre })
        }

        const payload = [...porReceta.values()].filter(r => r.ingredientes.length > 0)
        if (payload.length === 0) { procesadas += lote.length; continue }

        try {
            const resultado = await auditarLote(payload)
            if (Array.isArray(resultado) && resultado.length > 0) {
                hallazgos.push(...resultado)
                console.log(`  ⚠️  ${resultado.length} hallazgo(s) en este lote`)
            }
        } catch (e) {
            console.log(`  ❌ Error en lote: ${e.message}`)
        }

        procesadas += lote.length
        process.stdout.write(`\r   Procesadas ${procesadas}/${recetas.length} recetas...`)
    }
    console.log('')

    const hoy = new Date().toISOString().split('T')[0]
    const outputDir = resolve(projectRoot, 'salidas')
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
    const outputPath = resolve(outputDir, `auditoria-forma-ingredientes-${hoy}.json`)
    writeFileSync(outputPath, JSON.stringify({ fecha: hoy, total_recetas: recetas.length, total_hallazgos: hallazgos.length, hallazgos }, null, 2))

    console.log(`\n📊 RESULTADOS`)
    console.log(`   Recetas revisadas: ${recetas.length}`)
    console.log(`   Hallazgos: ${hallazgos.length}`)
    console.log(`\n📁 Reporte completo: ${outputPath}`)

    for (const h of hallazgos) {
        console.log(`\n   Receta: ${h.receta_nombre}`)
        console.log(`   "${h.nombre_libre}" → "${h.alimento_vinculado}"`)
        console.log(`   Problema: ${h.problema}`)
        console.log(`   Sugerencia: ${h.sugerencia}`)
    }
}

main().catch(console.error)
