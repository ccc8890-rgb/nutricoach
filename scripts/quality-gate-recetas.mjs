/**
 * quality-gate-recetas.mjs
 *
 * Validador automático de calidad del recetario.
 * Detecta: matches de ingredientes sospechosos, macros absurdas, fotos faltantes,
 * porciones incorrectas, instrucciones vacías, intolerancias sin etiquetar.
 *
 * Aprendido de auditoría 14-05-2026:
 *   - aceite de coco → aceite de oliva (palabra genérica "aceite" daba match)
 *   - proteína en polvo → barrita Enervit  (solo coincidía "proteína")
 *   - harina de almendra → harina de avena (solo coincidía "harina")
 *   - polvo de hornear → cebolla en polvo  (solo coincidía "polvo")
 *   - crema de avellana → tomate frito     (solo coincidía "sin azúcar")
 *
 * USO:
 *   node scripts/quality-gate-recetas.mjs              → últimas 50 recetas
 *   node scripts/quality-gate-recetas.mjs --todas      → todas las recetas
 *   node scripts/quality-gate-recetas.mjs --limite=20  → últimas N recetas
 *   node scripts/quality-gate-recetas.mjs --json       → output JSON para CI
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const ARGS = process.argv.slice(2)
const MODO_JSON = ARGS.includes('--json')
const TODAS = ARGS.includes('--todas')
const LIMITE = TODAS ? 9999 : (parseInt(ARGS.find(a => a.startsWith('--limite='))?.split('=')[1]) || 50)

// ── Sinónimos validados (match correcto aunque las palabras difieran) ────────
// Aprendidos de auditoría 14-05-2026 y sesiones previas
const SINONIMOS_VALIDOS = [
  ['ajete', 'ajo tierno'],
  ['ajetes', 'ajo tierno'],
  ['zucchini', 'calabacin'],
  ['papa', 'patata'],
  ['camote', 'boniato'],
  ['chile', 'cayena'],
  ['aji', 'cayena'],
  ['aji', 'pimenton'],
  ['salsa inglesa', 'worcestershire'],
  ['mani', 'cacahuete'],
  ['maní', 'cacahuete'],
  ['nata', 'crema de leche'],
  ['levadura quimica', 'polvo de hornear'],
  ['bicarbonato', 'levadura'],
  // Agua — cualquier variante de marca/gas → Agua genérica (match forzado en bridge)
  ['agua', 'agua'],
  // Aceite vegetal → aceite girasol (aceite vegetal genérico = girasol en BD)
  ['aceite vegetal', 'girasol'],
  // Tortilla francesa (2 huevos) → Huevos: la tortilla francesa ES huevos
  ['tortilla francesa', 'huevo'],
  ['tortilla francesa', 'huevos'],
  // Zumo de lima → lima: el zumo contiene lima
  ['zumo de lima', 'lima'],
  ['zumo limon', 'limon'],
]

// ── Matches forzados (cualquier patrón normalizado → alimento válido) ─────────
// Espejo del _MATCHES_FORZADOS del bridge. Si el nombre libre contiene el patrón,
// el match se considera siempre correcto independientemente del alimento linkeado.
const PATRONES_MATCH_FORZADO = [
  'agua', // agua* → Agua genérica siempre es correcto
]

function esMatchForzadoValido(nombreLibre) {
  const n = norm(nombreLibre)
  return PATRONES_MATCH_FORZADO.some(p => n.startsWith(p) || n === p)
}

function esSinonimoValido(nombreLibre, nombreAlimento) {
  const nL = norm(nombreLibre)
  const nA = norm(nombreAlimento)
  return SINONIMOS_VALIDOS.some(([a, b]) =>
    (nL.includes(norm(a)) && nA.includes(norm(b))) ||
    (nL.includes(norm(b)) && nA.includes(norm(a)))
  )
}

function normSingular(s) {
  // Elimina trailing 's' y 'es' para comparar singular/plural
  return s.endsWith('es') && s.length > 4 ? s.slice(0, -2)
    : s.endsWith('s') && s.length > 3 ? s.slice(0, -1)
    : s
}

function limpiarParentesis(s) {
  return s.replace(/\(.*?\)/g, '').trim()
}

// ── Palabras genéricas (no pueden ser la única base de un match) ─────────────
const GENERICAS = new Set([
  'pasta', 'caldo', 'crema', 'salsa', 'harina', 'aceite', 'queso', 'leche',
  'pan', 'agua', 'azucar', 'sal', 'polvo', 'fresco', 'natural', 'casero',
  'preparado', 'mezcla', 'bebida', 'zumo', 'base', 'pure', 'copos',
  'extracto', 'aroma', 'sabor', 'concentrado', 'seco', 'deshidratado',
  'integral', 'light', 'zero', 'bajo', 'alto', 'sin', 'con', 'para',
])

const ESPECIAS = new Set([
  'sal', 'pimienta', 'comino', 'canela', 'curcuma', 'pimenton', 'oregano',
  'tomillo', 'romero', 'jengibre', 'cardamomo', 'clavo', 'anis', 'vainilla',
  'perejil', 'cilantro', 'menta', 'albahaca', 'eneldo', 'estragon', 'laurel',
  'cayena', 'paprika', 'azafran', 'nuez moscada', 'chile', 'curry',
])

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim()
}

function esEspecia(nombre) {
  const n = norm(nombre)
  return Array.from(ESPECIAS).some(e => n.includes(e))
}

// ── Validaciones ─────────────────────────────────────────────────────────────

function checkMatchSospechoso(nombreLibre, nombreAlimento) {
  // Match forzado conocido → siempre OK (bridge lo maneja con bypass)
  if (esMatchForzadoValido(nombreLibre)) return null

  // Sinónimos validados → siempre OK
  if (esSinonimoValido(nombreLibre, nombreAlimento)) return null

  // Caso especial: el nombre del alimento aparece dentro del paréntesis del ingrediente
  // Ej: "Edulcorante granulado (eritritol)" → "eritritol" es correcto
  const contenidoParentesisLibre = (nombreLibre.match(/\(([^)]+)\)/g) || [])
    .map(p => norm(p.replace(/[()]/g, '')))
  if (contenidoParentesisLibre.some(p => norm(nombreAlimento).includes(p) || p.includes(norm(nombreAlimento)))) {
    return null
  }
  // Caso especial inverso: el ingrediente aparece dentro del paréntesis del alimento
  // Ej: "chili flakes" → "Hojuelas de chile (chili flakes)" es correcto
  const contenidoParentesisAlim = (nombreAlimento.match(/\(([^)]+)\)/g) || [])
    .map(p => norm(p.replace(/[()]/g, '')))
  if (contenidoParentesisAlim.some(p => norm(nombreLibre).includes(p) || p.includes(norm(nombreLibre)))) {
    return null
  }

  // Limpiar paréntesis antes de analizar palabras
  const libreClean = limpiarParentesis(nombreLibre)
  const alimClean  = limpiarParentesis(nombreAlimento)

  const wL = norm(libreClean).split(/\s+/).filter(w => !GENERICAS.has(w) && w.length > 3)
  const wA = norm(alimClean).split(/\s+/).filter(w => !GENERICAS.has(w) && w.length > 3)

  if (wL.length === 0) return null // ingrediente totalmente genérico (sal, agua...)

  // Comparar con singularización para evitar falso positivo avellana/avellanas
  const wLsing = wL.map(normSingular)
  const wAsing = wA.map(normSingular)
  const coincide = wLsing.some(w => wAsing.includes(w))

  if (!coincide) {
    return `"${nombreLibre}" → "${nombreAlimento}" (sin palabras significativas comunes)`
  }
  return null
}

function checkCantidadSospechosa(nombre, gramos) {
  if (gramos === null || gramos === undefined) return `sin cantidad (null)`
  if (gramos <= 0) return `cantidad 0 o negativa (${gramos}g)`
  if (esEspecia(nombre) && gramos > 30) return `especia con ${gramos}g (esperado <30g)`
  if (!esEspecia(nombre) && gramos < 2 && gramos > 0) return `cantidad muy pequeña (${gramos}g)`
  if (gramos > 2000) return `cantidad absurda (${gramos}g)`
  return null
}

function checkMacrosSospechosas(kcal, tipo_plato) {
  const RANGOS = {
    'Desayuno':  { min: 80,  max: 900 },
    'Almuerzo':  { min: 50,  max: 600 },
    'Comida':    { min: 100, max: 1200 },
    'Cena':      { min: 80,  max: 1000 },
    'Snack':     { min: 30,  max: 500 },
    'Merienda':  { min: 50,  max: 600 },
    'Postre':    { min: 30,  max: 800 },
    'Bebida':    { min: 0,   max: 300 },
    'Condimento':{ min: 0,   max: 200 },
  }
  const rango = RANGOS[tipo_plato] || { min: 50, max: 1500 }
  if (kcal < rango.min) return `${kcal} kcal/porción es muy bajo para ${tipo_plato} (mín ${rango.min})`
  if (kcal > rango.max) return `${kcal} kcal/porción es muy alto para ${tipo_plato} (máx ${rango.max})`
  return null
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!MODO_JSON) {
    console.log(`🔍 Quality Gate — últimas ${TODAS ? 'TODAS' : LIMITE} recetas\n`)
  }

  // Cargar recetas con ingredientes
  const { data: recetas, error } = await sb
    .from('recetas')
    .select(`
      id, nombre, tipo_plato, kcal, porciones, imagen_url,
      instrucciones, descripcion, intolerancias, estado,
      receta_ingredientes (
        id, nombre_libre, cantidad_gramos,
        alimentos ( id, nombre, calorias )
      )
    `)
    .eq('estado', 'aprobada')
    .order('created_at', { ascending: false })
    .limit(LIMITE)

  if (error) { console.error('Error:', error.message); process.exit(1) }

  const issues = []
  let totalOk = 0

  for (const receta of (recetas || [])) {
    const recetaIssues = []

    // 1. Foto faltante
    if (!receta.imagen_url) {
      recetaIssues.push({ tipo: 'foto', msg: 'Sin imagen' })
    }

    // 2. Instrucciones vacías
    if (!receta.instrucciones || receta.instrucciones.trim().length < 20) {
      recetaIssues.push({ tipo: 'instrucciones', msg: 'Instrucciones vacías o muy cortas' })
    }

    // 3. Intolerancias sin etiquetar (array vacío)
    if (!receta.intolerancias || receta.intolerancias.length === 0) {
      recetaIssues.push({ tipo: 'intolerancias', msg: 'Sin intolerancias etiquetadas' })
    }

    // 4. Macros sospechosas
    if (receta.kcal > 0 && receta.tipo_plato) {
      const macroIssue = checkMacrosSospechosas(receta.kcal, receta.tipo_plato)
      if (macroIssue) {
        recetaIssues.push({ tipo: 'macros', msg: macroIssue })
      }
    }

    // 5. Muy pocos ingredientes (extracción incompleta)
    const numIngs = receta.receta_ingredientes?.length || 0
    if (numIngs < 3) {
      recetaIssues.push({ tipo: 'ingredientes', msg: `Solo ${numIngs} ingredientes (extracción sospechosa)` })
    }

    // 6. Revisar cada ingrediente
    for (const ing of (receta.receta_ingredientes || [])) {
      const nombreLibre = ing.nombre_libre || ''
      const nombreAlimento = ing.alimentos?.nombre || ''
      const gramos = ing.cantidad_gramos

      // Match sospechoso
      if (nombreAlimento) {
        const matchIssue = checkMatchSospechoso(nombreLibre, nombreAlimento)
        if (matchIssue) {
          recetaIssues.push({ tipo: 'match', msg: matchIssue })
        }
      }

      // Cantidad sospechosa
      const cantidadIssue = checkCantidadSospechosa(nombreLibre, gramos)
      if (cantidadIssue) {
        recetaIssues.push({ tipo: 'cantidad', msg: `"${nombreLibre}": ${cantidadIssue}` })
      }
    }

    if (recetaIssues.length > 0) {
      issues.push({
        id: receta.id,
        nombre: receta.nombre,
        tipo_plato: receta.tipo_plato,
        kcal: receta.kcal,
        issues: recetaIssues,
      })
    } else {
      totalOk++
    }
  }

  // ── Output ──────────────────────────────────────────────────────────────────
  if (MODO_JSON) {
    const output = {
      fecha: new Date().toISOString().slice(0, 10),
      total_revisadas: recetas?.length || 0,
      ok: totalOk,
      con_issues: issues.length,
      issues,
    }
    const archivo = resolve(ROOT, `salidas/quality-gate-${output.fecha}.json`)
    writeFileSync(archivo, JSON.stringify(output, null, 2))
    console.log(JSON.stringify({ ok: totalOk, con_issues: issues.length, archivo }))
    return
  }

  // Output humano
  const byTipo = {}
  issues.forEach(r => r.issues.forEach(i => {
    byTipo[i.tipo] = (byTipo[i.tipo] || 0) + 1
  }))

  console.log(`📊 Revisadas: ${recetas?.length} | ✅ OK: ${totalOk} | ⚠️  Con issues: ${issues.length}`)
  console.log(`\nIssues por tipo:`)
  Object.entries(byTipo).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const icono = { match: '🔗', macros: '🔢', foto: '🖼️', instrucciones: '📝', cantidad: '⚖️', intolerancias: '🏷️', ingredientes: '🧩' }[k] || '❓'
    console.log(`  ${icono} ${k}: ${v}`)
  })

  if (issues.length === 0) {
    console.log('\n✅ Todas las recetas pasan el quality gate')
    return
  }

  console.log(`\n${'─'.repeat(60)}`)
  for (const r of issues) {
    // Solo mostrar recetas con issues CRÍTICOS (match o macros absurdas)
    const criticos = r.issues.filter(i => ['match', 'macros'].includes(i.tipo))
    if (criticos.length === 0) continue

    console.log(`\n⚠️  ${r.nombre} (${r.tipo_plato}, ${r.kcal} kcal)`)
    criticos.forEach(i => console.log(`   [${i.tipo}] ${i.msg}`))
  }

  // Sugerir añadir al bridge los matches problemáticos recurrentes
  const matchIssues = issues.flatMap(r =>
    r.issues.filter(i => i.tipo === 'match').map(i => ({ receta: r.nombre, msg: i.msg }))
  )
  if (matchIssues.length > 0) {
    // Extraer el patrón libre de cada match problemático (primera palabra significativa)
    const sugerencias = new Set()
    matchIssues.forEach(({ msg }) => {
      const m = msg.match(/"([^"]+)" →/)
      if (m) {
        const palabras = norm(m[1]).split(/\s+/).filter(w => !GENERICAS.has(w) && w.length > 3)
        if (palabras.length > 0) sugerencias.add(palabras[0])
      }
    })
    if (sugerencias.size > 0) {
      console.log(`\n🔧 Añadir a _MATCHES_FORZADOS en bridge_nutricoach.py si son sistemáticos:`)
      sugerencias.forEach(s => console.log(`   ("${s}", "<alimento_id>"),`))
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`\n💡 Para ver TODO (incluyendo fotos/intolerancias): node scripts/quality-gate-recetas.mjs --todas`)
  console.log(`   Para exportar JSON: node scripts/quality-gate-recetas.mjs --json`)
}

main().catch(e => { console.error(e); process.exit(1) })
