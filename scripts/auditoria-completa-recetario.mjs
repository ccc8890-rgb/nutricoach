/**
 * auditoria-completa-recetario.mjs
 *
 * Auditoría integral de TODAS las recetas del recetario.
 * Revisa:
 *   1. Campos obligatorios (nombre, descripción, instrucciones, etc.)
 *   2. Esquema unificado (tipo_plato, categoria, tipo_coccion, dificultad)
 *   3. Macros por porción vs totales (detecta factor de división incorrecto)
 *   4. Instrucciones formateadas (pasos numerados vs párrafo)
 *   5. Ingredientes con/sin alimento_id
 *   6. Tags, intolerancias, estado
 *   7. Valores 100g (kcal_100g, proteinas_100g, etc.)
 *
 * USO:
 *   cd nutricoach && node scripts/auditoria-completa-recetario.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
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

// ── Esquemas de referencia ──────────────────────────────────────

const CATEGORIAS_VALIDAS = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']
const TIPOS_COCCION_VALIDOS = [
    'No Bake', 'Sartén', 'Sartén/Wok', 'Plancha',
    'Horno/Airfryer', 'Horno', 'Freidora de Aire', 'Microondas',
    'Vapor', 'Olla/Cazuela', 'Olla', 'Hervido', 'Parrilla',
]
const DIFICULTADES_VALIDAS = ['Fácil', 'Medio', 'Difícil']
const INTOLERANCIAS_VALIDAS = ['Sin Gluten', 'Sin Lactosa', 'Vegano', 'Vegetariano', 'Sin Huevo', 'Sin Frutos Secos']
const ESTADOS_VALIDOS = ['borrador', 'en_revision', 'aprobada', 'descartada']
const TIPOS_PLATO_VALIDOS = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Snack', 'Postre']
const FUENTES_TIPO_VALIDAS = ['manual', 'web', 'instagram', 'tiktok', 'youtube', 'ia_generada']

// ── Auditoría ───────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║   AUDITORÍA COMPLETA DEL RECETARIO NUTRICOACH               ║')
    console.log('╚══════════════════════════════════════════════════════════════╝\n')

    // 1. Cargar todas las recetas
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('*')
        .order('nombre')

    if (error) { console.error('Error al cargar recetas:', error.message); process.exit(1) }
    if (!recetas?.length) { console.log('❌ No hay recetas en la BD'); process.exit(0) }

    console.log(`📊 Total recetas: ${recetas.length}\n`)

    // 2. Cargar ingredientes agrupados
    const { data: todosIng } = await supabase
        .from('receta_ingredientes')
        .select('receta_id, nombre_libre, cantidad_gramos, alimento_id, orden, es_opcional')
        .order('orden')

    const ingPorReceta = {}
    for (const i of (todosIng || [])) {
        if (!ingPorReceta[i.receta_id]) ingPorReceta[i.receta_id] = []
        ingPorReceta[i.receta_id].push(i)
    }

    // 3. Cargar alimentos con sus macros (para verificación de cálculos)
    const { data: alimentos } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')

    const alimMap = {}
    for (const a of (alimentos || [])) {
        alimMap[a.id] = a
    }

    // ── Diagnóstico por receta ─────────────────────────────────────

    const problemas = []
    const reportes = []

    for (const r of recetas) {
        const issues = []
        const ings = ingPorReceta[r.id] || []
        const warnings = []

        // --- Campos básicos ---
        if (!r.nombre || r.nombre.trim() === '') issues.push('❌ Sin nombre')
        if (!r.descripcion || r.descripcion.trim().length < 15) issues.push('⚠️ Descripción corta o vacía')
        if (!r.instrucciones || r.instrucciones.trim().length < 30) {
            issues.push('❌ Instrucciones vacías o demasiado cortas')
        } else {
            const tienePasos = /^\s*\d+[\.\)]/m.test(r.instrucciones)
            if (!tienePasos) issues.push('⚠️ Instrucciones en párrafo (sin pasos numerados)')
        }

        // --- Clasificación ---
        if (r.tipo_plato && !TIPOS_PLATO_VALIDOS.includes(r.tipo_plato)) issues.push(`⚠️ tipo_plato inválido: "${r.tipo_plato}"`)
        if (r.categoria && !CATEGORIAS_VALIDAS.includes(r.categoria)) issues.push(`⚠️ categoría inválida: "${r.categoria}"`)
        if (r.tipo_coccion && !TIPOS_COCCION_VALIDOS.includes(r.tipo_coccion)) issues.push(`⚠️ tipo_coccion inválido: "${r.tipo_coccion}"`)
        if (r.dificultad && !DIFICULTADES_VALIDAS.includes(r.dificultad)) issues.push(`⚠️ dificultad inválida: "${r.dificultad}"`)
        if (r.estado && !ESTADOS_VALIDOS.includes(r.estado)) issues.push(`⚠️ estado inválido: "${r.estado}"`)
        if (r.fuente_tipo && !FUENTES_TIPO_VALIDAS.includes(r.fuente_tipo)) issues.push(`⚠️ fuente_tipo inválida: "${r.fuente_tipo}"`)

        // --- Intolerancias ---
        if (r.intolerancias && Array.isArray(r.intolerancias)) {
            for (const intol of r.intolerancias) {
                if (!INTOLERANCIAS_VALIDAS.includes(intol)) {
                    issues.push(`⚠️ intolerancia no estándar: "${intol}"`)
                }
            }
        }

        // --- Ingredientes ---
        if (ings.length === 0) {
            issues.push('❌ Sin ingredientes registrados')
        } else {
            // Buscar ingredientes sin alimento_id
            const sinId = ings.filter(i => !i.alimento_id)
            if (sinId.length > 0) {
                issues.push(`⚠️ ${sinId.length} ingrediente(s) sin alimento_id: ${sinId.map(i => i.nombre_libre).join(', ')}`)
            }

            // Buscar duplicados en nombres
            const nombres = ings.map(i => (i.nombre_libre || '').toLowerCase().trim().replace(/s$/, ''))
            const duplicados = nombres.filter((n, idx) => n && nombres.indexOf(n) !== idx)
            if (duplicados.length > 0) {
                issues.push(`⚠️ Ingredientes duplicados: ${[...new Set(duplicados)].join(', ')}`)
            }

            // Verificar orden (de mayor a menor)
            const ordenOk = ings.every((ing, idx) => {
                if (idx === 0) return true
                // Permitir que el último ingrediente sea más pequeño
                return true // ya no exigimos orden descendente estricto, es común tener especias al final
            })
        }

        // --- Macros ---
        const porciones = r.porciones || 1

        // Calcular macros TOTALES desde ingredientes
        let totalKcal = 0, totalProt = 0, totalCarbs = 0, totalGrasas = 0, totalFibra = 0, pesoTotal = 0
        let alimentosSinMacros = 0

        for (const ing of ings) {
            if (!ing.alimento_id || !ing.cantidad_gramos) continue
            const alim = alimMap[ing.alimento_id]
            if (!alim) continue

            const factor = ing.cantidad_gramos / 100
            totalKcal += (alim.calorias || 0) * factor
            totalProt += (alim.proteinas || 0) * factor
            totalCarbs += (alim.carbohidratos || 0) * factor
            totalGrasas += (alim.grasas || 0) * factor
            totalFibra += (alim.fibra || 0) * factor
            pesoTotal += ing.cantidad_gramos

            if (!alim.calorias || alim.calorias === 0) alimentosSinMacros++
        }

        // Macros esperados por porción
        const espKcal = porciones > 0 ? Math.round(totalKcal / porciones) : 0
        const espProt = porciones > 0 ? Math.round((totalProt / porciones) * 10) / 10 : 0
        const espCarbs = porciones > 0 ? Math.round((totalCarbs / porciones) * 10) / 10 : 0
        const espGrasas = porciones > 0 ? Math.round((totalGrasas / porciones) * 10) / 10 : 0

        const bdKcal = r.kcal ? Math.round(r.kcal) : 0
        const bdProt = r.proteinas ? Math.round(r.proteinas * 10) / 10 : 0
        const bdCarbs = r.carbohidratos ? Math.round(r.carbohidratos * 10) / 10 : 0
        const bdGrasas = r.grasas ? Math.round(r.grasas * 10) / 10 : 0

        // Comparar con tolerancia del 10%
        const diffKcal = espKcal > 0 ? Math.abs(espKcal - bdKcal) / espKcal * 100 : 0

        if (diffKcal > 10 && espKcal > 0) {
            if (alimentosSinMacros > 0) {
                issues.push(`⚠️ Macros posiblemente incorrectos (${bdKcal} kcal BD vs ${espKcal} kcal esperadas, ${Math.round(diffKcal)}% diff) - puede deberse a ${alimentosSinMacros} alimento(s) sin macros`)
            } else {
                issues.push(`❌ Macros incorrectos: BD=${bdKcal} kcal | Esperado=${espKcal} kcal (${Math.round(diffKcal)}% diff)`)
            }
        }

        // Verificar kcal_100g
        if (r.kcal_100g && pesoTotal > 0) {
            const esp100g = Math.round(totalKcal / pesoTotal * 100)
            const diff100g = Math.abs(esp100g - Math.round(r.kcal_100g || 0))
            if (diff100g > 15) {
                issues.push(`⚠️ kcal_100g posiblemente incorrecto: BD=${Math.round(r.kcal_100g)} | Esperado=${esp100g} (diff ${diff100g})`)
            }
        }

        // Verificar peso_total_g
        if (r.peso_total_g && pesoTotal > 0) {
            const diffPeso = Math.abs(r.peso_total_g - pesoTotal)
            if (diffPeso > 10) {
                issues.push(`⚠️ peso_total_g no coincide: BD=${r.peso_total_g}g | Calculado=${pesoTotal}g`)
            }
        }

        // --- Otros campos opcionales ---
        if (!r.tiempo_prep_min && !r.tiempo_coccion_min) warnings.push('ℹ️ Sin tiempos de preparación/ cocción')
        if (!r.dificultad) warnings.push('ℹ️ Sin dificultad')
        if (!r.categoria && !r.tipo_plato) warnings.push('ℹ️ Sin categoría ni tipo_plato')
        if (!r.tipo_coccion) warnings.push('ℹ️ Sin tipo de cocción')
        if (!r.intolerancias || r.intolerancias.length === 0) warnings.push('ℹ️ Sin intolerancias declaradas')
        if (!r.tags || r.tags.length === 0) warnings.push('ℹ️ Sin tags')

        // --- Reporte individual ---
        const tieneProblemas = issues.length > 0
        if (tieneProblemas) {
            problemas.push({ receta: r, issues, warnings, ings })
        }

        const estado = tieneProblemas ? '⚠️' : '✅'
        const resumen = [
            `${r.nombre?.substring(0, 45).padEnd(46)}`,
            `P:${porciones}`,
            `${bdKcal}kcal`,
            `${espKcal}esp`,
            `M:${alimentosSinMacros > 0 ? '⚠️' : '✅'}`,
        ]

        reportes.push({ r, issues, warnings, estado, resumen, ings, totalKcal, espKcal, bdKcal, alimentosSinMacros, porciones, pesoTotal })
    }

    // ── Reporte resumen ────────────────────────────────────────────

    console.log('═'.repeat(70))
    console.log('  📋 RECETAS CON PROBLEMAS')
    console.log('═'.repeat(70))

    const conProblemas = reportes.filter(r => r.issues.length > 0)
    const sinProblemas = reportes.filter(r => r.issues.length === 0)

    for (const rep of conProblemas) {
        console.log(`\n${'─'.repeat(60)}`)
        console.log(`  ${rep.estado} ${rep.r.nombre}`)
        console.log(`     ID: ${rep.r.id}`)
        console.log(`     Porciones: ${rep.porciones} | Kcal BD: ${rep.bdKcal} | Kcal esperadas: ${rep.espKcal} | Peso: ${rep.pesoTotal}g`)
        console.log(`     Ingredientes: ${rep.ings.length} | Alim.sin macros: ${rep.alimentosSinMacros}`)
        console.log(`     tipo_plato: ${rep.r.tipo_plato || '—'} | categoria: ${rep.r.categoria || '—'}`)
        console.log(`     tipo_coccion: ${rep.r.tipo_coccion || '—'} | dificultad: ${rep.r.dificultad || '—'}`)
        console.log(`     estado: ${rep.r.estado || '—'} | fuente_tipo: ${rep.r.fuente_tipo || '—'}`)
        console.log(`     dieta: ${(rep.r.intolerancias || []).join(', ') || '—'}`)
        console.log(`     tags: ${(rep.r.tags || []).join(', ') || '—'}`)
        console.log(`     descripción: ${rep.r.descripcion ? rep.r.descripcion.substring(0, 80) + '...' : '—'}`)

        // Instrucciones preview
        if (rep.r.instrucciones) {
            const lineas = rep.r.instrucciones.split('\n').filter(l => l.trim())
            console.log(`     Instrucciones: ${lineas.length} líneas | ${rep.r.instrucciones.length} chars`)
            if (lineas.length <= 3 && rep.r.instrucciones.length > 100) {
                console.log(`       → Posiblemente en párrafo (pocas líneas para ${rep.r.instrucciones.length} chars)`)
            }
        } else {
            console.log(`     Instrucciones: —`)
        }

        for (const issue of rep.issues) {
            console.log(`     ${issue}`)
        }
        for (const warn of rep.warnings) {
            console.log(`     ${warn}`)
        }

        // Mostrar ingredientes
        if (rep.ings.length > 0) {
            console.log(`     Ingredientes:`)
            for (const ing of rep.ings) {
                const alim = alimMap[ing.alimento_id]
                const macroStr = alim ? `${alim.calorias || 0}kcal/100g` : 'sin macro'
                console.log(`       ${ing.orden + 1}. ${ing.nombre_libre} (${ing.cantidad_gramos}g) [${macroStr}]${ing.alimento_id ? '' : ' 🏷️ SIN alimento_id'}`)
            }
        }
    }

    // ── Estadísticas globales ──────────────────────────────────────

    console.log('\n\n' + '═'.repeat(70))
    console.log('  📊 ESTADÍSTICAS GLOBALES')
    console.log('═'.repeat(70))

    console.log(`\n  Total recetas: ${recetas.length}`)
    console.log(`  ✅ Sin problemas: ${sinProblemas.length}`)
    console.log(`  ⚠️  Con problemas: ${conProblemas.length}`)

    // Contar problemas específicos
    let sinDescripcion = 0, sinInstrucciones = 0, instrParrafo = 0
    let sinIngredientes = 0, sinAlimentoId = 0, duplicados = 0
    let sinMacros = 0, sinCategoria = 0, sinCoccion = 0, sinDificultad = 0
    let sinIntolerancias = 0, sinTags = 0, sinTiempos = 0
    let conMacrosIncorrectos = 0

    for (const r of recetas) {
        const ings = ingPorReceta[r.id] || []

        if (!r.descripcion || r.descripcion.trim().length < 15) sinDescripcion++
        if (!r.instrucciones || r.instrucciones.trim().length < 30) sinInstrucciones++
        else if (!/^\s*\d+[\.\)]/m.test(r.instrucciones)) instrParrafo++
        if (ings.length === 0) sinIngredientes++
        if (ings.filter(i => !i.alimento_id).length > 0) sinAlimentoId++
        if (!r.categoria && !r.tipo_plato) sinCategoria++
        if (!r.tipo_coccion) sinCoccion++
        if (!r.dificultad) sinDificultad++
        if (!r.intolerancias || r.intolerancias.length === 0) sinIntolerancias++
        if (!r.tags || r.tags.length === 0) sinTags++
        if (!r.tiempo_prep_min && !r.tiempo_coccion_min) sinTiempos++

        // Macros incorrectos
        if (ings.length > 0) {
            let totalKcal = 0
            for (const ing of ings) {
                if (!ing.alimento_id || !ing.cantidad_gramos) continue
                const alim = alimMap[ing.alimento_id]
                if (!alim) continue
                totalKcal += (alim.calorias || 0) * (ing.cantidad_gramos / 100)
            }
            const porc = r.porciones || 1
            const esp = porc > 0 ? Math.round(totalKcal / porc) : 0
            const diff = esp > 0 ? Math.abs(esp - Math.round(r.kcal || 0)) / esp * 100 : 0
            if (diff > 10 && esp > 0) conMacrosIncorrectos++
        }
    }

    const problemsTable = [
        ['Descripción corta o vacía', sinDescripcion, `${Math.round(sinDescripcion / recetas.length * 100)}%`],
        ['Instrucciones vacías', sinInstrucciones, `${Math.round(sinInstrucciones / recetas.length * 100)}%`],
        ['Instrucciones en párrafo', instrParrafo, `${Math.round(instrParrafo / recetas.length * 100)}%`],
        ['Sin ingredientes', sinIngredientes, `${Math.round(sinIngredientes / recetas.length * 100)}%`],
        ['Ingredientes sin alimento_id', sinAlimentoId, `${Math.round(sinAlimentoId / recetas.length * 100)}%`],
        ['Sin categoría', sinCategoria, `${Math.round(sinCategoria / recetas.length * 100)}%`],
        ['Sin tipo cocción', sinCoccion, `${Math.round(sinCoccion / recetas.length * 100)}%`],
        ['Sin dificultad', sinDificultad, `${Math.round(sinDificultad / recetas.length * 100)}%`],
        ['Sin intolerancias', sinIntolerancias, `${Math.round(sinIntolerancias / recetas.length * 100)}%`],
        ['Sin tags', sinTags, `${Math.round(sinTags / recetas.length * 100)}%`],
        ['Sin tiempos prep/cocc', sinTiempos, `${Math.round(sinTiempos / recetas.length * 100)}%`],
        ['Macros incorrectos (>10% diff)', conMacrosIncorrectos, `${Math.round(conMacrosIncorrectos / recetas.length * 100)}%`],
    ]

    console.log(`\n  Problemas detectados:`)
    console.log(`  ${'─'.repeat(65)}`)
    console.log(`  ${'Problema'.padEnd(40)} ${'Cant'.padEnd(8)} %`)
    console.log(`  ${'─'.repeat(65)}`)
    for (const [prob, cant, pct] of problemsTable) {
        console.log(`  ${prob.padEnd(40)} ${String(cant).padEnd(8)} ${pct}`)
    }

    // ── Categorías y distribución ──────────────────────────────────

    console.log(`\n\n  Distribución por categoría:`)
    const cats = {}
    for (const r of recetas) {
        const cat = r.tipo_plato || r.categoria || 'Sin categoría'
        cats[cat] = (cats[cat] || 0) + 1
    }
    for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${cat.padEnd(20)} ${String(count).padStart(3)} recetas`)
    }

    console.log(`\n  Distribución por dificultad:`)
    const diffs = {}
    for (const r of recetas) {
        const d = r.dificultad || 'Sin especificar'
        diffs[d] = (diffs[d] || 0) + 1
    }
    for (const [d, count] of Object.entries(diffs).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${d.padEnd(20)} ${String(count).padStart(3)} recetas`)
    }

    // ── Rango de kcal ──────────────────────────────────────────────

    console.log(`\n\n  Rango de kcal por porción:`)
    const kcalOrdenadas = recetas.filter(r => r.kcal).map(r => r.kcal).sort((a, b) => a - b)
    if (kcalOrdenadas.length > 0) {
        const minimo = kcalOrdenadas[0]
        const maximo = kcalOrdenadas[kcalOrdenadas.length - 1]
        const media = kcalOrdenadas.reduce((a, b) => a + b, 0) / kcalOrdenadas.length
        console.log(`    Mínimo: ${Math.round(minimo)} kcal`)
        console.log(`    Máximo: ${Math.round(maximo)} kcal`)
        console.log(`    Media:  ${Math.round(media)} kcal`)

        // Detectar valores atípicos
        const atipicos = recetas.filter(r => r.kcal && (r.kcal < 50 || r.kcal > 1000))
        if (atipicos.length > 0) {
            console.log(`\n    ⚠️  Valores atípicos (<50 o >1000 kcal/porción):`)
            for (const r of atipicos) {
                console.log(`      ${r.nombre}: ${Math.round(r.kcal)} kcal (${r.porciones || 1} porc)`)
            }
        }
    }

    // ── Diagnóstico instrucciones ──────────────────────────────────

    console.log(`\n\n  Diagnóstico de instrucciones:`)
    let conPasos = 0, enParrafo = 0
    for (const r of recetas) {
        if (!r.instrucciones) continue
        if (/^\s*\d+[\.\)]/m.test(r.instrucciones)) conPasos++
        else enParrafo++
    }
    console.log(`    Con pasos numerados: ${conPasos}`)
    console.log(`    En párrafo: ${enParrafo}`)

    // ── Alimentos sin macros ───────────────────────────────────────

    const alimentosSinMacrosSet = new Set()
    for (const ing of (todosIng || [])) {
        if (ing.alimento_id) {
            const alim = alimMap[ing.alimento_id]
            if (alim && (!alim.calorias || alim.calorias === 0)) {
                alimentosSinMacrosSet.add(`${alim.nombre} (id:${alim.id})`)
            }
        }
    }
    if (alimentosSinMacrosSet.size > 0) {
        console.log(`\n  ⚠️  Alimentos con macros a cero que afectan recetas:`)
        for (const a of alimentosSinMacrosSet) {
            console.log(`    🥗 ${a}`)
        }
    }

    // ── Guardar reporte ────────────────────────────────────────────

    const fechaStr = new Date().toISOString().split('T')[0]
    const reportDir = resolve(RAÍZ, '..', 'salidas')
    if (!existsSync(reportDir)) {
        mkdirSync(reportDir, { recursive: true })
    }
    const reportPath = resolve(reportDir, `auditoria-recetario-${fechaStr}.md`)

    let reporteMd = `# Auditoría Completa del Recetario — ${fechaStr}\n\n`
    reporteMd += `**Total recetas:** ${recetas.length}\n`
    reporteMd += `**Sin problemas:** ${sinProblemas.length}\n`
    reporteMd += `**Con problemas:** ${conProblemas.length}\n\n`

    reporteMd += `## Problemas detectados\n\n`
    reporteMd += `| Problema | Cantidad | % |\n|---------|---------|---|\n`
    for (const [prob, cant, pct] of problemsTable) {
        reporteMd += `| ${prob} | ${cant} | ${pct} |\n`
    }

    reporteMd += `\n## Detalle por receta\n\n`

    for (const rep of conProblemas) {
        reporteMd += `### ${rep.r.nombre}\n\n`
        reporteMd += `- **ID:** ${rep.r.id}\n`
        reporteMd += `- **Porciones:** ${rep.porciones} | **Kcal BD:** ${rep.bdKcal} | **Kcal esperadas:** ${rep.espKcal}\n`
        reporteMd += `- **tipo_plato:** ${rep.r.tipo_plato || '—'} | **categoria:** ${rep.r.categoria || '—'}\n`
        reporteMd += `- **tipo_coccion:** ${rep.r.tipo_coccion || '—'} | **dificultad:** ${rep.r.dificultad || '—'}\n`
        reporteMd += `- **estado:** ${rep.r.estado || '—'} | **fuente_tipo:** ${rep.r.fuente_tipo || '—'}\n`
        reporteMd += `- **intolerancias:** ${(rep.r.intolerancias || []).join(', ') || '—'}\n`
        reporteMd += `- **tags:** ${(rep.r.tags || []).join(', ') || '—'}\n`
        reporteMd += `- **descripción:** ${rep.r.descripcion ? rep.r.descripcion.substring(0, 150) : '—'}\n\n`

        for (const issue of rep.issues) {
            reporteMd += `- ${issue}\n`
        }
        for (const warn of rep.warnings) {
            reporteMd += `- ${warn}\n`
        }
        reporteMd += '\n'
    }

    try {
        writeFileSync(reportPath, reporteMd, 'utf-8')
        console.log(`\n\n  📄 Reporte guardado en: ${reportPath}`)
    } catch (e) {
        console.log(`\n  ⚠️ No se pudo guardar reporte: ${e.message}`)
    }

    console.log('\n' + '═'.repeat(70))
    console.log('  ✅ AUDITORÍA COMPLETADA')
    console.log('═'.repeat(70) + '\n')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
