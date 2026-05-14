#!/usr/bin/env node
/**
 * rematch-ingredientes.mjs
 *
 * Re-aplica el algoritmo de matching con sistema de puntuación mejorado.
 * Características:
 *   - Puntuación 0-100 con umbral configurable
 *   - Penaliza alimentos con palabras de marca/producto
 *   - Detecta negaciones ("sin X") correctamente
 *   - Prefiere matches exactos y alimentos base sobre procesados
 *   - Descriptores válidos (integral, crudo, fresca, etc.) no penalizan
 *
 * USO:
 *   node scripts/rematch-ingredientes.mjs              → dry-run
 *   node scripts/rematch-ingredientes.mjs --apply       → aplica cambios
 *   node scripts/rematch-ingredientes.mjs --apply --slug "tostadas"
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

const APPLY = process.argv.includes('--apply')
const slugIdx = process.argv.indexOf('--slug')
const SLUG = slugIdx !== -1 ? process.argv[slugIdx + 1] : null
const UMBRAL = 75 // mínimo 75/100 para considerar match

// ── Normalización ─────────────────────────────────────────────────────────────

// Stop words que no aportan significado semántico
const STOP_WORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'del', 'al', 'un', 'una', 'unos', 'unas',
    'en', 'por', 'con', 'sin', 'para', 'y', 'e', 'o', 'a', 'su', 'que',
    'es', 'se', 'no', 'lo', 'como', 'más', 'mas', 'pero', 'todo', 'entre',
    'le', 'da', 'do', 'tu',
])

function normalizar(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function palabrasCompletas(str) {
    return normalizar(str.toLowerCase())
        .split(/[\s,()\/\-]+/)
        .filter(p => p.length >= 2 && !STOP_WORDS.has(p))
}

// Palabras de marca/producto — penalizan fuerte
// NOTA: NO incluir alimentos base ('cereal', 'chocolate', 'salsa', 'pasta', etc.)
// porque penalizan alimentos perfectamente válidos y causan falsos positivos
// (ej: "Cereales cubiertos..." → "Leche" en vez de sí mismo)
const MARCAS = new Set([
    'hacendado', 'nestle', 'nestlé', 'valor', 'mercadona', 'dia', 'carrefour',
    'coca', 'cola', 'monster', 'patatas', 'galletas', 'bebida',
    'refresco', 'cerveza', 'vino', 'spaghetti', 'papilla',
    'rosquillas', 'molinillo', 'sirope',
    'barrita', 'barritas', 'snack', 'snacks',
    'deliplus', 'bosque verde', 'aliada', 'sanex', 'nivea',
    'gel', 'baño', 'champu', 'jabon', 'piel', 'crema corporal',
])

// Descriptores válidos — NO penalizan (son calificativos del alimento base)
const DESCRIPTORES = new Set([
    'integral', 'crudo', 'cruda', 'crudos', 'crudas',
    'fresco', 'fresca', 'frescos', 'frescas',
    'seco', 'seca', 'secos', 'secas',
    'molido', 'molidos', 'molidas', 'molienda',
    'natural', 'normal',
    'blanco', 'blanca', 'blancos', 'blancas',
    'negro', 'negra', 'negros', 'negras',
    'rojo', 'roja', 'rojos', 'rojas',
    'verde', 'dulce', 'salado', 'salada',
    'ahumado', 'ahumada', 'ahumados', 'ahumadas',
    'desnatado', 'desnatada',
    'entero', 'entera', 'enteros', 'enteras',
    'rallado', 'rallada',
    'líquido', 'liquido', 'líquida', 'liquida',
    'congelado', 'congelada',
    'frito', 'frita', 'fritos', 'fritas',
    'hervido', 'hervida',
    'asado', 'asada',
    'plancha', 'horno', 'vapor',
    'largo', 'larga',
    'corto', 'corta',
    'fino', 'fina',
    'grueso', 'gruesa',
    'tierno', 'tierna',
    'maduro', 'madura',
    'ecológico', 'ecologica', 'eco',
    'casero', 'casera',
    'tradicional',
    'suave', 'fuerte',
    'clásico', 'clasico', 'clásica', 'clasica',
    'light', 'bajo', 'baja', 'bajos', 'bajas', '0%',
    'extra', 'virgen', 'refinado',
])

// ── Algoritmo de puntuación ──────────────────────────────────────────────────

function puntuarFood(ingPalabras, foodPalabras) {
    const ingSet = new Set(ingPalabras)
    const foodSet = new Set(foodPalabras)

    // Palabras exclusivas de cada lado
    const soloIng = ingPalabras.filter(p => !foodSet.has(p))
    const soloFood = foodPalabras.filter(p => !ingSet.has(p))

    const forwardOk = soloIng.length === 0 // todas las ing words están en food
    const reverseOk = soloFood.length === 0 // todas las food words están en ing

    // Si ni forward ni reverse → no hay match
    if (!forwardOk && !reverseOk) return -1

    // Clasificar tipo de match
    const esBidireccional = forwardOk && reverseOk // mismas palabras
    const esReverseOnly = reverseOk && !forwardOk // food ⊂ ingredient (seguro)
    const esForwardOnly = forwardOk && !reverseOk // ingredient ⊂ food (riesgoso)

    let score = 0

    // ── BIDIRECCIONAL: mismas palabras ──
    if (esBidireccional) {
        if (soloIng.length === 0 && soloFood.length === 0) score = 100 // exacto
        else score = 95 // mismo conjunto de palabras
    }

    // ── REVERSE ONLY: food ⊂ ingredient ──
    // Ej: "arroz integral" ← "arroz". Seguro porque food no tiene palabras extrañas.
    else if (esReverseOnly) {
        score = 85
        // Penalizar cuando el ingrediente tiene muchas palabras extra
        // que no son descriptores ni marcas. Ej: "Gel de baño granada Deliplus" → "Granada"
        // O "Cereales cubiertos de chocolate blanco rellenos con leche" → "Leche"
        if (soloIng.length > 1) {
            const extraNoDesc = soloIng.filter(p => !DESCRIPTORES.has(p) && !MARCAS.has(p))
            score -= extraNoDesc.length * 10
        }
    }

    // ── FORWARD ONLY: ingredient ⊂ food ──
    // Ej: "huevo" → "Huevo M" o → "Spaghetti al huevo". RIESGOSO.
    else if (esForwardOnly) {
        if (soloFood.length === 0) score = 100 // no debería ocurrir aquí
        else if (ingPalabras.length === 1 && soloFood.length >= 2) {
            // Una palabra del ing coincide con food que tiene 2+ extras
            // "huevo" → "Spaghetti al huevo" (1 extra = "spaghetti")
            // CASO MUY RIESGOSO
            const numMarca = soloFood.filter(p => MARCAS.has(p)).length
            const numDesc = soloFood.filter(p => DESCRIPTORES.has(p)).length

            if (numMarca > 0) score = 40 // producto procesado
            else if (numDesc >= soloFood.length) score = 80 // solo descriptores
            else score = 60 // mixto
        } else {
            // Ingrediente multi-palabra con extras en food
            // "pimienta negra" → "Molinillo pimienta negra" (1 extra)
            const numMarca = soloFood.filter(p => MARCAS.has(p)).length
            if (numMarca > 0) score = Math.max(50, 80 - numMarca * 15)
            else score = Math.max(60, 85 - soloFood.length * 5)
        }
    }

    // Penalizaciones generales
    const marcaEnFood = foodPalabras.filter(p => MARCAS.has(p)).length
    score -= marcaEnFood * 20

    // Bonus por nombre corto (más genérico = mejor)
    if (foodPalabras.length <= 2) score += 5
    if (foodPalabras.length === 1) score += 5

    return Math.max(0, Math.min(100, score))
}

function buscarAlimento(nombreIngrediente, alimentos) {
    if (!alimentos?.length) return null

    const norm = normalizar(nombreIngrediente.toLowerCase().trim())
    const palabrasIng = palabrasCompletas(nombreIngrediente)

    if (palabrasIng.length === 0) return null

    // Detectar negaciones en el ingrediente: "sin X"
    const ingTokens = normalizar(nombreIngrediente.toLowerCase()).split(/[\s,()\/\-]+/)
    const negados = new Set()
    for (let i = 0; i < ingTokens.length - 1; i++) {
        if (ingTokens[i] === 'sin' && ingTokens[i + 1].length >= 2) {
            negados.add(ingTokens[i + 1])
        }
    }

    let mejorMatch = null
    let mejorPunt = -1

    for (const a of alimentos) {
        const nombreA = normalizar(a.nombre.toLowerCase().trim())
        const palabrasA = palabrasCompletas(a.nombre)
        if (palabrasA.length === 0) continue

        // Si el ingrediente tiene negaciones ("sin X"):
        // Solo saltamos si el alimento tiene la palabra negada PERO NO tiene
        // su propia negación para esa misma palabra.
        // Ej: "nachos sin sal" → negados={"sal"}
        //   "Sal" → tiene "sal" sin negación → SKIP ✅
        //   "Nachos (sin sal)" → tiene "sal" pero también "sin" → NO SKIP ✅
        // IMPORTANTE: Usar tokens raw (no palabrasCompletas) para detectar "sin"
        // porque palabrasCompletas filtra stop words.
        if (negados.size > 0) {
            const tokensA = normalizar(a.nombre.toLowerCase()).split(/[\s,()\/\-]+/)
            const tieneSin = tokensA.some(p => p === 'sin')
            const tieneNegada = palabrasA.some(p => negados.has(p))
            if (tieneNegada && !tieneSin) continue
        }

        const punt = puntuarFood(palabrasIng, palabrasA)
        if (punt > mejorPunt) {
            // Desempate: prefiere nombre más corto (más genérico/base)
            if (punt === mejorPunt && mejorMatch) {
                if (nombreA.length >= mejorMatch.nombre.length) continue
            }
            mejorPunt = punt
            mejorMatch = a
        }
    }

    if (mejorPunt < UMBRAL) return null
    return mejorMatch
}

function buscarAlimentoV2(nombreIngrediente, alimentos) {
    // Usa buscarAlimento original pero con post-filtro:
    // Si hay múltiples candidatos con score >= UMBRAL, prefiere el que tiene
    // más tokens en común (evita que "leche de coco" → "Leche" sobre "Leche de coco (para cocinar)")
    if (!alimentos?.length) return null

    const norm = normalizar(nombreIngrediente.toLowerCase().trim())
    const palabrasIng = palabrasCompletas(nombreIngrediente)
    if (palabrasIng.length === 0) return null

    // Detect negations
    const ingTokens = normalizar(nombreIngrediente.toLowerCase()).split(/[\s,()\/\-]+/)
    const negados = new Set()
    for (let i = 0; i < ingTokens.length - 1; i++) {
        if (ingTokens[i] === 'sin' && ingTokens[i + 1].length >= 2) {
            negados.add(ingTokens[i + 1])
        }
    }

    // Score ALL candidates above threshold
    const candidatos = []
    for (const a of alimentos) {
        const palabrasA = palabrasCompletas(a.nombre)
        if (palabrasA.length === 0) continue
        if (negados.size > 0) {
            // Usar tokens raw (no palabrasCompletas) para detectar "sin"
            // porque palabrasCompletas filtra stop words.
            const tokensA = normalizar(a.nombre.toLowerCase()).split(/[\s,()\/\-]+/)
            const tieneSin = tokensA.some(p => p === 'sin')
            const tieneNegada = palabrasA.some(p => negados.has(p))
            if (tieneNegada && !tieneSin) continue
        }
        const punt = puntuarFood(palabrasIng, palabrasA)
        if (punt >= UMBRAL) {
            candidatos.push({ alimento: a, punt, palabrasA, numOverlap: palabrasA.filter(p => palabrasIng.includes(p)).length })
        }
    }

    if (candidatos.length === 0) return null

    // Sort: prefer more overlap first (compound > generic), then higher score
    candidatos.sort((a, b) => {
        // Prefer more overlapping tokens (compound food > generic food)
        // "leche de coco" → "Leche de coco (...)" (overlap 2) > "Leche" (overlap 1)
        if (b.numOverlap !== a.numOverlap) return b.numOverlap - a.numOverlap
        // Then prefer higher score
        if (b.punt !== a.punt) return b.punt - a.punt
        // Tiebreak: prefer shorter name (more generic/base)
        return a.alimento.nombre.length - b.alimento.nombre.length
    })

    return candidatos[0].alimento
}

// ── Carga de datos con paginación ────────────────────────────────────────────

async function cargarTodosAlimentos() {
    const todos = []
    let page = 0
    const PAGE_SIZE = 1000 // Supabase limita a 1000 por range()
    while (true) {
        const { data, error } = await supabase
            .from('alimentos')
            .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        if (error) throw new Error(`Error cargando alimentos: ${error.message}`)
        if (!data?.length) break
        todos.push(...data)
        page++
        if (data.length < PAGE_SIZE) break
    }
    return todos
}

/**
 * Recalcula los macros de una receta sumando los macros de sus ingredientes
 * vinculados a la tabla alimentos, dividido entre el número de porciones.
 */
async function recalcularMacrosReceta(recetaId, porciones) {
    const { data: ingredientes, error } = await supabase
        .from('receta_ingredientes')
        .select('alimento_id, cantidad_gramos')
        .eq('receta_id', recetaId)

    if (error || !ingredientes?.length) return

    // Cargar macros de los alimentos vinculados
    const ids = [...new Set(ingredientes.map(i => i.alimento_id).filter(Boolean))]
    if (ids.length === 0) return

    const { data: alimentos } = await supabase
        .from('alimentos')
        .select('id, calorias, proteinas, carbohidratos, grasas, fibra')
        .in('id', ids)

    if (!alimentos?.length) return

    const alimentoMap = {}
    for (const a of alimentos) alimentoMap[a.id] = a

    let totalKcal = 0, totalProt = 0, totalCarbs = 0, totalGrasas = 0, totalFibra = 0

    for (const ing of ingredientes) {
        if (!ing.alimento_id || !alimentoMap[ing.alimento_id]) continue
        const a = alimentoMap[ing.alimento_id]
        const factor = ing.cantidad_gramos / 100
        totalKcal += (a.calorias || 0) * factor
        totalProt += (a.proteinas || 0) * factor
        totalCarbs += (a.carbohidratos || 0) * factor
        totalGrasas += (a.grasas || 0) * factor
        totalFibra += (a.fibra || 0) * factor
    }

    const p = porciones || 1
    return {
        kcal: Math.round(totalKcal * 100) / 100 / p,
        proteinas: Math.round(totalProt * 100) / 100 / p,
        carbohidratos: Math.round(totalCarbs * 100) / 100 / p,
        grasas: Math.round(totalGrasas * 100) / 100 / p,
        fibra: Math.round(totalFibra * 100) / 100 / p,
    }
}

async function cargarIngredientes() {
    const PAGE_SIZE = 1000
    const todos = []

    if (SLUG) {
        const { data: recetas } = await supabase
            .from('recetas')
            .select('id, nombre')
            .ilike('nombre', `%${SLUG}%`)
        if (!recetas?.length) {
            console.log(`❌ No se encontraron recetas con slug: "${SLUG}"`)
            return { ingredientes: [] }
        }
        console.log(`🔎 Filtrado por slug: "${SLUG}" → ${recetas.length} recetas`)
        for (const r of recetas) console.log(`   - ${r.nombre} (${r.id})`)

        const { data, error } = await supabase
            .from('receta_ingredientes')
            .select('id, receta_id, nombre_libre, cantidad_gramos, alimento_id, orden')
            .in('receta_id', recetas.map(r => r.id))
        if (error) throw new Error(`Error cargando ingredientes: ${error.message}`)
        return { ingredientes: data || [] }
    }

    let page = 0
    while (true) {
        const { data, error } = await supabase
            .from('receta_ingredientes')
            .select('id, receta_id, nombre_libre, cantidad_gramos, alimento_id, orden')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        if (error) throw new Error(`Error cargando ingredientes: ${error.message}`)
        if (!data?.length) break
        todos.push(...data)
        page++
        if (data.length < PAGE_SIZE) break
    }

    return { ingredientes: todos }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n🔁 Re-match de ingredientes (scoring, umbral=' + UMBRAL + ')')
    console.log(`   ${APPLY ? '⚠️  MODO APLICAR' : '🔍 DRY-RUN'}\n`)

    const alimentos = await cargarTodosAlimentos()
    console.log(`📦 Alimentos en BD: ${alimentos.length}`)

    const { ingredientes } = await cargarIngredientes()
    console.log(`🥄 Ingredientes totales: ${ingredientes.length}\n`)

    let cambiados = 0, aNull = 0, aNuevo = 0, sinMatch = 0
    const reportes = []

    for (const ing of ingredientes) {
        const nombreLimpio = (ing.nombre_libre || '').trim()
        if (!nombreLimpio) continue

        const match = buscarAlimentoV2(nombreLimpio, alimentos)
        const nuevoId = match?.id || null
        const viejoId = ing.alimento_id

        if (nuevoId !== viejoId) {
            cambiados++
            if (!nuevoId && viejoId) aNull++
            if (nuevoId && !viejoId) aNuevo++

            const viejoNombre = viejoId
                ? alimentos.find(a => a.id === viejoId)?.nombre || viejoId
                : '(ninguno)'
            const nuevoNombre = match?.nombre || '(ninguno)'

            reportes.push({
                id: ing.id, receta_id: ing.receta_id,
                nombre_libre: nombreLimpio,
                viejo: viejoNombre, nuevo: nuevoNombre,
                viejoId, nuevoId,
            })

            if (APPLY) {
                const { error } = await supabase
                    .from('receta_ingredientes')
                    .update({ alimento_id: nuevoId })
                    .eq('id', ing.id)
                if (error) console.error(`   ❌ Error: ${error.message}`)
            }
        } else if (!nuevoId && !viejoId) {
            sinMatch++
        }
    }

    console.log('═══════════════════════════════════════════')
    console.log(`  Total ingredientes:     ${ingredientes.length}`)
    console.log(`  Sin match (antes/ahora): ${sinMatch}`)
    console.log(`  Con cambio:             ${cambiados}`)
    console.log(`    ↳ Falsos + corregidos:   ${aNull}`)
    console.log(`    ↳ Nuevos matches:       ${aNuevo}`)
    console.log(`  ${APPLY ? '✅ APLICADO' : '🔍 DRY-RUN'}\n`)

    // ── Recalcular macros de las recetas afectadas ──
    if (APPLY && (cambiados > 0 || aNuevo > 0)) {
        const recetasAfectadas = [...new Set(reportes.map(r => r.receta_id))]
        console.log(`\n📊 Recalculando macros de ${recetasAfectadas.length} recetas afectadas...`)

        for (const rid of recetasAfectadas) {
            // Obtener porciones de la receta
            const { data: rec } = await supabase
                .from('recetas')
                .select('id, nombre, porciones')
                .eq('id', rid)
                .single()

            if (!rec) continue

            const macros = await recalcularMacrosReceta(rid, rec.porciones)
            if (!macros) continue

            const { error } = await supabase
                .from('recetas')
                .update({
                    kcal: macros.kcal,
                    proteinas: macros.proteinas,
                    carbohidratos: macros.carbohidratos,
                    grasas: macros.grasas,
                    fibra: macros.fibra,
                })
                .eq('id', rid)

            if (error) {
                console.error(`   ❌ Error actualizando macros de "${rec.nombre}": ${error.message}`)
            } else {
                console.log(`   ✅ "${rec.nombre}": ${Math.round(macros.kcal)} kcal | P:${Math.round(macros.proteinas)}g | C:${Math.round(macros.carbohidratos)}g | G:${Math.round(macros.grasas)}g`)
            }
        }
        console.log('')
    }

    if (reportes.length > 0) {
        const { data: recetas } = await supabase
            .from('recetas')
            .select('id, nombre, porciones')
            .in('id', [...new Set(reportes.map(r => r.receta_id))])

        const recetaMap = {}
        for (const r of recetas || []) recetaMap[r.id] = r.nombre

        const porReceta = {}
        for (const r of reportes) {
            if (!porReceta[r.receta_id]) porReceta[r.receta_id] = []
            porReceta[r.receta_id].push(r)
        }

        console.log('📋 DETALLE:')
        for (const [rid, items] of Object.entries(porReceta)) {
            console.log(`\n  📝 ${recetaMap[rid] || rid}:`)
            for (const item of items) {
                const v = item.viejo === '(ninguno)' ? '🚫' : `❌ ${item.viejo}`
                const n = item.nuevo === '(ninguno)' ? '🚫' : `✅ ${item.nuevo}`
                console.log(`    "${item.nombre_libre}"`)
                console.log(`      ${v}`)
                console.log(`      ${n}`)
            }
        }
    } else {
        console.log('✅ Todos los matches ya son correctos.')
    }
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
