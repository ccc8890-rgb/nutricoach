/**
 * enriquecer-ia.mjs — Enriquecimiento nutricional por IA (DeepSeek)
 *
 * Procesa alimentos pendientes de la cola de enriquecimiento,
 * llama a DeepSeek para rellenar macros (kcal, proteinas, carbohidratos, grasas, fibra)
 * y actualiza la base de datos vía RPC.
 *
 * USO:
 *   node scripts/enriquecer-ia.mjs                    # Procesa 100 alimentos
 *   node scripts/enriquecer-ia.mjs --limite 500       # Procesa 500
 *   node scripts/enriquecer-ia.mjs --todos             # Procesa TODOS los pendientes
 *   node scripts/enriquecer-ia.mjs --todos --no-actualizar  # Solo simular (dry-run)
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ── Leer .env.local ──────────────────────────────────────────
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY

// Modelos válidos DeepSeek: 'deepseek-chat' (V3) o 'deepseek-reasoner' (R1)
const MODELO = 'deepseek-chat'

const LOTES_POR_VEZ = 25
const MAX_INTENTOS = 3
const PAUSA_ENTRE_LOTES_MS = 1500

// ── Parsear args ─────────────────────────────────────────────
const args = process.argv.slice(2)
const flags = {
    limite: 100,
    dryRun: false,
    todos: false,
}
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limite' && args[i + 1]) {
        flags.limite = parseInt(args[++i], 10)
    } else if (args[i] === '--todos') {
        flags.todos = true
        flags.limite = Infinity
    } else if (args[i] === '--no-actualizar' || args[i] === '--dry-run') {
        flags.dryRun = true
    } else if (args[i] === '--help' || args[i] === '-h') {
        console.log(`
USO: node scripts/enriquecer-ia.mjs [opciones]

Opciones:
  --limite N          Procesar N alimentos (default: 100)
  --todos             Procesar TODOS los pendientes
  --no-actualizar     Dry-run: no actualizar BD, solo mostrar lo que se haría
  --help, -h          Mostrar esta ayuda
`)
        process.exit(0)
    }
}

// ── Helpers API ──────────────────────────────────────────────

async function fetchSupabase(method, path, body = null, extraHeaders = {}) {
    const url = `${SUPABASE_URL}${path}`
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...extraHeaders,
    }
    const opts = { method, headers }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(url, opts)
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Supabase ${method} ${path}: ${res.status} ${text.substring(0, 200)}`)
    }
    // 204 No Content
    if (res.status === 204) return null
    return res
}

async function fetchDeepSeek(prompt) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: MODELO,
            messages: [
                { role: 'system', content: 'Eres un nutricionista experto. Siempre respondes con JSON válido dentro de un bloque de código ```json.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 4000,
        }),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`DeepSeek API: ${res.status} ${text.substring(0, 200)}`)
    }

    const data = await res.json()

    // Debug: mostrar estructura de respuesta
    const content = data.choices?.[0]?.message?.content || ''
    if (!content.trim()) {
        console.error('\n⚠️ DeepSeek respondió vacío. Fin del uso:', data.usage || 'sin datos')
        throw new Error('DeepSeek returned empty response')
    }

    return content
}

// ── Extraer JSON de respuesta ────────────────────────────────

function extraerJsonArray(texto) {
    // 1. Bloque ```json ... ```
    const mdMatch = texto.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (mdMatch) {
        const contenido = mdMatch[1].trim()
        const parsed = JSON.parse(contenido)
        if (Array.isArray(parsed)) return parsed
        return [parsed]
    }

    // 2. Array plano [...]
    const arrayMatch = texto.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0])
        if (Array.isArray(parsed)) return parsed
        return [parsed]
    }

    // 3. Objeto individual {...}
    const objMatch = texto.match(/\{[\s\S]*\}/)
    if (objMatch) {
        return [JSON.parse(objMatch[0])]
    }

    // 4. Intentar parse directo como JSON
    try {
        const parsed = JSON.parse(texto.trim())
        if (Array.isArray(parsed)) return parsed
        return [parsed]
    } catch { }

    throw new Error(`No se pudo extraer JSON. Texto (primeros 500 chars): ${texto.slice(0, 500)}`)
}

// ── Construir prompt ─────────────────────────────────────────

function construirPrompt(alimentos) {
    const CATEGORIAS = [
        'Carnes rojas', 'Carnes blancas', 'Pescado azul', 'Pescado blanco',
        'Mariscos', 'Huevos', 'Legumbres', 'Frutos secos y semillas',
        'Lácteos enteros', 'Lácteos semidesnatados', 'Lácteos desnatados',
        'Arroces y pastas', 'Pan y cereales', 'Patatas y tubérculos',
        'Verduras de hoja verde', 'Verduras y hortalizas', 'Frutas frescas',
        'Frutas deshidratadas', 'Aceites y grasas', 'Salsas y condimentos',
        'Bebidas', 'Dulces y bollería', 'Platos preparados',
        'Suplementos deportivos', 'Supermercado - Sin clasificar'
    ]

    return `Eres un nutricionista experto. Para cada alimento de la lista, debes proporcionar:
1. **categoria_ia**: categoría nutricional precisa (elige de esta lista: ${CATEGORIAS.join(', ')})
2. **calorias**: kcal por 100g
3. **proteinas**: gramos por 100g
4. **carbohidratos**: gramos por 100g
5. **grasas**: gramos por 100g
6. **fibra**: gramos por 100g (0 si no aplica)
7. **confianza**: "alta" si conoces el valor exacto, "media" si es estimación, "baja" si es muy incierto

IMPORTANTE: Responde SOLO con un array JSON válido dentro de un bloque de código \`\`\`json.
Usa valores realistas basados en tablas de composición de alimentos españolas (BEDCA).
Si el nombre del producto es una marca comercial específica, estima basándote en el tipo de producto.

Alimentos a procesar:
${JSON.stringify(alimentos, null, 2)}

Formato de respuesta:
\`\`\`json
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
    "confianza": "alta|media|baja",
    "explicacion": "breve razón de los valores"
  }
]
\`\`\``
}

// ── Obtener pendientes ───────────────────────────────────────

async function obtenerPendientes(limite) {
    // Obtener todas las filas con paginación (Supabase REST limita a 1.000 por defecto)
    const colaItems = []
    const pageSize = 1000
    let offset = 0

    while (true) {
        const params = new URLSearchParams({
            select: 'id,alimento_id,nombre_original,nombre_normalizado,estado,intentos',
            estado: 'eq.pendiente',
            order: 'created_at.asc',
            limit: String(pageSize),
            offset: String(offset),
        })

        const res = await fetchSupabase('GET', `/rest/v1/alimentos_enriquecimiento_cola?${params}`)
        if (!res) break

        const batch = await res.json()
        if (!Array.isArray(batch) || batch.length === 0) break

        colaItems.push(...batch)
        offset += batch.length

        // Si el lote es menor que el pageSize, no hay más
        if (batch.length < pageSize) break
        // Si no hay límite o ya alcanzamos el límite
        if (limite !== Infinity && colaItems.length >= limite) break
    }

    // Limitar si es necesario
    const items = limite === Infinity ? colaItems : colaItems.slice(0, limite)

    if (items.length === 0) return []

    // Obtener también nombre y categoria de alimentos
    const alimentoIds = items.map(i => i.alimento_id)

    // Consultar alimentos por lotes de 100 ids (limite URL)
    const alimentos = []
    for (let i = 0; i < alimentoIds.length; i += 100) {
        const batch = alimentoIds.slice(i, i + 100)
        const orClause = batch.map(id => `id.eq.${id}`).join(',')
        const res2 = await fetchSupabase('GET', `/rest/v1/alimentos?select=id,nombre,categoria&or=(${orClause})`)
        if (res2) {
            const batchAlimentos = await res2.json()
            alimentos.push(...batchAlimentos)
        }
    }

    const alimentoMap = new Map(alimentos.map(a => [a.id, a]))

    return items.map(item => ({
        cola_id: item.id,
        alimento_id: item.alimento_id,
        nombre: item.nombre_original || item.nombre_normalizado || 'desconocido',
        categoria_actual: alimentoMap.get(item.alimento_id)?.categoria || null,
    }))
}

// ── Actualizar alimento con IA ───────────────────────────────

async function actualizarAlimento(resultado) {
    const body = {
        p_alimento_id: resultado.alimento_id,
        p_categoria_ia: resultado.categoria_ia || null,
        p_calorias: resultado.calorias,
        p_proteinas: resultado.proteinas,
        p_carbohidratos: resultado.carbohidratos,
        p_grasas: resultado.grasas,
        p_fibra: resultado.fibra ?? null,
        p_resultado_json: JSON.stringify(resultado),
    }

    await fetchSupabase('POST', `/rest/v1/rpc/actualizar_alimento_con_ia`, body)
}

// ── Marcar como error ────────────────────────────────────────

async function marcarError(colaId, errorMsg, intentos) {
    const body = {
        estado: intentos >= MAX_INTENTOS ? 'error' : 'pendiente',
        error_ia: errorMsg.substring(0, 500),
        intentos: intentos,
        updated_at: new Date().toISOString(),
    }
    await fetchSupabase('PATCH', `/rest/v1/alimentos_enriquecimiento_cola?id=eq.${colaId}`, body)
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
    console.log('══════════════════════════════════════════════')
    console.log('  🥗 Enriquecimiento Nutricional por IA')
    console.log(`  Modelo: ${MODELO}`)
    console.log(`  Modo: ${flags.dryRun ? '🔍 DRY-RUN (no actualizará BD)' : '🚀 EJECUCIÓN REAL'}`)
    console.log(`  Límite: ${flags.todos ? 'TODOS los pendientes' : flags.limite}`)
    console.log('══════════════════════════════════════════════\n')

    // 1. Obtener pendientes
    console.log('📡 Obteniendo alimentos pendientes...')
    const pendientes = await obtenerPendientes(flags.limite)
    console.log(`   → ${pendientes.length} alimentos pendientes\n`)

    if (pendientes.length === 0) {
        console.log('✅ No hay alimentos pendientes de enriquecer.')
        return
    }

    // 2. Procesar en lotes
    const total = pendientes.length
    let procesados = 0
    let actualizados = 0
    let errores = []
    const inicio = Date.now()

    for (let i = 0; i < total; i += LOTES_POR_VEZ) {
        const lote = pendientes.slice(i, i + LOTES_POR_VEZ)
        const loteParaIA = lote.map(a => ({
            id: a.alimento_id,
            nombre: a.nombre,
            categoria_actual: a.categoria_actual,
        }))

        const loteNum = Math.floor(i / LOTES_POR_VEZ) + 1
        const totalLotes = Math.ceil(total / LOTES_POR_VEZ)
        const prompt = construirPrompt(loteParaIA)

        let exito = false
        let intento = 0

        while (intento < MAX_INTENTOS && !exito) {
            intento++
            const label = `[Lote ${loteNum}/${totalLotes} | ${lote.length} items | Intento ${intento}/${MAX_INTENTOS}]`

            try {
                process.stdout.write(`  ${label} → llamando a DeepSeek... `)

                if (flags.dryRun) {
                    console.log('🔍 (dry-run, saltando)')
                    procesados += lote.length
                    actualizados += lote.length
                    exito = true
                    continue
                }

                const respuesta = await fetchDeepSeek(prompt)
                console.log('✅ respuesta recibida')

                // Debug: mostrar preview de respuesta
                const preview = respuesta.length > 100 ? respuesta.substring(0, 100) + '...' : respuesta
                console.log(`     Preview: ${preview}`)

                const resultados = extraerJsonArray(respuesta)
                procesados += resultados.length

                // Actualizar cada alimento
                let okLote = 0
                for (const r of resultados) {
                    try {
                        const item = lote.find(a => a.alimento_id === r.alimento_id)
                        if (!item) {
                            errores.push(`ID ${r.alimento_id} no encontrado en lote`)
                            continue
                        }

                        await actualizarAlimento(r)
                        okLote++
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err)
                        errores.push(`Error actualizando ${r.nombre || r.alimento_id}: ${msg}`)
                    }
                }

                actualizados += okLote
                exito = true

                const pct = Math.round((Math.min(i + LOTES_POR_VEZ, total) / total) * 100)
                const elapsed = ((Date.now() - inicio) / 1000).toFixed(1)
                console.log(`  ✅ Lote completado: ${okLote}/${resultados.length} actualizados | ${pct}% | ${elapsed}s\n`)

            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                console.log(`❌ Error: ${msg.substring(0, 120)}`)

                if (intento >= MAX_INTENTOS) {
                    for (const a of lote) {
                        errores.push(`Error tras ${MAX_INTENTOS} intentos: ${a.nombre}: ${msg.substring(0, 100)}`)
                        if (!flags.dryRun) {
                            await marcarError(a.cola_id, msg, intento).catch(() => { })
                        }
                    }
                } else {
                    const espera = 2000 * intento
                    console.log(`   ⏳ Reintentando en ${espera / 1000}s...`)
                    await new Promise(r => setTimeout(r, espera))
                }
            }
        }

        if (i + LOTES_POR_VEZ < total) {
            await new Promise(r => setTimeout(r, PAUSA_ENTRE_LOTES_MS))
        }
    }

    // 3. Resultados
    const duracion = ((Date.now() - inicio) / 1000).toFixed(1)
    console.log('══════════════════════════════════════════════')
    console.log('  📊 RESULTADOS')
    console.log(`     Total pendientes:    ${total}`)
    console.log(`     Procesados:          ${procesados}`)
    console.log(`     Actualizados:        ${actualizados}`)
    console.log(`     Errores:             ${errores.length}`)
    console.log(`     Duración:            ${duracion}s`)
    console.log('══════════════════════════════════════════════')

    if (errores.length > 0) {
        console.log('\n⚠️  Errores:')
        for (const e of errores.slice(0, 20)) {
            console.log(`   • ${e}`)
        }
        if (errores.length > 20) {
            console.log(`   ... y ${errores.length - 20} más`)
        }
    }

    if (flags.dryRun) {
        console.log('\n🔍 DRY-RUN completado. Ningún cambio se aplicó a la BD.')
    } else {
        console.log('\n✅ Enriquecimiento completado.')
    }
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})
