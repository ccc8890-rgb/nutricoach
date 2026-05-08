/**
 * fix-ingredients-ia.ts
 *
 * Script INTELIGENTE que usa DeepSeek para vincular ingredientes huérfanos.
 *
 * ¿Qué hace?
 * 1. Obtiene TODOS los ingredientes sin alimento_id
 * 2. Para cada nombre único, obtiene el contexto: receta, categoría, otros ingredientes
 * 3. Envía a DeepSeek un lote para que determine:
 *    a) Si existe un alimento en la BD que coincida (sin importar plural/singular/variante)
 *    b) Si no existe, propone crear uno nuevo con valores nutricionales contrastados
 * 4. Ejecuta automáticamente: linkea o crea el alimento
 *
 * USO: npx tsx scripts/fix-ingredients-ia.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

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

// ── Interfaces ────────────────────────────────────────────────────────────────

interface AlimentoInfo {
    id: string
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
    fibra: number
    categoria: string
}

interface OrphanInfo {
    nombre_libre: string
    cantidad_gramos: number
    receta_nombre: string
    receta_categoria: string
    otros_ingredientes: string[]
}

interface IARecomendacion {
    ingrediente_original: string
    /** null = es cabecera/sección, poner cantidad_gramos=0 */
    es_cabecera: boolean
    /** ID del alimento existente en la BD si hay match */
    alimento_existente_id: string | null
    /** Nombre del alimento existente (para verificación) */
    alimento_existente_nombre: string | null
    /** Si no existe, datos para crearlo */
    nuevo_alimento: {
        nombre: string
        calorias: number
        proteinas: number
        carbohidratos: number
        grasas: number
        fibra: number
        categoria: string
    } | null
    /** Explicación de la decisión */
    justificacion: string
}

// ── Llamada a DeepSeek ────────────────────────────────────────────────────────

async function llamarDeepSeek(prompt: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada en .env.local')

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Eres un coach nutricional experto con acceso a tablas de composición de alimentos (BEDCA, USDA, CESNID).
Respondes SIEMPRE en español, SOLO con JSON válido, nunca con markdown ni texto adicional.

REGLAS:
- Si el ingrediente es una cabecera de sección (ej: "para la salsa", "para el montaje"), marca es_cabecera:true
- Si existe un alimento equivalente en la BD, devuelve su ID y nombre
- Si no existe exactamente, busca el MÁS SIMILAR (misma base alimenticia)
- Si no hay ningún match aceptable, propón crear uno nuevo con valores nutricionales REALES contrastados
- Para plurales/singulares/variantes, considera equivalente (ej: "fresas" = "Fresa", "cebolla" = "Cebolla cruda")
- Para ingredientes con preparación (ej: "garbanzos cocidos", "guisantes congelados cocidos"), busca el alimento base más cercano`
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 4000,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    // Extraer JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
        // Intentar con objeto individual
        const singleMatch = content.match(/\{[\s\S]*\}/)
        if (!singleMatch) throw new Error(`DeepSeek: respuesta no contiene JSON. Content: ${content.slice(0, 300)}`)
        return singleMatch[0]
    }
    return jsonMatch[0]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🤖 fix-ingredients-ia.ts — Usando DeepSeek para vincular ingredientes inteligentemente\n')

    // 1. Obtener todos los ingredientes huérfanos
    const { data: orphans, error: e1 } = await supabase
        .from('receta_ingredientes')
        .select('id, receta_id, nombre_libre, cantidad_gramos')
        .is('alimento_id', null)

    if (e1) { console.error('Error obteniendo huérfanos:', e1); return }
    if (!orphans || orphans.length === 0) {
        console.log('✅ No hay ingredientes huérfanos. Todo está vinculado.')
        return
    }

    console.log(`📊 Total ingredientes huérfanos: ${orphans.length}`)

    // 2. Obtener todos los alimentos de la BD para contexto
    const { data: allAlimentos } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra, categoria')
        .order('nombre')

    const alimentosBD: AlimentoInfo[] = allAlimentos ?? []
    console.log(`📚 Alimentos en BD: ${alimentosBD.length}`)

    // 3. Agrupar por nombre normalizado para enviar contexto único
    const nameGroups: Record<string, typeof orphans> = {}
    for (const o of orphans) {
        const key = o.nombre_libre.toLowerCase().trim()
        if (!nameGroups[key]) nameGroups[key] = []
        nameGroups[key].push(o)
    }

    // 4. Obtener contexto de recetas para cada grupo
    const uniqueNames = Object.keys(nameGroups)
    console.log(`🔤 Nombres únicos a resolver: ${uniqueNames.length}\n`)

    // Obtener todas las recetas involucradas
    const recipeIds = [...new Set(orphans.map(o => o.receta_id))]
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, categoria')
        .in('id', recipeIds)

    const recetaMap: Record<string, { nombre: string; categoria: string }> = {}
    for (const r of recetas || []) {
        recetaMap[r.id] = { nombre: r.nombre, categoria: r.categoria || '' }
    }

    // Obtener ingredientes vinculados de esas recetas para contexto
    const { data: ingredientesVinculados } = await supabase
        .from('receta_ingredientes')
        .select('receta_id, nombre_libre, alimento_id')
        .in('receta_id', recipeIds)
        .not('alimento_id', 'is', null)

    const ingredientesPorReceta: Record<string, string[]> = {}
    for (const ing of ingredientesVinculados || []) {
        if (!ingredientesPorReceta[ing.receta_id]) ingredientesPorReceta[ing.receta_id] = []
        ingredientesPorReceta[ing.receta_id].push(ing.nombre_libre)
    }

    // 5. Construir el contexto para DeepSeek
    const orphansContext = uniqueNames.map(nombre => {
        const records = nameGroups[nombre]
        const first = records[0]
        const receta = recetaMap[first.receta_id]
        return {
            nombre_libre: first.nombre_libre,
            cantidad_gramos: first.cantidad_gramos,
            receta_nombre: receta?.nombre || 'desconocida',
            receta_categoria: receta?.categoria || 'general',
            otros_ingredientes: ingredientesPorReceta[first.receta_id] || [],
            ocurrencias: records.length,
        }
    })

    // Lista resumida de alimentos BD para el prompt
    const alimentosResumen = alimentosBD.map(a => ({
        id: a.id,
        nombre: a.nombre,
        calorias_100g: a.calorias,
        categoria: a.categoria,
    }))

    const prompt = `Analiza estos ingredientes de recetas y determina su equivalente nutricional.

INSTRUCCIONES:
- Revisa cada ingrediente contra la lista de alimentos disponibles en la BD.
- Si EXISTE un match (mismo alimento, variante, plural, sinónimo), devuelve su ID.
- Si NO existe pero hay uno MUY SIMILAR (ej: "almendras" → "Almendra cruda"), usa ese.
- Si es una CABECERA DE SECCIÓN (para la salsa, para el montaje), marca es_cabecera:true.
- Si NO hay ningún match aceptable, propón crear uno nuevo con valores nutricionales REALES (contrastados con BEDCA/USDA).
- No inventes valores nutricionales. Usa datos reales de tablas oficiales.

ALIMENTOS DISPONIBLES EN BD (${alimentosBD.length} totales):
${JSON.stringify(alimentosResumen.slice(0, 200), null, 2)}

INGREDIENTES A RESOLVER (${orphansContext.length}):
${JSON.stringify(orphansContext, null, 2)}

Responde SOLO con un array JSON. Cada elemento debe tener esta estructura:
{
  "ingrediente_original": "nombre exacto del ingrediente",
  "es_cabecera": false,
  "alimento_existente_id": "uuid o null",
  "alimento_existente_nombre": "nombre del match o null",
  "nuevo_alimento": { "nombre": "...", "calorias": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "fibra": 0, "categoria": "..." } | null,
  "justificacion": "explicación breve de la decisión"
}`

    console.log('🌐 Consultando a DeepSeek...\n')
    const rawJson = await llamarDeepSeek(prompt)

    let recomendaciones: IARecomendacion[]
    try {
        recomendaciones = JSON.parse(rawJson)
        if (!Array.isArray(recomendaciones)) {
            recomendaciones = [recomendaciones]
        }
    } catch (e) {
        console.error('Error parseando respuesta de DeepSeek:', e)
        console.log('Respuesta raw:', rawJson.slice(0, 500))
        return
    }

    console.log(`✅ DeepSeek respondió con ${recomendaciones.length} recomendaciones\n`)

    // 6. Ejecutar las acciones
    let linkeados = 0
    let creados = 0
    let cabeceras = 0
    let errores = 0

    for (const rec of recomendaciones) {
        const records = nameGroups[rec.ingrediente_original.toLowerCase().trim()]
        if (!records) {
            console.warn(`⚠️ No se encontraron registros para "${rec.ingrediente_original}"`)
            continue
        }

        if (rec.es_cabecera) {
            // Poner cantidad_gramos=0 para que no afecte macros
            for (const r of records) {
                await supabase.from('receta_ingredientes').update({ cantidad_gramos: 0 }).eq('id', r.id)
            }
            cabeceras += records.length
            console.log(`⏭️ CABECERA: "${rec.ingrediente_original}" → 0g (${records.length} record(s))`)
            continue
        }

        if (rec.alimento_existente_id) {
            // Vincular a alimento existente
            for (const r of records) {
                await supabase.from('receta_ingredientes').update({
                    alimento_id: rec.alimento_existente_id,
                    nombre_libre: rec.alimento_existente_nombre || rec.ingrediente_original,
                }).eq('id', r.id)
            }
            linkeados += records.length
            console.log(`✅ VINCULADO: "${rec.ingrediente_original}" → "${rec.alimento_existente_nombre}" (${records.length} record(s))`)
            console.log(`   └─ ${rec.justificacion}`)
            continue
        }

        if (rec.nuevo_alimento) {
            // Crear nuevo alimento y vincular
            const { data: nuevo, error: err } = await supabase.from('alimentos').insert({
                nombre: rec.nuevo_alimento.nombre,
                calorias: rec.nuevo_alimento.calorias,
                proteinas: rec.nuevo_alimento.proteinas,
                carbohidratos: rec.nuevo_alimento.carbohidratos,
                grasas: rec.nuevo_alimento.grasas,
                fibra: rec.nuevo_alimento.fibra,
                categoria: rec.nuevo_alimento.categoria || 'Otros',
                created_at: new Date().toISOString(),
            }).select('id').single()

            if (err || !nuevo) {
                console.error(`❌ Error creando "${rec.nuevo_alimento.nombre}":`, err)
                errores++
                continue
            }

            for (const r of records) {
                await supabase.from('receta_ingredientes').update({
                    alimento_id: nuevo.id,
                    nombre_libre: rec.nuevo_alimento.nombre,
                }).eq('id', r.id)
            }
            creados += records.length
            console.log(`🆕 CREADO + VINCULADO: "${rec.ingrediente_original}" → NUEVO "${rec.nuevo_alimento.nombre}" (${records.length} record(s))`)
            console.log(`   └─ ${JSON.stringify(rec.nuevo_alimento)}`)
            console.log(`   └─ ${rec.justificacion}`)
            continue
        }

        console.warn(`⚠️ INACCIÓN: "${rec.ingrediente_original}" — sin acción definida`)
        errores++
    }

    // 7. Recalcular macros de todas las recetas afectadas
    console.log(`\n📊 Resumen:`)
    console.log(`   ✅ Vinculados: ${linkeados}`)
    console.log(`   🆕 Creados: ${creados}`)
    console.log(`   ⏭️ Cabeceras: ${cabeceras}`)
    console.log(`   ❌ Errores: ${errores}`)

    const allAffectedIds = [...new Set(orphans.map(o => o.receta_id))]
    console.log(`\n📊 Recalculando macros de ${allAffectedIds.length} recetas...`)

    for (const rid of allAffectedIds) {
        const { data: ingredientes } = await supabase
            .from('receta_ingredientes')
            .select('alimento_id, cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
            .eq('receta_id', rid)

        const { data: receta } = await supabase
            .from('recetas')
            .select('nombre, porciones')
            .eq('id', rid)
            .single()

        if (!receta) continue

        let totalKcal = 0, totalP = 0, totalC = 0, totalG = 0, totalFibra = 0
        for (const ing of ingredientes || []) {
            const al = ing.alimento as unknown as AlimentoInfo | null
            if (al && ing.cantidad_gramos > 0) {
                const factor = ing.cantidad_gramos / 100
                totalKcal += (al.calorias || 0) * factor
                totalP += (al.proteinas || 0) * factor
                totalC += (al.carbohidratos || 0) * factor
                totalG += (al.grasas || 0) * factor
                totalFibra += (al.fibra || 0) * factor
            }
        }

        const porciones = receta.porciones || 1
        await supabase.from('recetas').update({
            kcal: Math.round(totalKcal * 100) / 100,
            proteinas: Math.round(totalP * 100) / 100,
            carbohidratos: Math.round(totalC * 100) / 100,
            grasas: Math.round(totalG * 100) / 100,
            fibra: Math.round(totalFibra * 100) / 100,
            kcal_por_porcion: Math.round((totalKcal / porciones) * 100) / 100,
            proteinas_por_porcion: Math.round((totalP / porciones) * 100) / 100,
            carbohidratos_por_porcion: Math.round((totalC / porciones) * 100) / 100,
            grasas_por_porcion: Math.round((totalG / porciones) * 100) / 100,
        }).eq('id', rid)

        console.log(`   📊 ${receta.nombre || rid}: ${Math.round(totalKcal)} kcal total (${Math.round(totalKcal / porciones)}/porción)`)
    }

    console.log(`\n✅ Proceso completado.`)
    console.log(`   Total ingredientes procesados: ${linkeados + creados + cabeceras}`)
    console.log(`   Si hay errores, revísalos manualmente.`)
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
