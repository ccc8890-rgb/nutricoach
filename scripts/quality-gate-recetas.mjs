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
  // Lima ↔ Limón: intercambiables como ácido en cocina
  ['lima', 'limon'],
  ['zumo de lima', 'lima'],
  ['zumo de lima', 'limon'],
  ['zumo limon', 'limon'],
  // Crema de chocolate con avellanas → nutella (producto de marca equivalente)
  ['crema de chocolate con avellanas', 'nutella'],
  ['crema chocolate avellana', 'nutella'],
  // Tomates secos → tomate seco (variante con/sin "hacendado" o "en aceite")
  ['tomates secos', 'tomate seco'],
  // Queso cottage — variantes ortográficas
  ['queso cottage', 'queso cottage'],
  ['queso cotas', 'queso cottage'],
  ['queso fresco', 'queso cottage'],
  // Salsa de tomate — cualquier variante
  ['salsa de tomate', 'salsa de tomate'],
  ['salsa tomate', 'salsa de tomate'],
  ['salsa verde', 'salsa de tomate'],
  // Salsa picante
  ['salsa picante', 'tabasco'],
  ['salsa picante', 'salsa picante'],
  // Salsa Worcestershire / inglesa
  ['salsa inglesa', 'worcestershire'],
  ['salsa perrins', 'worcestershire'],
  // Harina de almendra
  ['harina de almendra', 'harina de almendra'],
  ['harina de almendras', 'harina de almendra'],
  // Harina de trigo
  ['harina de trigo', 'harina de trigo'],
  // Ajo picado
  ['ajo picado', 'ajo'],
  // Azúcar glass/glas
  ['azucar glass', 'azucar glas'],
  ['azucar glas', 'azucar glas'],
  // Cubitos de hielo → hielo
  ['cubitos de hielo', 'cubos hielo'],
  ['cubito de hielo', 'cubos hielo'],
  ['hielo', 'cubos hielo'],
  // Cebolla en polvo
  ['cebolla en polvo', 'cebolla en polvo'],
  // Espinacas baby
  ['espinacas baby', 'espinacas'],
  ['espinacas', 'espinacas'],
  // Tomate natural/triturado/frito
  ['tomates', 'tomate natural'],
  ['tomates cherry', 'tomate pera'],
  ['tomate triturado', 'tomate triturado'],
  ['tomate frito', 'tomate frito'],
  // Fideos de arroz → arroz
  ['fideos de arroz', 'arroz'],
  ['fideo de arroz', 'arroz'],
  // Pasta de trufa → pasta
  ['pasta de trufa', 'pasta'],
  // Salsa de tomate sin azúcar
  ['salsa de tomate sin azucar', 'salsa de tomate'],
  ['salsa de tomate sin azúcar', 'salsa de tomate'],
  ['salsa de tomate sin azucares', 'salsa de tomate'],
  ['salsa de tomate sin azúcares', 'salsa de tomate'],
  ['salsa de tomate zero', 'salsa de tomate'],
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

// Especias/condimentos secos — se comparan como PALABRAS COMPLETAS (no substring)
// para evitar falsos positivos: "sal" ≠ "salmón", "sal" ≠ "salsa de soja"
const ESPECIAS = new Set([
  'sal', 'pimienta', 'comino', 'canela', 'curcuma', 'pimenton', 'oregano',
  'tomillo', 'romero', 'jengibre', 'cardamomo', 'clavo', 'anis', 'vainilla',
  'perejil', 'cilantro', 'menta', 'albahaca', 'eneldo', 'estragon', 'laurel',
  'cayena', 'paprika', 'azafran', 'curry',
  'ajo',   // 1-10g es cantidad normal de condimento
  'chile', // chile seco/fresco: pequeñas cantidades son válidas como especia
])
// Especias de múltiples palabras (se comparan como frase completa)
const ESPECIAS_MULTI = ['nuez moscada', 'chile en polvo', 'pimiento rojo seco']

// Si la PRIMERA palabra del ingrediente es un alimento no-especia, se ignora que
// contenga palabras de especia como calificadores.
// Ej: "yogur sabor vainilla" → primera="yogur" → NO especia
// Ej: "salsa de soja baja en sal" → primera="salsa" → NO especia
// Ej: "pimienta para salsa de hamburguesa" → primera="pimienta" → SÍ especia
const NO_ESPECIA_PRIMERA_PALABRA = new Set([
  'yogur', 'yogurt', 'kefir', 'leche', 'queso', 'proteina', 'batido',
  'cereales', 'granola', 'barrita', 'helado', 'mousse',
  'salsa', 'mantequilla', 'manteca', 'overnight',
])

// Palabras ancla de alimento complejo — si aparecen EN CUALQUIER LUGAR del nombre
// indican que el ingrediente es un producto alimenticio, no una especia pura.
// Ej: "Overnight Oats de Proteína y Vainilla" → contiene "oats" → no es especia aunque tenga "vainilla"
const ANCLA_ALIMENTO = new Set(['oats', 'avena', 'proteina', 'protein'])

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim()
}

function esEspecia(nombre) {
  const n = norm(nombre)
  const palabras = n.split(/\s+/)

  // Primera palabra significativa → si identifica alimento no-especia, parar aquí
  const primeraPalabra = palabras.find(w => w.length > 2) || ''
  if (NO_ESPECIA_PRIMERA_PALABRA.has(primeraPalabra)) return false

  // Palabras ancla de producto alimenticio complejo → si aparecen en cualquier posición, no es especia
  if (palabras.some(p => ANCLA_ALIMENTO.has(p))) return false

  // Caso especial: "sin sal" → "sal" actúa como calificador (= without salt), no como ingrediente.
  // Ej: "cacahuetes sin sal", "anacardos sin sal", "mantequilla sin sal añadida"
  const palabrasAnalizar = n.includes('sin sal') ? palabras.filter(p => p !== 'sal') : palabras

  // Comprobar especias por word-boundary exacto
  if (Array.from(ESPECIAS).some(e => palabrasAnalizar.includes(e))) return true
  // Comprobar especias de múltiples palabras (frase)
  if (ESPECIAS_MULTI.some(em => n.includes(em))) return true
  return false
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
  const alimClean = limpiarParentesis(nombreAlimento)

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

// Potenciadores de sabor y condimentos muy concentrados con umbrales específicos
// Se usan en cantidades de gramos, no de 100g → cualquier valor >threshold es sospechoso
const CONDIMENTOS_FUERTES = [
  { kw: ['glutamato', 'msg', 'potenciador'], max: 8 },
  { kw: ['tabasco', 'sriracha', 'hot sauce'], max: 20 },
  { kw: ['levadura nutricional'], max: 30 },
  { kw: ['polvo hornear', 'levadura quimica', 'bicarbonato'], max: 15 },
  { kw: ['extracto vainilla', 'esencia'], max: 10 },
  { kw: ['colorante', 'tinte alimentario'], max: 5 },
]

function checkCantidadSospechosa(nombre, gramos) {
  if (gramos === null || gramos === undefined) return `sin cantidad (null)`
  if (gramos <= 0) return `cantidad 0 o negativa (${gramos}g)`
  if (gramos > 2000) return `cantidad absurda (${gramos}g)`
  if (esEspecia(nombre)) {
    const n = norm(nombre)
    // Hierbas frescas (perejil fresco, cilantro fresco, albahaca fresca, etc.)
    // tienen umbral más alto — pueden ser el ingrediente principal (chimichurri, pesto)
    const esFresca = n.includes('fresc') || n.includes('natural') || n.includes('hoja') || n.includes('cebollino')
    const maxEspecia = esFresca ? 300 : 30
    if (gramos > maxEspecia) return `especia${esFresca ? ' fresca' : ''} con ${gramos}g (esperado <${maxEspecia}g)`
  }
  // Cantidades mínimas sospechosas — solo para alimentos sólidos/líquidos principales
  // Se excluyen: polvos, flakes, rallados, extractos, sprays, especias (ya tienen umbral propio)
  // También levaduras y gasificantes: bicarbonato 3-8g, levadura química 4-10g son cantidades normales
  const n2 = norm(nombre)
  const esFormatoMinimo = ['polvo', 'flakes', 'hojuelas', 'ralladu', 'rallad', 'extract',
    'esencia', 'aroma', 'spray', 'gotas', 'sobre', 'sachet',
    'bicarbonato', 'levadura quimica', 'levadura química', 'polvo hornear', 'polvo de hornear',
    'edulcorante', 'stevia', 'eritritol', 'sucralosa',
    'condimento', 'bagel',
    'sazonador',   // mezcla de especias en sobre/bote → siempre pequeña cantidad
    'concentrado', // concentrado de tomate/caldo → 1-15g es normal
    'mezcla de especias',
  ].some(k => n2.includes(k))
  if (!esEspecia(nombre) && !esFormatoMinimo && gramos < 5 && gramos > 0) {
    return `cantidad muy pequeña (${gramos}g — ¿error de extracción?)`
  }

  // Potenciadores de sabor con umbral específico muy bajo
  const n = norm(nombre)
  for (const { kw, max } of CONDIMENTOS_FUERTES) {
    if (kw.some(k => n.includes(k)) && gramos > max) {
      return `potenciador/condimento con ${gramos}g (esperado <${max}g)`
    }
  }
  return null
}

// Detectar ingredientes linkeados a alimentos con 0 kcal cuando la cantidad es significativa
function checkAlimentoCeroKcal(nombreLibre, kcalAlimento, gramos) {
  if (kcalAlimento > 0) return null
  if (gramos <= 15) return null  // pequeña cantidad → condimento, ok
  const n = norm(nombreLibre)
  // Alimentos legítimamente sin calorías (o negligibles)
  const CERO_KCAL_VALIDOS = [
    'agua', 'sal', 'vinagre', 'gelatina', 'caldo', 'endulzante', 'stevia',
    'eritritol', 'sucralosa', 'splenda', 'levadura quimica', 'polvo hornear',
    'glutamato', 'especia', 'condimento',
  ]
  if (CERO_KCAL_VALIDOS.some(v => n.includes(v))) return null
  return `alimento matcheado tiene 0 kcal (${gramos}g usados — posible match incorrecto)`
}

function checkMacrosSospechosas(kcal, tipo_plato) {
  const RANGOS = {
    'Desayuno': { min: 80, max: 900 },
    'Almuerzo': { min: 50, max: 600 },
    'Comida': { min: 100, max: 1200 },
    'Cena': { min: 80, max: 1000 },
    'Snack': { min: 30, max: 500 },
    'Merienda': { min: 50, max: 600 },
    'Postre': { min: 30, max: 800 },
    'Bebida': { min: 0, max: 300 },
    'Condimento': { min: 0, max: 200 },
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

    // 2. Instrucciones vacías o mal formateadas
    const instr = receta.instrucciones?.trim() || ''
    if (!instr || instr.length < 20) {
      recetaIssues.push({ tipo: 'instrucciones', msg: 'Instrucciones vacías o muy cortas' })
    } else if (instr.length > 100 && !instr.includes('\n') && / \d+\. /.test(instr)) {
      recetaIssues.push({ tipo: 'instrucciones', msg: 'Pasos concatenados sin saltos de línea (usar regexp_replace en SQL)' })
    } else if (instr.length > 300 && (instr.match(/\n/g) || []).length < 2) {
      recetaIssues.push({ tipo: 'instrucciones', msg: 'Instrucciones largas con muy pocos saltos (¿un solo bloque?)' })
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
    const nombresLibresVistos = new Set()
    for (const ing of (receta.receta_ingredientes || [])) {
      const nombreLibre = ing.nombre_libre || ''
      const nombreAlimento = ing.alimentos?.nombre || ''
      const kcalAlimento = ing.alimentos?.calorias ?? -1
      const gramos = ing.cantidad_gramos

      // Match sospechoso (word overlap)
      if (nombreAlimento) {
        const matchIssue = checkMatchSospechoso(nombreLibre, nombreAlimento)
        if (matchIssue) {
          recetaIssues.push({ tipo: 'match', msg: matchIssue })
        }
      }

      // Sin alimento linkeado
      if (!ing.alimentos) {
        recetaIssues.push({ tipo: 'match', msg: `"${nombreLibre}": sin alimento_id (no matcheado)` })
      }

      // Alimento matcheado con 0 kcal y cantidad significativa
      if (kcalAlimento === 0) {
        const ceroIssue = checkAlimentoCeroKcal(nombreLibre, kcalAlimento, gramos)
        if (ceroIssue) {
          recetaIssues.push({ tipo: 'match', msg: `"${nombreLibre}" → "${nombreAlimento}": ${ceroIssue}` })
        }
      }

      // Cantidad sospechosa
      const cantidadIssue = checkCantidadSospechosa(nombreLibre, gramos)
      if (cantidadIssue) {
        recetaIssues.push({ tipo: 'cantidad', msg: `"${nombreLibre}": ${cantidadIssue}` })
      }

      // Ingrediente duplicado en la misma receta
      const nLibreNorm = norm(nombreLibre)
      if (nLibreNorm && nombresLibresVistos.has(nLibreNorm)) {
        recetaIssues.push({ tipo: 'cantidad', msg: `"${nombreLibre}": ingrediente duplicado` })
      }
      nombresLibresVistos.add(nLibreNorm)
    }

    // 7. Porciones 0 o nulas
    if (!receta.porciones || receta.porciones <= 0) {
      recetaIssues.push({ tipo: 'macros', msg: `Porciones = ${receta.porciones} (inválido)` })
    }

    // 8. Macros sin calcular (todo 0)
    if (receta.kcal === 0 || receta.kcal === null) {
      recetaIssues.push({ tipo: 'macros', msg: 'kcal = 0 (macros sin calcular)' })
    }

    // 9. Todos los ingredientes a exactamente 100g (extracción defectuosa)
    const ings = receta.receta_ingredientes || []
    if (ings.length >= 3 && ings.every(i => i.cantidad_gramos === 100)) {
      recetaIssues.push({ tipo: 'cantidad', msg: 'Todos los ingredientes a 100g exactos (cantidades no extraídas)' })
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
  // Tipos críticos que requieren acción inmediata (bloquean la receta)
  const TIPOS_CRITICOS = ['match', 'macros', 'cantidad', 'instrucciones']
  const ICONOS = {
    match: '🔗', macros: '🔢', foto: '🖼️', instrucciones: '📝',
    cantidad: '⚖️', intolerancias: '🏷️', ingredientes: '🧩',
  }

  // Separar críticos de advertencias
  const conCriticos = issues.filter(r => r.issues.some(i => TIPOS_CRITICOS.includes(i.tipo)))
  const soloAvisos = issues.filter(r => r.issues.every(i => !TIPOS_CRITICOS.includes(i.tipo)))

  if (conCriticos.length > 0) {
    console.log(`\n🚨 CRÍTICOS — Requieren acción antes de publicar (${conCriticos.length} recetas):`)
    console.log('─'.repeat(60))
    for (const r of conCriticos) {
      const criticos = r.issues.filter(i => TIPOS_CRITICOS.includes(i.tipo))
      console.log(`\n  ⚠️  ${r.nombre} (${r.tipo_plato || '—'}, ${r.kcal ?? 0} kcal)`)
      criticos.forEach(i => console.log(`     ${ICONOS[i.tipo] || '❓'} [${i.tipo}] ${i.msg}`))
    }
  }

  if (soloAvisos.length > 0) {
    console.log(`\n💡 AVISOS — No bloquean pero conviene revisar (${soloAvisos.length} recetas):`)
    console.log('─'.repeat(60))
    for (const r of soloAvisos) {
      console.log(`\n  ℹ️  ${r.nombre}`)
      r.issues.forEach(i => console.log(`     ${ICONOS[i.tipo] || '❓'} [${i.tipo}] ${i.msg}`))
    }
  }

  // Sugerir añadir al MATCH_FIXES del pipeline los matches problemáticos recurrentes
  const matchIssues = issues.flatMap(r =>
    r.issues.filter(i => i.tipo === 'match' && i.msg.includes('→')).map(i => ({ receta: r.nombre, msg: i.msg }))
  )
  if (matchIssues.length > 0) {
    const sugerencias = new Set()
    matchIssues.forEach(({ msg }) => {
      const m = msg.match(/"([^"]+)" →/)
      if (m) {
        const palabras = norm(m[1]).split(/\s+/).filter(w => !GENERICAS.has(w) && w.length > 3)
        if (palabras.length > 0) sugerencias.add(palabras[0])
      }
    })
    if (sugerencias.size > 0) {
      console.log(`\n🔧 Candidatos para MATCH_FIXES en pipeline-calidad.mjs:`)
      sugerencias.forEach(s => console.log(`   [/^${s}/i, '<alimento_id>', '<nombre>'],`))
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`\n💡 Para ver TODO: node scripts/quality-gate-recetas.mjs --todas`)
  console.log(`   Para exportar JSON: node scripts/quality-gate-recetas.mjs --json`)
}

main().catch(e => { console.error(e); process.exit(1) })
