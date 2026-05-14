/**
 * Script para enriquecer nutricionalmente todos los alimentos pendientes
 * usando DeepSeek vía API REST directa.
 *
 * USO: node scripts/enriquecer-alimentos.mjs
 *   --limite 10      Procesa solo 10 alimentos (también válido: --limite=10)
 *   --dry-run        Simula sin escribir en BD
 *   --desde "nombre" Empieza desde un nombre específico (alfabético)
 */

import { createClient } from '@supabase/supabase-js'
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
const limiteIdx = args.findIndex(a => a === '--limite')
const LIMITE = limiteIdx !== -1
    ? parseInt(args[limiteIdx + 1], 10) || parseInt(args[limiteIdx]?.split('=')[1], 10) || 500
    : parseInt(args.find(a => a.startsWith('--limite='))?.split('=')[1] || '500', 10)
const DRY_RUN = args.includes('--dry-run')
const DESDE_IDX = args.indexOf('--desde')
const DESDE = DESDE_IDX !== -1 ? args[DESDE_IDX + 1] : null

const MODELO = process.env.DEEPSEEK_MODEL || env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
const TEMPERATURA = 0.05
const LOTES_POR_VEZ = 4   // lotes pequeños para que DeepSeek responda todos
const MAX_INTENTOS = 3

// ── Inicializar Supabase ──────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

// ── Llamada DeepSeek REST ────────────────────────────────────────
async function llamarDeepSeek(prompt) {
    const body = {
        model: MODELO,
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURA,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(body)
    })

    if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        throw new Error(`DeepSeek HTTP ${response.status}: ${errBody.slice(0, 200)}`)
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ''

    if (!text) {
        throw new Error('DeepSeek devolvió respuesta vacía')
    }

    return text
}

// ── Extraer JSON de la respuesta ─────────────────────────────────
function extraerJSON(text) {
    // 1. Buscar clave "alimentos" en un objeto JSON
    const alimMatch = text.match(/"alimentos"\s*:\s*(\[[\s\S]*?\])/)
    if (alimMatch) {
        try {
            const parsed = JSON.parse(alimMatch[1])
            return Array.isArray(parsed) ? parsed : [parsed]
        } catch { /* fall through */ }
    }

    // 2. Intentar extraer bloque ```json ... ```
    const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (blockMatch) {
        const cleaned = blockMatch[1].trim()
        try {
            const parsed = JSON.parse(cleaned)
            // Si tiene clave "alimentos", extraer el array
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.alimentos) {
                return Array.isArray(parsed.alimentos) ? parsed.alimentos : [parsed.alimentos]
            }
            return Array.isArray(parsed) ? parsed : [parsed]
        } catch { /* fall through */ }
    }

    // 3. Buscar array JSON directo
    const arrayMatch = text.match(/\[[\s\S]*?\]/)
    if (arrayMatch) {
        try {
            const parsed = JSON.parse(arrayMatch[0])
            return Array.isArray(parsed) ? parsed : [parsed]
        } catch { /* fall through */ }
    }

    // 4. Buscar objeto JSON (con `response_format: json_object`, generalmente es el formato)
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) {
        try {
            const parsed = JSON.parse(objMatch[0])
            // Extraer array alimentos si existe
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.alimentos) {
                return Array.isArray(parsed.alimentos) ? parsed.alimentos : [parsed.alimentos]
            }
            return [parsed]
        } catch { /* fall through */ }
    }

    throw new Error(`No se pudo extraer JSON. Respuesta: ${text.slice(0, 500)}`)
}

// ── Prompt ────────────────────────────────────────────────────────
function construirPrompt(alimentos) {
    const categorias = [
        'Carnes rojas', 'Carnes blancas', 'Pescado azul', 'Pescado blanco',
        'Mariscos', 'Huevos', 'Legumbres', 'Frutos secos y semillas',
        'Lácteos enteros', 'Lácteos semidesnatados', 'Lácteos desnatados',
        'Arroces y pastas', 'Pan y cereales', 'Patatas y tubérculos',
        'Verduras de hoja verde', 'Verduras y hortalizas',
        'Frutas frescas', 'Frutas deshidratadas',
        'Aceites y grasas', 'Salsas y condimentos', 'Bebidas',
        'Dulces y bollería', 'Platos preparados', 'Suplementos deportivos',
        'Supermercado - Sin clasificar'
    ]

    const items = alimentos.map((a, i) =>
        `  "${a.id}": { "nombre": "${a.nombre}", "categoria_actual": "${a.categoria || ''}" }`
    ).join(',\n')

    return `Eres un nutricionista experto. Proporciona datos nutricionales precisos para cada uno de estos ${alimentos.length} alimentos.

Para CADA alimento, devuelve:
- categoria_ia: una de estas categorías: ${categorias.join(', ')}
- calorias: kcal por 100g
- proteinas: g por 100g
- carbohidratos: g por 100g
- grasas: g por 100g
- fibra: g por 100g (0 si no aplica)
- confianza: "alta" o "media"

IMPORTANTE: Debes responder EXACTAMENTE ${alimentos.length} objetos, uno por cada alimento.
Usa valores de BEDCA (tablas españolas de composición de alimentos).

Alimentos:
{
${items}
}

Responde SOLO con un objeto JSON que tenga esta estructura:
{"alimentos": [
  {"alimento_id": "uuid", "nombre": "...", "categoria_ia": "...", "calorias": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "fibra": 0, "confianza": "alta"}
]}`
}

// ── Enviar lote a DeepSeek ──────────────────────────────────────
async function enriquecerLote(alimentos) {
    const prompt = construirPrompt(alimentos)
    const text = await llamarDeepSeek(prompt)

    // Debug: guardar respuesta cruda para análisis
    if (process.env.DEBUG_RAW) {
        const fs = await import('fs')
        const ts = Date.now()
        fs.writeFileSync(`/tmp/deepseek-raw-${ts}.json`, JSON.stringify({ alimentos: alimentos.length, respuesta: text }, null, 2))
    }

    return extraerJSON(text)
}

// ── Palabras clave de NO-comestibles ──────────────────────────────
const NO_COMESTIBLE_KEYWORDS = [
    'alcohol', 'limpieza', 'abrillantador', 'lavavajillas', 'frigorífico',
    'absorbeolores', 'ropa', 'jabón', 'detergente', 'suavizante',
    'lejía', 'ammoniaco', 'estropajo', 'esponja', 'bayeta',
    'fregasuelos', 'quitagrasas', 'desatascador', 'wc', 'váter',
    'insecticida', 'ambientador', 'vela aromática', 'difusor',
    'recambio', 'bombona', 'gas', 'pilas', 'batería',
    'cepillo', 'cuchilla', 'maquinilla', 'cuchilla de afeitar',
    'preservativo', 'compresa', 'tampón', 'pañal',
    'champú', 'acondicionador', 'gel de baño', 'jabón de manos',
    'crema hidratante', 'protector solar', 'bronceador',
    'desodorante', 'colonia', 'perfume', 'laca', 'fijador',
    'pasta de dientes', 'dentífrico', 'enjuague bucal', 'hilo dental',
    'maquillaje', 'base de maquillaje', 'polvos', 'colorete',
    'sombra', 'delineador', 'máscara de pestañas', 'pintalabios',
    'quitaesmalte', 'esmalte', 'alisador', 'plancha de pelo',
    'secador', 'cortauñas', 'lima', 'pinzas',
    'bolsa de basura', 'film', 'papel de aluminio', 'papel film',
    'papel de horno', 'papel higiénico', 'clínex', 'pañuelo',
    'servilleta', 'mantel individual', 'vela', 'cerilla',
    'mechero', 'pilas', 'bombilla', 'fusible',
    'cinta adhesiva', 'pegamento', 'tijeras', 'cúter',
    'bolígrafo', 'rotulador', 'subrayador', 'grapa',
    'clip', 'goma de borrar', 'sacapuntas',
    'bote', 'frasco', 'tupper', 'botella vacía',
    'cubitera', 'hielera', 'termo', 'cantimplora',
    'guante', 'mascarilla', 'gorro de ducha',
    'zapatilla', 'chancla', 'calcetín', 'medias',
    'camiseta', 'camisa', 'pantalón', 'vestido',
    'toalla', 'toallita', 'sábana', 'funda de almohada',
    'alfombra', 'esterilla', 'cojín', 'manta',
    'taza', 'vaso', 'copa', 'plato', 'cuenco',
    'cubierto', 'tenedor', 'cuchillo', 'cuchara',
    'cacerola', 'sartén', 'olla', 'cazuela',
    'fuente', 'bandeja', 'molde', 'manga pastelera',
    'colador', 'escurridor', 'rallador', 'pelador',
    'batidora', 'licuadora', 'picadora', 'robot de cocina',
    'cafetera', 'tetera', 'hervidor', 'tostadora',
    'sandwichera', 'microondas', 'nevera', 'congelador',
    'lavadora', 'secadora', 'lavavajillas', 'aspiradora',
    'plancha', 'tabla de planchar', 'percha',
    'lámpara', 'flexo', 'ventilador', 'calefactor',
    'móvil', 'cargador', 'auricular', 'altavoz',
    'cable', 'adaptador', 'enchufe', 'alargador',
    'mando', 'piloto', 'bombilla inteligente',
    'comida para perro', 'comida para gato', 'pienso', 'alimento para perro',
    'alimento para gato', 'arena para gato', 'hamster', 'pájaro', 'pez',
    'accesorio mascota', 'juguete para perro', 'juguete para gato',
    'antimosquitos', 'repelente', 'pulsera antimosquitos',
    'aceite esencial', 'aceite de árbol de té',
    'botiquín', 'tiritas', 'venda', 'gasas', 'esparadrapo',
    'paracetamol', 'ibuprofeno', 'aspirina', 'antihistamínico',
    'vitamina', 'complejo vitamínico', 'suplemento', 'colágeno',
    'magnesio', 'potasio', 'zinc', 'hierro', 'calcio', 'omega 3',
    'aceite de hígado de bacalao', 'levadura de cerveza',
    'jalea real', 'propóleo', 'equinácea',
]

function esNoComestible(alimento) {
    const nombre = (alimento.nombre || '').toLowerCase()

    // Lista de palabras clave de NO-comestibles
    const KEYWORDS = [
        'alcohol de limpieza', 'abrillantador', 'lavavajillas',
        'absorbeolores', 'frigorífico', 'ropa limpia',
        'aceite esencial', 'aceite de árbol de té', 'aceite bruma',
        'protector solar', 'bronceador', 'crema hidratante', 'crema corporal',
        'gel de baño', 'champú', 'acondicionador', 'suavizante',
        'detergente', 'lejía', 'ambientador', 'difusor',
        'recambio', 'bombona', 'gas', 'pilas', 'batería',
        'cepillo', 'maquinilla', 'cuchilla de afeitar',
        'preservativo', 'compresa', 'tampón', 'pañal',
        'desodorante', 'colonia', 'perfume', 'laca', 'fijador',
        'pasta de dientes', 'dentífrico', 'enjuague bucal', 'hilo dental',
        'maquillaje', 'base de maquillaje', 'pintalabios', 'quitaesmalte',
        'bolsa de basura', 'film transparente', 'papel film', 'papel de aluminio',
        'papel higiénico', 'clínex', 'pañuelo',
        'servilleta', 'vela aromática',
        'mechero', 'bombilla', 'fusible',
        'cinta adhesiva', 'pegamento', 'tijeras', 'cúter',
        'bolígrafo', 'rotulador', 'grapa', 'clip',
        'bote', 'frasco', 'tupper',
        'guante', 'mascarilla', 'gorro de ducha',
        'zapatilla', 'chancla', 'calcetín', 'medias',
        'toalla', 'sábana', 'funda de almohada',
        'alfombra', 'esterilla', 'cojín', 'manta',
        'taza', 'vaso', 'copa', 'plato', 'cuenco',
        'cubierto', 'tenedor', 'cuchillo', 'cuchara',
        'cacerola', 'sartén', 'olla', 'cazuela',
        'fuente', 'bandeja', 'molde', 'manga pastelera',
        'colador', 'escurridor', 'rallador', 'pelador',
        'batidora', 'licuadora', 'picadora', 'robot de cocina',
        'cafetera', 'tetera', 'hervidor', 'tostadora',
        'sandwichera', 'microondas', 'nevera', 'congelador',
        'lavadora', 'secadora', 'aspiradora',
        'plancha', 'tabla de planchar', 'percha',
        'lámpara', 'flexo', 'ventilador', 'calefactor',
        'móvil', 'cargador', 'auricular', 'altavoz',
        'cable', 'adaptador', 'enchufe', 'alargador',
        'mando', 'piloto',
        'comida para perro', 'comida para gato', 'pienso',
        'arena para gato', 'accesorio mascota',
        'antimosquitos', 'repelente',
        'botiquín', 'tiritas', 'venda', 'gasas', 'esparadrapo',
        'paracetamol', 'ibuprofeno', 'aspirina',
        'levadura de cerveza', 'jalea real', 'propóleo', 'equinácea',
        'insecticida', 'quitagrasas', 'desatascador',
        'estropajo', 'esponja', 'bayeta', 'fregasuelos',
    ]

    for (const kw of KEYWORDS) {
        if (nombre.includes(kw)) return true
    }

    return false
}

// ── Obtener pendientes ────────────────────────────────────────────
async function obtenerPendientes() {
    // Añadir alimentos sin macros a la cola
    const { error: colaError } = await supabase.rpc('añadir_a_cola_enriquecimiento', {})
    if (colaError) console.warn('⚠️  add cola:', colaError.message)

    // Obtener IDs de alimentos que están en recetas
    const { data: recetaAlimentos } = await supabase
        .from('receta_ingredientes')
        .select('alimento_id')
        .not('alimento_id', 'is', null)

    const idsEnRecetas = new Set((recetaAlimentos || []).map(r => r.alimento_id))
    console.log(`   📌 Alimentos en recetas: ${idsEnRecetas.size}`)

    // Obtener todos los pendientes
    const { data: todos, error, count } = await supabase
        .from('alimentos_pendientes_enriquecer')
        .select('*', { count: 'exact' })

    if (error) throw new Error(`Error al obtener pendientes: ${error.message}`)

    // Filtrar: excluir solo no-comestibles obvios
    let alimentos = (todos || []).filter(a => !esNoComestible(a))

    // Ordenar: primero los que están en recetas, luego alfabético
    alimentos.sort((a, b) => {
        const aEnReceta = idsEnRecetas.has(a.id) ? 0 : 1
        const bEnReceta = idsEnRecetas.has(b.id) ? 0 : 1
        if (aEnReceta !== bEnReceta) return aEnReceta - bEnReceta
        return (a.nombre || '').localeCompare(b.nombre || '')
    })

    console.log(`   🍽️  Filtrados: ${alimentos.length} de ${count ?? todos?.length ?? '?'} totales`)
    console.log(`   📌 En recetas: ${alimentos.filter(a => idsEnRecetas.has(a.id)).length}`)

    if (DESDE) {
        alimentos = alimentos.filter(a => (a.nombre || '') >= DESDE)
    }

    // Aplicar límite
    if (LIMITE > 0 && LIMITE < alimentos.length) {
        alimentos = alimentos.slice(0, LIMITE)
    }

    return { alimentos, total: count ?? alimentos.length }
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
    console.log(`🤖 Modelo: ${MODELO}`)
    console.log(`📡 Supabase: ${SUPABASE_URL}`)
    console.log(`📊 Límite: ${LIMITE} alimentos, lotes de ${LOTES_POR_VEZ}`)
    if (DRY_RUN) console.log('🏁 Dry run — NO se escribirá en BD')
    if (DESDE) console.log(`📍 Desde: "${DESDE}"`)
    console.log('')

    // Obtener pendientes
    const { alimentos, total } = await obtenerPendientes()
    console.log(`📋 Total pendientes en BD: ${total}`)
    console.log(`📋 A procesar ahora: ${alimentos.length}`)

    if (alimentos.length === 0) {
        console.log('\n✅ No hay alimentos pendientes de enriquecer.')
        return
    }

    // Mostrar primeros 10 nombres
    console.log('\n📝 Primeros alimentos:')
    alimentos.slice(0, 10).forEach(a => console.log(`   - ${a.nombre} (${a.categoria || 'sin categoría'})`))
    if (alimentos.length > 10) console.log(`   ... y ${alimentos.length - 10} más`)
    console.log('')

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
                const elapsedBase = ((Date.now() - inicio) / 1000).toFixed(1)
                console.log(`  📦 Lote ${numLote}/${totalLotes} (${lote.length} alimentos) — consultando DeepSeek... [${elapsedBase}s]`)

                const resultados = await enriquecerLote(loteParaIA)
                procesados += resultados.length

                if (DRY_RUN) {
                    console.log(`  📊 Dry-run: ${resultados.length} resultados obtenidos`)
                    resultados.forEach(r => {
                        console.log(`    ${r.nombre}: ${r.calorias} kcal, ${r.proteinas}g P, ${r.carbohidratos}g HC, ${r.grasas}g G, ${r.fibra}g F [${r.confianza}]`)
                    })
                    exito = true
                    continue
                }

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
                console.log(`  ✅ Lote ${numLote}/${totalLotes}: ${ok} OK, ${fail} errores (${elapsed}s)`)

                exito = true

                // Pausa entre lotes
                if (i + LOTES_POR_VEZ < alimentos.length) {
                    await new Promise(r => setTimeout(r, 500))
                }
            } catch (err) {
                intentos++
                const msg = err instanceof Error ? err.message : String(err)
                console.log(`    ❌ (intento ${intentos}/${MAX_INTENTOS}): ${msg.slice(0, 200)}`)
                if (intentos >= MAX_INTENTOS) {
                    erroresLote++
                    console.error(`    ❌ Lote ${numLote} falló tras ${MAX_INTENTOS} intentos`)
                } else {
                    const espera = 3000 * intentos
                    console.log(`    ⏳ Esperando ${espera / 1000}s antes de reintentar...`)
                    await new Promise(r => setTimeout(r, espera))
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

    if (!DRY_RUN) {
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
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})
