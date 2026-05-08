/**
 * revisar-recetas-cola-ia.ts
 *
 * Script INTELIGENTE que usa DeepSeek para revisar, estandarizar y aprobar
 * las 34 recetas en cola (en_revision).
 *
 * ¿Qué hace?
 * 1. Obtiene TODAS las recetas en cola con sus ingredientes
 * 2. Envía lote a DeepSeek para que:
 *    a) Reformatee instrucciones (1 paso por línea)
 *    b) Corrija categorías a valores estándar
 *    c) Corrija dificultad, tipo_coccion, tipo_plato
 *    d) Escriba descripciones profesionales
 *    e) Corrija cantidades de ingredientes absurdas
 *    f) Normalice nombres de ingredientes
 * 3. Aplica cambios en BD
 * 4. Aprueba recetas (estado = 'aprobada')
 *
 * USO: npx tsx scripts/revisar-recetas-cola-ia.ts
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

// ── Valores estándar del recetario ────────────────────────────────────────────

const CATEGORIAS_VALIDAS = ['Cena', 'Comida', 'Desayuno', 'Dulce', 'Merienda', 'Postre', 'Snack']
const DIFICULTADES_VALIDAS = ['Fácil', 'Medio']
const TIPOS_COCCION_VALIDOS = ['Hervido', 'Horno', 'Horno/Airfryer', 'Microondas', 'No Bake', 'Olla', 'Parrilla', 'Plancha', 'Sartén', 'Sartén/Wok']
const TIPOS_PLATO_VALIDOS = ['Postre', 'Desayuno', 'Comida', 'Cena', 'Snack', 'Merienda', 'Almuerzo']

// ── Interfaces ────────────────────────────────────────────────────────────────

interface RecetaEnCola {
    id: string
    nombre: string
    categoria: string | null
    dificultad: string | null
    tiempo_coccion_min: number | null
    tipo_coccion: string | null
    tipo_plato: string | null
    descripcion: string | null
    instrucciones: string | null
    url_origen: string | null
    porciones: number | null
}

interface IngredienteInfo {
    id: string
    nombre_libre: string
    cantidad_gramos: number
    alimento_id: string | null
}

interface RecetaParaIA {
    id: string
    nombre: string
    categoria_actual: string | null
    dificultad_actual: string | null
    tiempo_coccion_min: number | null
    tipo_coccion_actual: string | null
    tipo_plato_actual: string | null
    descripcion_actual: string | null
    url_origen: string | null
    porciones: number | null
    instrucciones_actual: string | null
    ingredientes: { nombre: string; gramos: number }[]
}

interface IARevisionReceta {
    receta_id: string
    nombre: string
    categoria: string
    dificultad: string
    tipo_coccion: string
    tipo_plato: string
    descripcion: string
    porciones: number
    instrucciones: string  // Cada paso en línea separada, numerado
    consejos: string | null   // Notas, trucos, consejos opcionales del chef
    ingredientes: {
        nombre: string          // Nombre normalizado
        gramos: number          // Cantidad corregida (realista)
    }[]
    justificacion: string
}

// ── Llamada a DeepSeek ────────────────────────────────────────────────────────

async function llamarDeepSeek(prompt: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada en .env.local')

    console.log(`   Enviando prompt (${prompt.length} chars)...`)

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
                    content: `Eres un chef nutricional experto que revisa y estandariza recetas para una base de datos de recetas saludables.

Respondes SIEMPRE en español, SOLO con JSON válido, nunca con markdown ni texto adicional.

REGLAS ESTRICTAS:
1. Cada paso de instrucciones debe ir en su propia línea numerada (1., 2., 3., etc.) - NUNCA varios pasos en una línea.
2. Las categorías válidas son SOLO: Cena, Comida, Desayuno, Dulce, Merienda, Postre, Snack
3. Las dificultades válidas son SOLO: Fácil, Medio
4. Los tipos de cocción válidos son SOLO: Hervido, Horno, Horno/Airfryer, Microondas, No Bake, Olla, Parrilla, Plancha, Sartén, Sartén/Wok
5. Los tipos de plato válidos son SOLO: Postre, Desayuno, Comida, Cena, Snack, Merienda, Almuerzo
6. Las cantidades de ingredientes deben ser REALISTAS (ej: pimienta 1-5g, no 100g; sal 1-5g, no 100g; canela 1-5g, no 100g)
7. La descripción debe ser profesional y atractiva (2-3 frases)
8. Si una receta tiene URL de Instagram, úsala como referencia en tu conocimiento
9. Si una receta no tiene instrucciones o ingredientes, estima unas realistas basadas en el nombre y la URL
10. Normaliza nombres de ingredientes (ej: "Pimienta" → "Pimienta negra molida" si aplica)
11. Añade consejos/trucos/notas del chef donde sea relevante (variaciones, sustituciones, trucos para mejorar el resultado, cómo conservar, etc.)`
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.15,
            max_tokens: 8000,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error(`   HTTP ${response.status}: ${errorText.slice(0, 500)}`)
        throw new Error(`DeepSeek API error ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
        console.error('   Respuesta completa:', JSON.stringify(data).slice(0, 500))
        throw new Error('DeepSeek: respuesta vacía')
    }

    // 1. Intentar parse directo
    try {
        const parsed = JSON.parse(content)
        return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed])
    } catch {
        // 2. Intentar extraer [ ... ]
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0])
                return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed])
            } catch { }
        }

        // 3. Buscar objetos individuales { ... } y reconstruir array
        const objs: string[] = []
        let depth = 0
        let start = -1
        for (let i = 0; i < content.length; i++) {
            if (content[i] === '{') {
                if (depth === 0) start = i
                depth++
            } else if (content[i] === '}') {
                depth--
                if (depth === 0 && start >= 0) {
                    objs.push(content.slice(start, i + 1))
                    start = -1
                }
            }
        }

        if (objs.length > 0) {
            const reconstruido = '[' + objs.join(',') + ']'
            try {
                const parsed = JSON.parse(reconstruido)
                return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed])
            } catch (e) {
                // Intentar reparar objetos individuales
                const reparados = objs.map(o => {
                    let r = o
                    // Si falta una coma entre campos
                    r = r.replace(/"\s*"/g, '","')
                    // Asegurar que termina en }
                    if (!r.endsWith('}')) r += '}'
                    return r
                })
                const reparado = '[' + reparados.join(',') + ']'
                try {
                    const parsed = JSON.parse(reparado)
                    return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed])
                } catch {
                    throw new Error(`DeepSeek: respuesta no contiene JSON válido. Primeros 400 chars: ${content.slice(0, 400)}`)
                }
            }
        }

        throw new Error(`DeepSeek: respuesta no contiene JSON. Primeros 400 chars: ${content.slice(0, 400)}`)
    }
}

/**
 * Procesa un lote de recetas contra DeepSeek
 */
async function procesarLote(lote: RecetaParaIA[], batchNum: number, totalBatches: number): Promise<IARevisionReceta[]> {
    console.log(`\n📦 Lote ${batchNum}/${totalBatches} (${lote.length} recetas)`)

    const prompt = `Revisa y estandariza estas ${lote.length} recetas para nuestra base de datos de recetas saludables.

INSTRUCCIONES:
- Reformatea las instrucciones: CADA PASO en su propia línea numerada (1., 2., 3., etc.).
  NUNCA combines múltiples pasos en una línea separados por punto.
  Ejemplo CORRECTO:
  1. Precalienta el horno a 180°C.
  2. Mezcla la harina con los huevos.
  3. Hornea durante 20 minutos.
  Ejemplo INCORRECTO:
  1. Precalienta el horno. 2. Mezcla la harina. 3. Hornea.

- Asigna la categoría correcta de: ${CATEGORIAS_VALIDAS.join(', ')}
- Asigna la dificultad correcta de: ${DIFICULTADES_VALIDAS.join(', ')}
- Asigna el tipo de cocción correcto de: ${TIPOS_COCCION_VALIDOS.join(', ')}
- Asigna el tipo de plato correcto de: ${TIPOS_PLATO_VALIDOS.join(', ')}
- CORRIGE las cantidades de ingredientes a valores REALISTAS (pimienta 1-5g, no 100g; sal 1-5g, no 100g; etc.)
- Escribe una descripción profesional y atractiva (2-3 frases)
- Si faltan instrucciones o ingredientes, estima unos realistas basados en el nombre de la receta
- Normaliza nombres de ingredientes según la BD estándar
- Añade consejos/trucos/notas del chef donde sea relevante

RECETAS:
${JSON.stringify(lote, null, 2)}

Responde SOLO con un array JSON. Cada elemento:
{
  "receta_id": "uuid",
  "nombre": "nombre",
  "categoria": "...",
  "dificultad": "Fácil|Medio",
  "tipo_coccion": "...",
  "tipo_plato": "...",
  "descripcion": "2-3 frases profesionales",
  "porciones": número,
  "instrucciones": "1. Paso uno.\\n2. Paso dos.",
  "consejos": "Consejo del chef o null",
  "ingredientes": [{ "nombre": "...", "gramos": número }],
  "justificacion": "breve explicación"
}`

    const rawJson = await llamarDeepSeek(prompt)

    let revisiones: IARevisionReceta[]
    try {
        revisiones = JSON.parse(rawJson)
        if (!Array.isArray(revisiones)) revisiones = [revisiones]
    } catch (e) {
        console.error('Error parseando respuesta:', e)
        console.log('Raw:', rawJson.slice(0, 500))
        return []
    }

    console.log(`   → ${revisiones.length} recetas revisadas`)
    return revisiones
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🤖 revisar-recetas-cola-ia.ts — Revisando y estandarizando recetas en cola con DeepSeek\n')

    // 1. Obtener recetas en cola
    const { data: cola } = await supabase
        .from('recetas')
        .select('id, nombre, categoria, dificultad, tiempo_coccion_min, tipo_coccion, tipo_plato, descripcion, instrucciones, url_origen, porciones')
        .eq('estado', 'en_revision')
        .order('created_at', { ascending: false })

    if (!cola || cola.length === 0) {
        console.log('✅ No hay recetas en cola.')
        return
    }

    console.log(`📊 Recetas en cola: ${cola.length}\n`)

    // 2. Obtener ingredientes de cada receta
    const recetasCompletas: RecetaParaIA[] = []

    for (const r of cola) {
        const { data: ings } = await supabase
            .from('receta_ingredientes')
            .select('id, nombre_libre, cantidad_gramos, alimento_id')
            .eq('receta_id', r.id)
            .order('id')

        recetasCompletas.push({
            id: r.id,
            nombre: r.nombre || 'Sin nombre',
            categoria_actual: r.categoria,
            dificultad_actual: r.dificultad,
            tiempo_coccion_min: r.tiempo_coccion_min,
            tipo_coccion_actual: r.tipo_coccion,
            tipo_plato_actual: r.tipo_plato,
            descripcion_actual: r.descripcion,
            url_origen: r.url_origen,
            porciones: r.porciones,
            instrucciones_actual: r.instrucciones,
            ingredientes: (ings || []).map(i => ({
                nombre: i.nombre_libre,
                gramos: i.cantidad_gramos,
            })),
        })
    }

    // 3. Dividir en lotes y enviar a DeepSeek
    const BATCH_SIZE = 4
    const lotes: RecetaParaIA[][] = []
    for (let i = 0; i < recetasCompletas.length; i += BATCH_SIZE) {
        lotes.push(recetasCompletas.slice(i, i + BATCH_SIZE))
    }

    console.log(`🌐 Consultando a DeepSeek en ${lotes.length} lotes...\n`)

    const todasRevisiones: IARevisionReceta[] = []
    for (let i = 0; i < lotes.length; i++) {
        const revisiones = await procesarLote(lotes[i], i + 1, lotes.length)
        todasRevisiones.push(...revisiones)
        // Pequeña pausa entre lotes para no saturar la API
        if (i < lotes.length - 1) {
            console.log('   Esperando 2s antes del siguiente lote...')
            await new Promise(r => setTimeout(r, 2000))
        }
    }

    console.log(`\n✅ DeepSeek respondió con ${todasRevisiones.length} revisiones en total\n`)
    const revisiones = todasRevisiones

    // 4. Aplicar cambios a cada receta
    let aprobadas = 0
    let errores = 0
    let ingredientesActualizados = 0

    for (const rev of revisiones) {
        try {
            // 4a. Actualizar metadatos de la receta
            const updateData: Record<string, any> = {
                categoria: rev.categoria,
                dificultad: rev.dificultad,
                tipo_coccion: rev.tipo_coccion,
                tipo_plato: rev.tipo_plato,
                descripcion: rev.descripcion,
                instrucciones: rev.instrucciones,
                consejos: rev.consejos || null,
                porciones: rev.porciones,
                estado: 'aprobada',
            }

            // Mantener url_origen original si existe
            const original = recetasCompletas.find(r => r.id === rev.receta_id)
            if (original?.url_origen) {
                updateData.url_origen = original.url_origen
            }

            const { error: errReceta } = await supabase
                .from('recetas')
                .update(updateData)
                .eq('id', rev.receta_id)

            if (errReceta) {
                console.error(`❌ Error actualizando receta "${rev.nombre}":`, errReceta)
                errores++
                continue
            }

            // 4b. Verificar ingredientes actuales
            const { data: ingsActuales } = await supabase
                .from('receta_ingredientes')
                .select('id, nombre_libre, cantidad_gramos')
                .eq('receta_id', rev.receta_id)
                .order('id')

            // 4c. Actualizar cada ingrediente según la revisión
            if (ingsActuales && rev.ingredientes) {
                for (let i = 0; i < Math.min(ingsActuales.length, rev.ingredientes.length); i++) {
                    const actual = ingsActuales[i]
                    const revisado = rev.ingredientes[i]

                    // Solo actualizar si cambió
                    if (actual.nombre_libre !== revisado.nombre || actual.cantidad_gramos !== revisado.gramos) {
                        const { error: errIng } = await supabase
                            .from('receta_ingredientes')
                            .update({
                                nombre_libre: revisado.nombre,
                                cantidad_gramos: revisado.gramos,
                            })
                            .eq('id', actual.id)

                        if (errIng) {
                            console.warn(`   ⚠️ Error actualizando ingrediente "${actual.nombre_libre}":`, errIng)
                        } else {
                            ingredientesActualizados++
                        }
                    }
                }

                // Si hay más ingredientes revisados que actuales, añadirlos
                if (rev.ingredientes.length > ingsActuales.length) {
                    for (let i = ingsActuales.length; i < rev.ingredientes.length; i++) {
                        const nuevo = rev.ingredientes[i]
                        // Buscar alimento_id por nombre
                        const { data: alimento } = await supabase
                            .from('alimentos')
                            .select('id')
                            .ilike('nombre', `%${nuevo.nombre}%`)
                            .limit(1)
                            .maybeSingle()

                        const { error: errNuevo } = await supabase
                            .from('receta_ingredientes')
                            .insert({
                                receta_id: rev.receta_id,
                                nombre_libre: nuevo.nombre,
                                cantidad_gramos: nuevo.gramos,
                                alimento_id: alimento?.id || null,
                            })

                        if (errNuevo) {
                            console.warn(`   ⚠️ Error insertando ingrediente "${nuevo.nombre}":`, errNuevo)
                        }
                    }
                }
            }

            aprobadas++
            console.log(`✅ APROBADA: "${rev.nombre}"`)
            console.log(`   └─ Categoría: ${rev.categoria} | Dificultad: ${rev.dificultad} | Cocción: ${rev.tipo_coccion}`)
            console.log(`   └─ ${rev.justificacion}`)

        } catch (err) {
            console.error(`❌ Error procesando receta "${rev.nombre}":`, err)
            errores++
        }
    }

    // 5. Recalcular macros de las recetas aprobadas
    console.log(`\n📊 Resumen:`)
    console.log(`   ✅ Aprobadas: ${aprobadas}`)
    console.log(`   ❌ Errores: ${errores}`)
    console.log(`   📝 Ingredientes actualizados: ${ingredientesActualizados}`)

    const recetasAprobadas = revisiones.map(r => r.receta_id)
    console.log(`\n📊 Recalculando macros de ${recetasAprobadas.length} recetas...`)

    for (const rid of recetasAprobadas) {
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
            const al = ing.alimento as unknown as any | null
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

        console.log(`   📊 ${receta.nombre || rid}: ${Math.round(totalKcal)} kcal (${Math.round(totalKcal / porciones)}/porción)`)
    }

    console.log(`\n✅ Proceso completado. ${aprobadas} recetas aprobadas y macros recalculados.`)
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
