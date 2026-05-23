#!/usr/bin/env node
/**
 * diagnosticar-recetas-fallos.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  DIAGNÓSTICO COMPLETO DE FALLOS EN RECETAS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Detecta 4 tipos de fallos:
 *   TIPO A: Ingredientes NO vinculados (alimento_id = NULL)
 *           → "ingredientes fantasma" que existen en la receta pero no
 *             están linkeados a la tabla alimentos
 *
 *   TIPO B: Ingredientes cuyo alimento vinculado tiene calorias = 0
 *           → ingredientes que existen pero no aportan macros
 *
 *   TIPO C: Recetas con kcal = 0 o NULL teniendo ingredientes
 *           → recetas sin valor nutricional calculado
 *
 *   TIPO D: Ingredientes cuyo nombre NO aparece en las instrucciones
 *           → como "panela" en hummus: está en la lista pero no en
 *             los pasos de elaboración
 *
 * USO:
 *   node scripts/diagnosticar-recetas-fallos.mjs
 *   node scripts/diagnosticar-recetas-fallos.mjs --detalle    # muestra todos los ingredientes
 *   node scripts/diagnosticar-recetas-fallos.mjs --json       # salida JSON
 *   node scripts/diagnosticar-recetas-fallos.mjs --fix        # corrige lo corregible
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ═══════════════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════════════

const DETALLE = process.argv.includes('--detalle')
const JSON_OUTPUT = process.argv.includes('--json')
const FIX_MODE = process.argv.includes('--fix')
const DRY_RUN = !process.argv.includes('--apply')

// ═══════════════════════════════════════════════════════════════════════
//  SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════

function loadEnv() {
  const p = resolve(RAÍZ, '.env.local')
  if (!existsSync(p)) {
    console.error('❌ No se encuentra .env.local')
    process.exit(1)
  }
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ═══════════════════════════════════════════════════════════════════════
//  NORMALIZACIÓN DE TEXTO
// ═══════════════════════════════════════════════════════════════════════

function normalizar(texto) {
  if (!texto) return ''
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos/tildes
    .replace(/[^a-z0-9\s]/g, ' ')                      // quitar puntuación
    .replace(/\s+/g, ' ').trim()
}

function normalizarInstrucciones(texto) {
  if (!texto) return ''
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// ═══════════════════════════════════════════════════════════════════════
//  PAGINACIÓN HELPER
// ═══════════════════════════════════════════════════════════════════════

async function paginar(tabla, select, filtros = {}, pageSize = 1000) {
  const all = []
  let from = 0
  while (true) {
    let query = sb.from(tabla).select(select)
    for (const [k, v] of Object.entries(filtros)) {
      if (v === null) query = query.is(k, null)
      else if (Array.isArray(v)) query = query.in(k, v)
      else query = query.eq(k, v)
    }
    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    from += pageSize
    if (data.length < pageSize) break
  }
  return all
}

// ═══════════════════════════════════════════════════════════════════════
//  DIAGNÓSTICO
// ═══════════════════════════════════════════════════════════════════════

async function diagnosticar() {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║   🩺 DIAGNÓSTICO COMPLETO DE FALLOS EN RECETAS           ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo diagnóstico)' : '🚀 APLICANDO'}`)
  console.log('')

  const resultados = {
    ejecutado: new Date().toISOString(),
    modo: DRY_RUN ? 'dry-run' : 'aplicando',
    resumen: {},
    tipoA: [],
    tipoB: [],
    tipoC: [],
    tipoD: [],
    tipoStats: {}
  }

  // ─────────────────────────────────────────────────────────────────────
  //  CARGA MASIVA DE DATOS
  // ─────────────────────────────────────────────────────────────────────

  console.log('📦 Cargando datos...')

  // Todas las recetas
  const recetas = await paginar('recetas', 'id, nombre, instrucciones, kcal, proteinas, carbohidratos, grasas, peso_total_g, porciones, categoria, tipo_plato, created_at')
  console.log(`   📊 Recetas totales: ${recetas.length}`)

  // Todos los ingredientes de recetas
  const todosIngredientes = await paginar('receta_ingredientes', 'id, receta_id, nombre_libre, alimento_id, cantidad_gramos, orden')
  console.log(`   📊 Ingredientes totales: ${todosIngredientes.length}`)

  // Todos los alimentos
  const alimentos = await paginar('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas')
  console.log(`   📊 Alimentos totales: ${alimentos.length}`)

  const alimMap = {}
  for (const a of alimentos) { alimMap[a.id] = a }

  // Indexar ingredientes por receta
  const ingsPorReceta = {}
  for (const ing of todosIngredientes) {
    if (!ingsPorReceta[ing.receta_id]) ingsPorReceta[ing.receta_id] = []
    ingsPorReceta[ing.receta_id].push(ing)
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TIPO A: Ingredientes NO vinculados (alimento_id = NULL)
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n═══════════════════════════════════════════')
  console.log('  🔍 TIPO A: INGREDIENTES NO VINCULADOS')
  console.log('═══════════════════════════════════════════\n')

  const noVinculados = todosIngredientes.filter(i => !i.alimento_id && i.nombre_libre)
  const recetasConNoVinculados = new Set(noVinculados.map(i => i.receta_id))

  console.log(`  ❌ Total ingredientes sin vínculo: ${noVinculados.length}`)
  console.log(`  🍳 Recetas afectadas: ${recetasConNoVinculados.size}`)

  if (DETALLE && noVinculados.length > 0) {
    // Agrupar por receta
    const porReceta = {}
    for (const ing of noVinculados) {
      if (!porReceta[ing.receta_id]) porReceta[ing.receta_id] = []
      porReceta[ing.receta_id].push(ing)
    }

    for (const [rid, ings] of Object.entries(porReceta)) {
      const receta = recetas.find(r => r.id === rid)
      console.log(`\n  🍳 ${receta?.nombre || '?'} (${rid.substring(0, 8)}...)`)
      for (const ing of ings) {
        console.log(`     📛 "${ing.nombre_libre}" (${ing.cantidad_gramos || '?'}g)`)
      }
    }
  }

  resultados.tipoA = noVinculados.map(i => {
    const r = recetas.find(rec => rec.id === i.receta_id)
    return {
      receta_id: i.receta_id,
      receta_nombre: r?.nombre || '?',
      ingrediente_id: i.id,
      nombre_libre: i.nombre_libre,
      cantidad_gramos: i.cantidad_gramos
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  //  TIPO B: Ingredientes cuyo alimento tiene calorias = 0
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n═══════════════════════════════════════════')
  console.log('  🔍 TIPO B: INGREDIENTES CON CALORIAS=0')
  console.log('═══════════════════════════════════════════\n')

  const conCaloriasCero = []
  const alimentosCaloriasCero = []

  for (const ing of todosIngredientes) {
    if (!ing.alimento_id) continue
    const alim = alimMap[ing.alimento_id]
    if (alim && (alim.calorias === 0 || alim.calorias === null)) {
      conCaloriasCero.push(ing)
      if (!alimentosCaloriasCero.some(a => a.id === alim.id)) {
        alimentosCaloriasCero.push(alim)
      }
    }
  }

  const recetasConCaloriasCero = new Set(conCaloriasCero.map(i => i.receta_id))

  console.log(`  ❌ Alimentos con calorias=0 usados en recetas: ${alimentosCaloriasCero.length}`)
  console.log(`  ❌ Ingredientes afectados: ${conCaloriasCero.length}`)
  console.log(`  🍳 Recetas afectadas: ${recetasConCaloriasCero.size}`)

  if (DETALLE && conCaloriasCero.length > 0) {
    for (const alim of alimentosCaloriasCero) {
      console.log(`\n  🚫 "${alim.nombre}" (${alim.id.substring(0, 8)}...)`)
      const ingsDeEste = conCaloriasCero.filter(i => i.alimento_id === alim.id)
      for (const ing of ingsDeEste) {
        const r = recetas.find(rec => rec.id === ing.receta_id)
        console.log(`     → "${r?.nombre || '?'}" — "${ing.nombre_libre}" (${ing.cantidad_gramos || '?'}g)`)
      }
    }
  }

  resultados.tipoB = conCaloriasCero.map(i => {
    const r = recetas.find(rec => rec.id === i.receta_id)
    const a = alimMap[i.alimento_id]
    return {
      receta_id: i.receta_id,
      receta_nombre: r?.nombre || '?',
      ingrediente_id: i.id,
      nombre_libre: i.nombre_libre,
      alimento_nombre: a?.nombre || '?',
      cantidad_gramos: i.cantidad_gramos
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  //  TIPO C: Recetas con kcal = 0 o NULL
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n═══════════════════════════════════════════')
  console.log('  🔍 TIPO C: RECETAS SIN KCAL')
  console.log('═══════════════════════════════════════════\n')

  const recetasSinKcal = recetas.filter(r => {
    const kcal = Number(r.kcal)
    return (kcal === 0 || isNaN(kcal) || r.kcal === null) &&
      (ingsPorReceta[r.id]?.length > 0)
  })

  console.log(`  ❌ Recetas con kcal=0 o NULL (con ingredientes): ${recetasSinKcal.length}`)

  if (DETALLE && recetasSinKcal.length > 0) {
    for (const r of recetasSinKcal) {
      const ings = ingsPorReceta[r.id] || []
      const vinculados = ings.filter(i => i.alimento_id).length
      console.log(`\n  🍳 "${r.nombre}" (${r.id.substring(0, 8)}...)`)
      console.log(`     kcal: ${r.kcal} | ingredientes: ${ings.length} (${vinculados} vinculados)`)
    }
  }

  resultados.tipoC = recetasSinKcal.map(r => ({
    receta_id: r.id,
    receta_nombre: r.nombre,
    kcal: r.kcal,
    total_ingredientes: (ingsPorReceta[r.id] || []).length,
    vinculados: (ingsPorReceta[r.id] || []).filter(i => i.alimento_id).length
  }))

  // ═══════════════════════════════════════════════════════════════════
  //  TIPO D: Ingredientes que NO aparecen en instrucciones
  // ═══════════════════════════════════════════════════════════════════

  console.log('\n═══════════════════════════════════════════')
  console.log('  🔍 TIPO D: INGREDIENTES AUSENTES EN INSTRUCCIONES')
  console.log('═══════════════════════════════════════════\n')
  console.log('  (como "panela" listado en ingredientes pero no en pasos)\n')

  // Palabras a ignorar: nombres genéricos que suelen estar implícitos
  const PALABRAS_IGNORAR = new Set([
    'sal', 'pimienta', 'aceite', 'aceite de oliva', 'aceite de oliva virgen extra',
    'aceite vegetal', 'agua', 'hielo',
    'sal y pimienta', 'sal y pimienta al gusto',
    'al gusto', 'opcional', 'para decorar', 'para servir',
    'cdta', 'cda', 'cucharada', 'cucharadita', 'unidad', 'unidades',
    'al gusto', 'cantidad necesaria',
  ])

  function ingredienteNoEstaEnInstrucciones(nombreIngrediente, textoInstrucciones) {
    if (!nombreIngrediente || !textoInstrucciones) return false
    const n = normalizar(nombreIngrediente)
    const t = normalizarInstrucciones(textoInstrucciones)

    // Ignorar ingredientes genéricos
    if (PALABRAS_IGNORAR.has(n)) return false

    // Si el ingrediente es muy corto (< 3 chars) puede dar falsos positivos
    if (n.length < 3) return false

    // Buscar si aparece como palabra completa en las instrucciones
    // Primero probar coincidencia directa
    if (t.includes(n)) return false

    // Probar palabras que componen el nombre
    const palabrasIng = n.split(/\s+/).filter(p => p.length > 2)
    // Si alguna palabra clave aparece, asumir que está presente
    for (const p of palabrasIng) {
      // Palabras demasiado genéricas
      if (['con', 'sin', 'para', 'el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una'].includes(p)) continue
      if (t.includes(p)) return false
    }

    return true
  }

  const ingredientesAusentes = []
  const recetasConAusentes = new Set()

  // Optimización: procesar solo recetas que tienen instrucciones e ingredientes
  for (const r of recetas) {
    if (!r.instrucciones) continue
    const ings = ingsPorReceta[r.id]
    if (!ings || ings.length === 0) continue

    for (const ing of ings) {
      if (!ing.nombre_libre) continue
      if (ingredienteNoEstaEnInstrucciones(ing.nombre_libre, r.instrucciones)) {
        ingredientesAusentes.push({ receta: r, ingrediente: ing })
        recetasConAusentes.add(r.id)
      }
    }
  }

  console.log(`  ❌ Total ingredientes ausentes en instrucciones: ${ingredientesAusentes.length}`)
  console.log(`  🍳 Recetas afectadas: ${recetasConAusentes.size}`)

  // Mostrar los más relevantes (agrupados por receta)
  if (ingredientesAusentes.length > 0) {
    const porRecetaD = {}
    for (const item of ingredientesAusentes) {
      const rid = item.receta.id
      if (!porRecetaD[rid]) porRecetaD[rid] = { receta: item.receta, ings: [] }
      porRecetaD[rid].ings.push(item.ingrediente)
    }

    for (const [rid, grupo] of Object.entries(porRecetaD)) {
      const r = grupo.receta
      console.log(`\n  🍳 "${r.nombre}" (${rid.substring(0, 8)}...)`)
      for (const ing of grupo.ings) {
        const vinculado = ing.alimento_id ? '✅' : '❌'
        const kcal = ing.alimento_id ? (alimMap[ing.alimento_id]?.calorias || 0) : '—'
        console.log(`     ${vinculado} "${ing.nombre_libre}" (${ing.cantidad_gramos || '?'}g) → kcal: ${kcal}`)
      }
    }
  }

  resultados.tipoD = ingredientesAusentes.map(item => {
    const ing = item.ingrediente
    const alim = ing.alimento_id ? alimMap[ing.alimento_id] : null
    return {
      receta_id: item.receta.id,
      receta_nombre: item.receta.nombre,
      ingrediente_id: ing.id,
      nombre_libre: ing.nombre_libre,
      cantidad_gramos: ing.cantidad_gramos,
      vinculado: !!ing.alimento_id,
      alimento_kcal: alim?.calorias || (ing.alimento_id ? 0 : null)
    }
  })

  // ═══════════════════════════════════════════════════════════════════
  //  RESUMEN
  // ═══════════════════════════════════════════════════════════════════

  resultados.resumen = {
    total_recetas: recetas.length,
    total_ingredientes: todosIngredientes.length,
    total_alimentos: alimentos.length,
    tipoA_sin_vinculo: noVinculados.length,
    tipoA_recetas_afectadas: recetasConNoVinculados.size,
    tipoB_calorias_cero: conCaloriasCero.length,
    tipoB_alimentos_calorias_cero: alimentosCaloriasCero.length,
    tipoB_recetas_afectadas: recetasConCaloriasCero.size,
    tipoC_recetas_sin_kcal: recetasSinKcal.length,
    tipoD_ausentes_en_instrucciones: ingredientesAusentes.length,
    tipoD_recetas_afectadas: recetasConAusentes.size
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║   📊 RESUMEN GLOBAL                                       ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`  📦 Total recetas:       ${recetas.length}`)
  console.log(`  📦 Total ingredientes:  ${todosIngredientes.length}`)
  console.log(`  📦 Total alimentos:     ${alimentos.length}`)
  console.log('')
  console.log(`  🅰️  Ingredientes sin vínculo:        ${noVinculados.length} (en ${recetasConNoVinculados.size} recetas)`)
  console.log(`  🅱️  Ingredientes con calorias=0:      ${conCaloriasCero.length} (${alimentosCaloriasCero.length} alimentos distintos, ${recetasConCaloriasCero.size} recetas)`)
  console.log(`  🅲  Recetas sin kcal calculadas:      ${recetasSinKcal.length}`)
  console.log(`  🅳  Ingredientes ausentes en pasos:   ${ingredientesAusentes.length} (en ${recetasConAusentes.size} recetas)`)
  console.log('')

  // ─────────────────────────────────────────────────────────────────────
  //  ACCIONES DE FIX
  // ─────────────────────────────────────────────────────────────────────

  if (FIX_MODE) {
    console.log('╔════════════════════════════════════════════════════════════╗')
    console.log(`║   ${DRY_RUN ? '🔍 SIMULACIÓN' : '🚀 APLICANDO'} CORRECCIONES                     ║`)
    console.log('╚════════════════════════════════════════════════════════════╝')

    // ── FIX Tipo C: Recalcular macros para recetas con kcal=0 ──
    if (recetasSinKcal.length > 0) {
      console.log(`\n📊 Recalculando macros de ${recetasSinKcal.length} recetas con kcal=0...`)
      let ok = 0, fail = 0
      for (const r of recetasSinKcal) {
        if (DRY_RUN) {
          console.log(`   🔍 [DRY-RUN] Recalcularía: "${r.nombre}"`)
          ok++
        } else {
          try {
            const { error } = await sb.rpc('calcular_macros_receta', { p_receta_id: r.id })
            if (error) {
              console.log(`   ❌ "${r.nombre}": ${error.message}`)
              fail++
            } else {
              console.log(`   ✅ "${r.nombre}"`)
              ok++
            }
          } catch (e) {
            console.log(`   ❌ "${r.nombre}": ${e.message}`)
            fail++
          }
        }
      }
      console.log(`   Resultado: ${ok} OK, ${fail} errores`)
      resultados.fix_tipoC = { ok, fail, dry_run: DRY_RUN }
    }

    // ── FIX Tipo A + B: Desvincular ingredientes con alimentos malos ──
    // Combinamos Tipo A (no vinculados) y Tipo B (calorias=0)
    // Para Tipo A no hay nada que "desvincular", ya están sin vínculo
    // Para Tipo B, opcionalmente se podría desvincular el alimento malo
    // Pero eso requiere cuidado, mejor solo reportar

    console.log(`\n   ℹ️  Los Tipo A (sin vínculo) requieren re-match manual o`)
    console.log(`      ejecutar scripts/fix-recetario-completo.mjs fase1b`)
    console.log(`   ℹ️  Los Tipo B (calorias=0) necesitan que se asignen macros`)
    console.log(`      a esos alimentos en la tabla alimentos`)
    console.log(`   ℹ️  Los Tipo D (ingredientes no en pasos) requieren`)
    console.log(`      regenerar la receta o editar instrucciones manualmente`)
  }

  // ═══════════════════════════════════════════════════════════════════
  //  OUTPUT JSON
  // ═══════════════════════════════════════════════════════════════════

  if (JSON_OUTPUT) {
    const outputPath = resolve(RAÍZ, 'salidas/diagnostico-recetas-fallos.json')
    writeFileSync(outputPath, JSON.stringify(resultados, null, 2))
    console.log(`\n📄 JSON guardado en: salidas/diagnostico-recetas-fallos.json`)
  }

  console.log('')
  return resultados
}

diagnosticar().catch(e => { console.error('Error fatal:', e); process.exit(1) })
