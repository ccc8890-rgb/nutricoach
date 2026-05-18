#!/usr/bin/env node
/**
 * MEJORAR MATCHING BONPREU/ESCLAT
 *
 * Diagnostica y corrige los matches incorrectos de productos Bonpreu/Esclat
 * usando DeepSeek para re-matcher contra alimentos canónicos reales.
 *
 * Fases:
 *   1. Diagnóstico — muestra estadísticas de calidad de matching
 *   2. DeepSeek batch — re-evalúa productos con mal match
 *   3. Aplica correcciones en BD
 *
 * Uso:
 *   node --env-file=.env.local scripts/bonpreu-esclat-deepseek-match.mjs
 *   node --env-file=.env.local scripts/bonpreu-esclat-deepseek-match.mjs --diagnostico
 *   node --env-file=.env.local scripts/bonpreu-esclat-deepseek-match.mjs --aplicar
 *
 * @author Carlos
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ──────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const SUPERMERCADOS = ['bonpreu', 'esclat']
const LOTE_DEEPSEEK = 30        // productos por llamada DeepSeek
const MAX_CANONICALES = 800     // alimentos canónicos a incluir en contexto

// Flags
const ES_DRY_RUN = !process.argv.includes('--aplicar')
const ES_DIAGNOSTICO = process.argv.includes('--diagnostico') || !process.argv.includes('--aplicar')

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY || !DEEPSEEK_API_KEY) {
    console.error('❌ Faltan env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEEPSEEK_API_KEY')
    process.exit(1)
}

const sup = createClient(SUPABASE_URL, SUPABASE_KEY)
const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: DEEPSEEK_API_KEY,
})

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function normalizar(nombre) {
    return nombre
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Determina si un match es realmente de baja calidad.
 *
 * CRITERIOS MEJORADOS:
 * - Categoría auto-creada (Supermercado*) → malo (el scraper creó un placeholder)
 * - Categoría Suplementos/Suplem. deportivos → malo (no es un alimento real)
 * - calorías = 0 + nombre no relacionado → malo
 * - calorías = 0 + nombre SÍ relacionado (agua, sal, especias, bicarbonato) → BUENO
 */
function esMatchDeBajaCalidad(alimento, nombreProducto) {
    if (!alimento) return true

    const cat = alimento.categoria || ''
    const nombreAlimento = (alimento.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nombreProd = (nombreProducto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // Categorías auto-creadas por scraper (placeholder) — siempre malo
    if (cat === 'Supermercado' || cat === 'Supermercado - Sin clasificar') return true

    // Suplementos — no son alimentos reales, marcar como malos
    if (cat === 'Suplementos' || cat === 'Suplementos deportivos') {
        // Pero si el nombre coincide (ej: "proteína whey" → "Proteína whey"), es válido
        const palabrasAlimento = nombreAlimento.split(/\s+/).filter(w => w.length > 3)
        const palabrasProducto = nombreProd.split(/\s+/).filter(w => w.length > 3)
        const coinciden = palabrasAlimento.some(p => palabrasProducto.includes(p))
        if (!coinciden) return true
    }

    // Alimentos con 0kcal — pueden ser legítimos (agua, sal, especias, bicarbonato)
    if (!alimento.calorias || alimento.calorias === 0) {
        // Verificar si el nombre del alimento está contenido en el producto
        // o si comparten palabras significativas (>= 4 letras)
        const palabrasClaveAlimento = nombreAlimento.split(/\s+/).filter(w => w.length >= 4)
        const palabrasClaveProducto = nombreProd.split(/\s+/).filter(w => w.length >= 4)

        // Si el nombre del alimento aparece completo en el producto → match válido
        if (nombreProd.includes(nombreAlimento)) return false

        // Si comparten al menos 1 palabra clave de 4+ letras → match válido
        const comparten = palabrasClaveAlimento.some(p => palabrasClaveProducto.includes(p))
        if (comparten) return false

        // Si no comparten palabras clave y tiene 0kcal → probablemente mal match
        return true
    }

    return false
}

function retry(fn, maxAttempts = 3, delay = 2000) {
    return fn().catch(async (err) => {
        for (let attempt = 2; attempt <= maxAttempts; attempt++) {
            console.warn(`  ⚠️  Intento ${attempt}/${maxAttempts} falló: ${err.message}. Reintentando en ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay * attempt))
            try { return await fn() } catch (e) { err = e }
        }
        throw err
    })
}

// ──────────────────────────────────────────────
// Fase 1: Diagnóstico
// ──────────────────────────────────────────────
async function diagnosticar(sup) {
    console.log('\n═══════════════════════════════════════════════')
    console.log('  📊 DIAGNÓSTICO DE MATCHING BONPREU/ESCLAT')
    console.log('═══════════════════════════════════════════════\n')

    const { data: sups } = await sup
        .from('supermercados')
        .select('id, nombre, slug')
        .in('slug', SUPERMERCADOS)

    let totalProductos = 0
    let totalBajaCalidad = 0
    let totalBuenaCalidad = 0
    const ejemplosMalos = []

    for (const s of sups) {
        const { data: prods, count } = await sup
            .from('productos_supermercado')
            .select('id, nombre_original, alimento_id, marca, precio_por_kg', { count: 'exact' })
            .eq('supermercado_id', s.id)

        if (!prods) continue
        totalProductos += prods.length

        let baja = 0
        let buena = 0

        for (const p of prods) {
            const { data: a } = await sup
                .from('alimentos')
                .select('id, nombre, categoria, calorias')
                .eq('id', p.alimento_id)
                .single()

            if (esMatchDeBajaCalidad(a, p.nombre_original)) {
                baja++
                totalBajaCalidad++
                if (ejemplosMalos.length < 20) {
                    ejemplosMalos.push({
                        supermercado: s.nombre,
                        producto: p.nombre_original,
                        alimento: a?.nombre || 'N/A',
                        categoria: a?.categoria || 'N/A',
                        calorias: a?.calorias || 0,
                    })
                }
            } else {
                buena++
                totalBuenaCalidad++
            }
        }

        console.log(`\n📌 ${s.nombre} (${s.slug}):`)
        console.log(`   Total productos: ${prods.length}`)
        console.log(`   ✅ Match bueno:   ${buena}`)
        console.log(`   ⚠️  Match malo:    ${baja}`)
        console.log(`   🎯 Tasa acierto:  ${(buena / (buena + baja) * 100).toFixed(1)}%`)
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  📊 TOTAL GLOBAL`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  Productos:       ${totalProductos}`)
    console.log(`  ✅ Buenos:       ${totalBuenaCalidad}`)
    console.log(`  ⚠️  Malos:       ${totalBajaCalidad}`)
    console.log(`  🎯 Tasa acierto: ${(totalBuenaCalidad / (totalBuenaCalidad + totalBajaCalidad) * 100).toFixed(1)}%`)

    if (ejemplosMalos.length > 0) {
        console.log(`\n🔍 Ejemplos de matches incorrectos (${ejemplosMalos.length} mostrados):`)
        for (const e of ejemplosMalos) {
            console.log(`   [${e.supermercado}] "${e.producto}"`)
            console.log(`      → "${e.alimento}" [${e.categoria}] ${e.calorias}kcal ⚠️`)
        }
    }

    return { totalProductos, totalBajaCalidad, totalBuenaCalidad, sups }
}

// ──────────────────────────────────────────────
// Fase 2: Recopilar productos a re-matcher
// ──────────────────────────────────────────────
async function getProductosParaRematcher(sup) {
    const { data: sups } = await sup
        .from('supermercados')
        .select('id, nombre, slug')
        .in('slug', SUPERMERCADOS)

    const productosARematchear = []

    for (const s of sups) {
        const { data: prods } = await sup
            .from('productos_supermercado')
            .select('id, nombre_original, alimento_id, marca')
            .eq('supermercado_id', s.id)

        if (!prods) continue

        for (const p of prods) {
            const { data: a } = await sup
                .from('alimentos')
                .select('id, nombre, categoria, calorias')
                .eq('id', p.alimento_id)
                .single()

            if (esMatchDeBajaCalidad(a, p.nombre_original)) {
                productosARematchear.push({
                    id: p.id,
                    nombre_original: p.nombre_original,
                    marca: p.marca,
                    alimento_actual_id: p.alimento_id,
                    alimento_actual_nombre: a?.nombre || 'N/A',
                    supermercado_id: s.id,
                    supermercado: s.nombre,
                })
            }
        }
    }

    return productosARematchear
}

// ──────────────────────────────────────────────
// Fase 3: Obtener alimentos canónicos
// ──────────────────────────────────────────────
async function getAlimentosCanonicos(sup) {
    // Alimentos reales (no auto-creados por scraper)
    const { data: alimentos } = await sup
        .from('alimentos')
        .select('id, nombre, categoria, calorias')
        .not('categoria', 'ilike', 'Supermercado%')
        .gte('calorias', 1)
        .limit(MAX_CANONICALES)

    if (!alimentos) return []

    // Ordenar por popularidad (calorias descendente como proxy)
    alimentos.sort((a, b) => (b.calorias || 0) - (a.calorias || 0))

    console.log(`   ${alimentos.length} alimentos canónicos cargados`)
    return alimentos
}

// ──────────────────────────────────────────────
// Fase 4: DeepSeek batch matching
// ──────────────────────────────────────────────
async function deepseekBatchRematcher(productos, canonicos) {
    console.log(`\n🧠 Enviando lote de ${productos.length} productos a DeepSeek...`)

    // Construir la lista de alimentos canónicos para contexto
    // Agrupamos por categoría y limitamos a los más relevantes
    const canonicosFormatted = canonicos
        .slice(0, MAX_CANONICALES)
        .map(a => `  "${a.nombre}" [${a.categoria}] ${a.calorias}kcal`)
        .join('\n')

    const productosFormatted = productos
        .map((p, i) => `  ${i + 1}. "${p.nombre_original}"${p.marca ? ` (marca: ${p.marca})` : ''}`)
        .join('\n')

    const prompt = `Eres un sistema de matching de productos de supermercado a alimentos de una base de datos nutricional.

Para CADA producto de la lista, debes elegir el MEJOR alimento canónico de la lista proporcionada.

REGLAS:
- Elige el alimento que MEJOR describa el producto. Ej: "BABYBEL Formatge tendre" → "Queso emmental u otros quesos"
- Si el producto es una marca específica de un alimento, elige el alimento genérico. Ej: "KRISSIA Surimi fresc en barretes" → "Surimi"
- Si hay múltiples candidatos, elige el más específico pero aún genérico
- NO inventes alimentos. Solo usa los de la lista proporcionada.
- Si NINGÚN alimento de la lista es razonable, responde null para ese producto.
- Prioriza matches por nombre y categoría, NO por calorías.

RESPONDE ÚNICAMENTE con un JSON array, donde cada elemento tiene:
- index: número del producto (1-based)
- alimento_id: ID del alimento canónico elegido, o null si no hay match
- alimento_nombre: nombre del alimento elegido, o null
- confianza: "alta" | "media" | "baja"

ALIMENTOS CANÓNICOS DISPONIBLES:
${canonicosFormatted}

PRODUCTOS A MATCHEAR:
${productosFormatted}

RESPUESTA (solo JSON, sin markdown):`

    const response = await retry(() =>
        deepseek.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages: [
                { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
        })
    )

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Respuesta vacía de DeepSeek')

    // Parsear JSON
    let resultados
    try {
        // Limpiar markdown si lo hubiera
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        resultados = JSON.parse(cleaned)
    } catch (e) {
        console.error('❌ Error parseando respuesta DeepSeek:', e.message)
        console.error('Respuesta raw:', content)
        throw e
    }

    // Normalizar a array
    const matches = Array.isArray(resultados) ? resultados : (resultados.matches || resultados.resultados || [])

    // Vincular índices a productos
    for (const m of matches) {
        const idx = m.index - 1
        if (idx >= 0 && idx < productos.length) {
            const canonic = canonicos.find(a => a.id === m.alimento_id || a.nombre === m.alimento_nombre)
            productos[idx].nuevo_alimento_id = canonic?.id || m.alimento_id
            productos[idx].nuevo_alimento_nombre = canonic?.nombre || m.alimento_nombre
            productos[idx].confianza = m.confianza || 'media'
        }
    }

    return productos
}

// ──────────────────────────────────────────────
// Fase 5: Aplicar correcciones
// ──────────────────────────────────────────────
async function aplicarCorrecciones(sup, productos, esDryRun) {
    let aplicados = 0
    let saltados = 0
    let errores = 0

    for (const p of productos) {
        if (!p.nuevo_alimento_id) {
            saltados++
            continue
        }

        if (p.nuevo_alimento_id === p.alimento_actual_id) {
            saltados++
            continue
        }

        if (esDryRun) {
            console.log(`   🔄 [DRY-RUN] "${p.nombre_original}"`)
            console.log(`      ${p.alimento_actual_nombre} → ${p.nuevo_alimento_nombre} (confianza: ${p.confianza})`)
            aplicados++
            continue
        }

        try {
            const { error } = await sup
                .from('productos_supermercado')
                .update({ alimento_id: p.nuevo_alimento_id })
                .eq('id', p.id)

            if (error) {
                console.error(`   ❌ Error actualizando "${p.nombre_original}": ${error.message}`)
                errores++
            } else {
                console.log(`   ✅ "${p.nombre_original}"`)
                console.log(`      ${p.alimento_actual_nombre} → ${p.nuevo_alimento_nombre}`)
                aplicados++
            }
        } catch (e) {
            console.error(`   ❌ Error: "${p.nombre_original}": ${e.message}`)
            errores++
        }
    }

    return { aplicados, saltados, errores }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function main() {
    console.log('🧠 MEJORAR MATCHING BONPREU/ESCLAT v1')
    console.log(`   Dry-run: ${ES_DRY_RUN ? 'SÍ 🌵' : 'NO ⚡'}`)
    console.log(`   Modo: ${ES_DIAGNOSTICO ? 'Diagnóstico completo' : 'Solo aplicar'}`)
    console.log(`   Modelo: ${DEEPSEEK_MODEL}`)

    // Fase 1: Diagnóstico
    const { totalBajaCalidad } = await diagnosticar(sup)

    if (totalBajaCalidad === 0) {
        console.log('\n🎉 No hay productos con match de baja calidad. Nada que corregir.')
        return
    }

    if (ES_DIAGNOSTICO && !process.argv.includes('--aplicar')) {
        console.log('\n💡 Para corregir los matches, ejecuta:')
        console.log('   node --env-file=.env.local scripts/bonpreu-esclat-deepseek-match.mjs --aplicar')
        console.log('   node --env-file=.env.local scripts/bonpreu-esclat-deepseek-match.mjs --aplicar --confirm  (skip confirmation prompt)')
        return
    }

    // Fase 2: Recopilar productos a re-matcher
    console.log('\n═══════════════════════════════════════════════')
    console.log('  🔍 RECOPILANDO PRODUCTOS CON MAL MATCH')
    console.log('═══════════════════════════════════════════════\n')
    const productos = await getProductosParaRematcher(sup)
    console.log(`   ${productos.length} productos requieren re-matcher`)

    if (productos.length === 0) {
        console.log('\n✅ No hay productos que corregir.')
        return
    }

    // Fase 3: Cargar alimentos canónicos
    console.log('\n═══════════════════════════════════════════════')
    console.log('  📦 CARGANDO ALIMENTOS CANÓNICOS')
    console.log('═══════════════════════════════════════════════\n')
    const canonicos = await getAlimentosCanonicos(sup)
    if (canonicos.length === 0) {
        console.error('❌ No se encontraron alimentos canónicos')
        process.exit(1)
    }

    // Fase 4: DeepSeek batch
    console.log('\n═══════════════════════════════════════════════')
    console.log('  🧠 DEEPSEEK BATCH MATCHING')
    console.log('═══════════════════════════════════════════════\n')

    const resultadosFinales = []
    for (let i = 0; i < productos.length; i += LOTE_DEEPSEEK) {
        const lote = productos.slice(i, i + LOTE_DEEPSEEK)
        console.log(`\n📦 Lote ${Math.floor(i / LOTE_DEEPSEEK) + 1}/${Math.ceil(productos.length / LOTE_DEEPSEEK)} (${lote.length} productos)`)
        const resultados = await deepseekBatchRematcher(lote, canonicos)
        resultadosFinales.push(...resultados)

        // Pequeña pausa entre lotes
        if (i + LOTE_DEEPSEEK < productos.length) {
            console.log('   ⏳ Esperando 1s antes del siguiente lote...')
            await new Promise(r => setTimeout(r, 1000))
        }
    }

    // Estadísticas de matching
    const conMatch = resultadosFinales.filter(p => p.nuevo_alimento_id).length
    const sinMatch = resultadosFinales.filter(p => !p.nuevo_alimento_id).length
    const cambiarian = resultadosFinales.filter(p => p.nuevo_alimento_id && p.nuevo_alimento_id !== p.alimento_actual_id).length

    console.log(`\n📊 Resultados DeepSeek:`)
    console.log(`   Total evaluados: ${resultadosFinales.length}`)
    console.log(`   ✅ Con match:    ${conMatch}`)
    console.log(`   ❌ Sin match:    ${sinMatch}`)
    console.log(`   🔄 Cambiarían:   ${cambiarian}`)

    if (ES_DRY_RUN) {
        console.log('\n💡 Para aplicar los cambios, ejecuta:')
        console.log('   node --env-file=.env.local scripts/bonpreu-esclat-deepseek-match.mjs --aplicar')
        return
    }

    // Fase 5: Aplicar correcciones
    console.log('\n═══════════════════════════════════════════════')
    console.log('  💾 APLICANDO CORRECCIONES EN BD')
    console.log('═══════════════════════════════════════════════\n')

    // Confirmación
    if (!process.argv.includes('--confirm')) {
        console.log(`\n⚠️  Se van a actualizar ${cambiarian} productos en BD.`)
        console.log('   Para saltar la confirmación, añade --confirm')
        console.log('   Presiona Ctrl+C para cancelar, o Enter para continuar...')
        await new Promise(resolve => {
            process.stdin.once('data', () => resolve())
        })
    }

    const result = await aplicarCorrecciones(sup, resultadosFinales, false)

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  📊 RESUMEN`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  ✅ Aplicados:  ${result.aplicados}`)
    console.log(`  ⏭️  Saltados:  ${result.saltados}`)
    console.log(`  ❌ Errores:    ${result.errores}`)
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})
