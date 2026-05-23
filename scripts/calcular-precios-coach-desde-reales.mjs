#!/usr/bin/env node
/**
 * CALCULAR PRECIOS REFERENCIA COACH DESDE PRODUCTOS REALES v2
 *
 * Estrategia mejorada:
 * Procesa TODOS los alimentos que tienen precio referencia coach y recalcula
 * usando datos reales de supermercado. No solo los que no tienen productos reales.
 *
 *   A) Alimentos con productos reales DIRECTOS (alimento_id vinculado):
 *      → Usa esos precios como señal primaria (confianza 1.0)
 *      → Busca matches semánticos adicionales (confianza 0.6)
 *      → Ponderación por recencia
 *
 *   B) Alimentos sin productos reales directos (solo ref coach):
 *      → Usa matching semántico (confianza 0.6)
 *      → Misma lógica que v1 pero con ponderación por recencia
 *
 * Uso:
 *   node scripts/calcular-precios-coach-desde-reales.mjs           # dry-run
 *   node scripts/calcular-precios-coach-desde-reales.mjs --apply   # ejecutar
 *   node scripts/calcular-precios-coach-desde-reales.mjs --force   # aplicar aunque diff < 5%
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Config ──────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const envPath = resolve(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const REF_ID = '11111111-1111-4111-8111-111111111111'
const DRY_RUN = !process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')

/** Mínimo ratio de palabras coincidentes (matching semántico) */
const MIN_RATIO = 0.35
const MIN_MATCH_WORDS = 2

/** Umbral mínimo para actualizar (5% por defecto, 0% si --force) */
const MIN_DIFF_PCT = FORCE ? 0 : 0.05

/** Ponderación por recencia — días desde fecha_precio */
const RECENCY_WEIGHTS = [
  { maxDays: 30, weight: 1.0 },
  { maxDays: 60, weight: 0.9 },
  { maxDays: 90, weight: 0.8 },
  { maxDays: 180, weight: 0.6 },
  { maxDays: 365, weight: 0.4 },
  { maxDays: Infinity, weight: 0.25 },
]

/** Confianza por fuente */
const CONF_DIRECT = 1.0   // producto directo (mismo alimento_id)
const CONF_SEMANTIC = 0.6 // match semántico (alimento similar, distinto id)

/** Palabras que no deben contar como "sustantivo principal" */
const SKIP_MAIN_WORDS = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '0,4', '0,0', '0%', '100%', 'natural', 'eco', 'bio', 'light',
  'entero', 'tradicional', 'premium', 'extra', 'suave', 'intenso',
  'fresco', 'fresca', 'cruda', 'crudo', 'cocido', 'cocida',
  'molida', 'molido', 'rallado', 'triturado', 'tostada', 'tostadas',
  'seco', 'seca', 'secos', 'secas', 'congelado', 'congelada',
  'sin', 'con', '0,0%', '0,4º',
])

/**
 * Palabras "bandera roja" para matching semántico:
 * Si el producto las contiene Y el alimento NO, es probable falso positivo.
 * Agrupadas por tipo de falsos positivos comunes.
 */
const RED_FLAG_WORDS = new Set([
  // Dulces/bollería que no deberían matchear con ingredientes base
  'chocolate', 'choco', 'bizcocho', 'rosegones', 'galleta', 'pastel',
  'tarta', 'magdalena', 'croissant', 'donut', 'bollo', 'panqueque',
  'barrita', 'snack',
  // Comida para mascotas (no humana)
  'perro', 'gato', 'mascota', 'canino',
  // Pescado vs escamas de sal, etc.
  'salmon',
  // Fórmula infantil vs leche normal
  'lactante', 'continuacion', 'infantil', 'bebe',
  // Envases/containers — indican producto procesado, no ingrediente base
  'lata', 'frasco', 'pack',
  'caja', 'botella', 'bote', 'tarrina', 'bandeja',
])

/**
 * Si directos y semánticos coexisten y su mediana difiere > este ratio,
 * los directos probablemente tienen alimento_id mal asignado → usar solo semánticos.
 */
const SANITY_DIRECT_SEMANTIC_RATIO = 5

// ── Helpers ──────────────────────────────────────────────────────────

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getPalabrasClave(s) {
  const sinParentesis = String(s || '').replace(/\([^)]*\)/g, '')
  const n = norm(sinParentesis)
  const palabras = n.split(/\s+/).filter(p => p.length > 2 && !SKIP_MAIN_WORDS.has(p))

  const STOP = new Set([
    'de', 'del', 'la', 'las', 'los', 'el', 'en', 'con', 'sin', 'y',
    'e', 'o', 'a', 'para', 'por', 'al', 'un', 'una', 'su', 'que',
    '0', '0,4', 'lo',
  ])
  return palabras.filter(p => !STOP.has(p))
}

function getMainNoun(s) {
  const palabras = getPalabrasClave(s)
  return palabras.length > 0 ? palabras[0] : null
}

function getRecencyWeight(fechaPrecio) {
  if (!fechaPrecio) return 0.3
  const days = (Date.now() - new Date(fechaPrecio).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 0) return 1.0 // fechas futuras = recién actualizado
  for (const rw of RECENCY_WEIGHTS) {
    if (days <= rw.maxDays) return rw.weight
  }
  return 0.25
}

/**
 * Calcula mediana ponderada de un array de valores con pesos.
 * Cada entrada: { precio: number, peso: number }
 */
function weightedMedian(arr) {
  if (!arr || arr.length === 0) return 0
  // Ordenar por precio
  const sorted = [...arr].sort((a, b) => a.precio - b.precio)
  const totalWeight = sorted.reduce((s, e) => s + e.peso, 0)
  let cumWeight = 0
  for (const entry of sorted) {
    cumWeight += entry.peso
    if (cumWeight >= totalWeight / 2) return entry.precio
  }
  return sorted[sorted.length - 1].precio
}

function median(arr) {
  if (!arr || arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(100))
  console.log('  CALCULAR PRECIOS REFERENCIA COACH DESDE PRODUCTOS REALES v2')
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo análisis)' : '💥 APLICANDO cambios'}`)
  if (FORCE) console.log('  ⚡ --force: actualizando aunque diff < 5%')
  console.log('═'.repeat(100))

  // ── 1. Cargar supermercados ──────────────────────────────────────
  const { data: supers } = await sb.from('supermercados').select('id, slug, nombre')
  const slugMap = new Map(supers.map(s => [s.id, s.slug]))

  // ── 2. Alimentos usados en recetas ───────────────────────────────
  const { data: ri } = await sb.from('receta_ingredientes').select('alimento_id').not('alimento_id', 'is', null)
  const usedIds = [...new Set(ri.map(r => r.alimento_id))]
  const usoCount = {}
  for (const r of ri) usoCount[r.alimento_id] = (usoCount[r.alimento_id] || 0) + 1

  const alimentos = []
  for (let i = 0; i < usedIds.length; i += 100) {
    const { data } = await sb.from('alimentos').select('id, nombre, categoria').in('id', usedIds.slice(i, i + 100))
    if (data) alimentos.push(...data)
  }
  console.log(`\n📦 Alimentos referenciados en recetas: ${alimentos.length}`)

  // ── 3. TODOS los productos con precio (paginación) ───────────────
  const allProds = []
  const PAGE_SIZE = 1000
  let desde = 0
  let hayMas = true
  while (hayMas) {
    const { data, error } = await sb.from('productos_supermercado')
      .select('id, alimento_id, supermercado_id, precio_por_kg, precio_unidad, nombre_original, marca, fecha_precio')
      .gt('precio_por_kg', 0)
      .range(desde, desde + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) {
      hayMas = false
      break
    }
    allProds.push(...data)
    if (data.length < PAGE_SIZE) hayMas = false
    else desde += PAGE_SIZE
  }

  const realProds = allProds.filter(p => p.supermercado_id !== REF_ID)
  const refProds = allProds.filter(p => p.supermercado_id === REF_ID)

  console.log(`📦 Productos totales: ${allProds.length}`)
  console.log(`   ├─ Reales: ${realProds.length}`)
  console.log(`   └─ Ref coach: ${refProds.length}`)

  // ── 4. Índice de productos reales por alimento_id ────────────────
  // Para acceso rápido a precios directos
  const directPricesByFood = new Map() // alimento_id → [{precio, peso, super, fecha, nombre_original}]
  const directCountByFood = new Map()  // alimento_id → count
  const directSupByFood = new Map()    // alimento_id → Set<supermercado_id>
  for (const p of realProds) {
    if (!p.alimento_id) continue
    if (!directPricesByFood.has(p.alimento_id)) {
      directPricesByFood.set(p.alimento_id, [])
      directCountByFood.set(p.alimento_id, 0)
      directSupByFood.set(p.alimento_id, new Set())
    }
    directPricesByFood.get(p.alimento_id).push({
      precio: p.precio_por_kg,
      peso: CONF_DIRECT * getRecencyWeight(p.fecha_precio),
      super: p.supermercado_id,
      fecha: p.fecha_precio,
      id: p.id,
      nombre_original: p.nombre_original || '',
    })
    directCountByFood.set(p.alimento_id, directCountByFood.get(p.alimento_id) + 1)
    directSupByFood.get(p.alimento_id).add(p.supermercado_id)
  }

  // ── 5. Construir índice semántico (palabras clave → productos reales) ──
  const prodIndex = new Map()
  for (const p of realProds) {
    if (!p.nombre_original) continue
    for (const w of getPalabrasClave(p.nombre_original)) {
      if (!prodIndex.has(w)) prodIndex.set(w, [])
      prodIndex.get(w).push(p)
    }
  }
  console.log(`📚 Índice semántico: ${prodIndex.size} términos únicos`)

  // ── 6. Procesar CADA alimento con ref coach ─────────────────────
  const refByFood = new Map()
  for (const p of refProds) {
    refByFood.set(p.alimento_id, p)
  }

  // Construir lista de trabajo: solo alimentos que tienen ref coach
  const aProcesar = alimentos
    .filter(a => refByFood.has(a.id))
    .map(a => ({ ...a, usos: usoCount[a.id] || 0 }))
    .sort((a, b) => b.usos - a.usos)

  console.log(`\n🎯 Alimentos CON ref coach: ${aProcesar.length}`)
  console.log(`   ├─ Con productos reales directos: ${aProcesar.filter(a => directCountByFood.has(a.id) && directCountByFood.get(a.id) > 0).length}`)
  console.log(`   └─ Solo ref coach (sin directos): ${aProcesar.filter(a => !directCountByFood.has(a.id) || directCountByFood.get(a.id) === 0).length}`)

  // ── 7. Matching semántico para cada alimento ─────────────────────
  const resultados = []
  let filteredMainNoun = 0
  let filteredRedFlag = 0
  let withoutSemanticMatch = 0

  for (const a of aProcesar) {
    const alimentos = [] // { precio, peso, fuente, supers, fecha }
    const foodNorm = norm(a.nombre)

    // ── 7A. Señal DIRECTA (productos reales con mismo alimento_id) ──
    // FILTRO ADICIONAL: Si el producto directo contiene palabras container/lata
    // (bandera roja) que el alimento NO contiene, el alimento_id está mal asignado.
    // Ej: "Atún en aceite de oliva [lata]" → alimento_id = Aceite de oliva ❌
    const directPrices = (directPricesByFood.get(a.id) || []).filter(dp => {
      const pn = norm(dp.nombre_original || '')
      const productRedFlags = [...RED_FLAG_WORDS].filter(rf => pn.includes(rf))
      const foodRedFlags = [...RED_FLAG_WORDS].filter(rf => foodNorm.includes(rf))
      const extraFlags = productRedFlags.filter(rf => !foodRedFlags.includes(rf))
      return extraFlags.length === 0
    })
    for (const dp of directPrices) {
      alimentos.push({
        precio: dp.precio,
        peso: dp.peso,
        fuente: 'directo',
        super: dp.super,
        fecha: dp.fecha,
      })
    }

    // ── 7B. Señal SEMÁNTICA (productos similares por nombre) ──
    const palabras = getPalabrasClave(a.nombre)
    const mainNoun = getMainNoun(a.nombre)

    if (palabras.length > 0 && mainNoun) {
      const productMatches = new Map() // producto.id -> { producto, matchWords, ratio }
      const foodNorm = norm(a.nombre)

      for (const palabra of palabras) {
        const prods = prodIndex.get(palabra) || []
        for (const p of prods) {
          // Saltar si ya tenemos este producto como directo (ya contado arriba)
          const pn = norm(p.nombre_original || '')
          const matchWords = palabras.filter(w => pn.includes(w)).length
          const ratio = palabras.length > 0 ? matchWords / palabras.length : 0

          if (ratio >= MIN_RATIO && matchWords >= MIN_MATCH_WORDS) {
            // Filtro 1: debe contener sustantivo principal
            if (!pn.includes(mainNoun)) {
              filteredMainNoun++
              continue
            }

            // Filtro 2: banderas rojas
            const productRedFlags = [...RED_FLAG_WORDS].filter(rf => pn.includes(rf))
            const foodRedFlags = [...RED_FLAG_WORDS].filter(rf => foodNorm.includes(rf))
            const extraFlags = productRedFlags.filter(rf => !foodRedFlags.includes(rf))
            if (extraFlags.length > 0) {
              filteredRedFlag++
              continue
            }

            // Evitar duplicar el mismo producto (si ya está como directo por otro alimento)
            if (!productMatches.has(p.id) || productMatches.get(p.id).ratio < ratio) {
              productMatches.set(p.id, { producto: p, matchWords, ratio })
            }
          }
        }
      }

      for (const match of productMatches.values()) {
        const p = match.producto
        const peso = CONF_SEMANTIC * getRecencyWeight(p.fecha_precio) * match.ratio
        alimentos.push({
          precio: p.precio_por_kg,
          peso,
          fuente: 'semantico',
          super: p.supermercado_id,
          fecha: p.fecha_precio,
          ratio: match.ratio,
        })
      }
    }

    if (alimentos.length === 0) {
      withoutSemanticMatch++
      continue
    }

    // ── 7C. Sanity check: detectar directos con alimento_id mal asignado ──
    // Si directos y semánticos coexisten y sus medianas difieren > SANITY_DIRECT_SEMANTIC_RATIO,
    // los directos probablemente tienen alimento_id incorrecto (ej: "Atún en aceite" → "Aceite").
    // En ese caso: descartar directos y usar solo semánticos.
    const directos = alimentos.filter(e => e.fuente === 'directo')
    const semanticos = alimentos.filter(e => e.fuente === 'semantico')

    if (directos.length > 0 && semanticos.length >= 3) {
      const medDirecta = median(directos.map(e => e.precio))
      const medSemantica = median(semanticos.map(e => e.precio))
      if (medSemantica > 0 && medDirecta / medSemantica > SANITY_DIRECT_SEMANTIC_RATIO) {
        // Directos corruptos — descartarlos
        alimentos.length = 0
        for (const s of semanticos) alimentos.push(s)
        if (alimentos.length === 0) {
          withoutSemanticMatch++
          continue
        }
      }
    }

    // ── 7D. Calcular estadísticas ──────────────────────────────

    // Precio ponderado (mediana ponderada con pesos combinados)
    const precioPonderado = weightedMedian(alimentos)

    // Mediana simple (sin ponderar) para comparación
    const preciosSimples = alimentos.map(e => e.precio).filter(p => p > 0)
    const medSimple = median(preciosSimples)

    // Separar por fuente para el reporte (recalcular tras sanity check)
    const directosFinal = alimentos.filter(e => e.fuente === 'directo')
    const semanticosFinal = alimentos.filter(e => e.fuente === 'semantico')

    // Agrupar por supermercado
    const porSuper = new Map()
    for (const a of alimentos) {
      const sid = a.super
      if (!porSuper.has(sid)) porSuper.set(sid, new Set())
      porSuper.get(sid).add(a.precio)
    }

    // Rango intercuartílico
    const sortedPrecios = [...preciosSimples].sort((a, b) => a - b)
    const q1 = sortedPrecios[Math.floor(sortedPrecios.length * 0.25)]
    const q3 = sortedPrecios[Math.floor(sortedPrecios.length * 0.75)]
    const iqr = q3 - q1
    const lowerFence = q1 - 1.5 * iqr
    const upperFence = q3 + 1.5 * iqr
    const sinOutliers = preciosSimples.filter(p => p >= lowerFence && p <= upperFence)
    const medSinOutliers = sinOutliers.length >= 3 ? median(sinOutliers) : medSimple

    // Precio actual de referencia coach
    const refActual = refByFood.get(a.id)

    const numSupDirectos = directosFinal.length > 0
      ? new Set(directosFinal.map(e => e.super)).size
      : 0

    resultados.push({
      alimento: a,
      numAlimentos: alimentos.length,
      numDirectos: directosFinal.length,
      numSemanticos: semanticosFinal.length,
      numSupDirectos,
      numSupTotal: porSuper.size,
      porSuper,
      precios: preciosSimples,
      mediana: round2(medSimple),
      medianaPonderada: round2(precioPonderado),
      medianaSinOutliers: round2(medSinOutliers),
      min: round2(Math.min(...preciosSimples)),
      max: round2(Math.max(...preciosSimples)),
      numSinOutliers: sinOutliers.length,
      refActual: refActual?.precio_por_kg || null,
      refActualId: refActual?.id || null,
    })
  }

  // ── 8. Mostrar resultados ─────────────────────────────────────
  resultados.sort((a, b) => b.alimento.usos - a.alimento.usos)

  // Elegir qué mediana usar como valor propuesto
  // Si hay directos suficientes (>= 3), usar la mediana sin outliers
  // Si hay directos pero pocos, usar la ponderada (que da más peso a directos)
  // Si solo hay semánticos, usar la ponderada
  //
  // Regla adicional: si TODOS los directos vienen de 1 solo supermercado
  // y no hay semánticos para cross-check, los precios pueden estar
  // inflados por marca → usar percentil 25 (precio más económico) como
  // estimación conservadora.
  for (const r of resultados) {
    const sorted = [...r.precios].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]

    if (r.numDirectos >= 3 && r.numSinOutliers >= 3) {
      // Si 1 solo super y 0 semánticos → usar Q1 (más conservador)
      if (r.numSupTotal <= 1 && r.numSemanticos === 0) {
        r.valorPropuesto = round2(q1)
        r.metodo = 'directo_q1'
      } else {
        r.valorPropuesto = r.medianaSinOutliers
        r.metodo = 'directo_sin_outliers'
      }
    } else if (r.numDirectos > 0) {
      r.valorPropuesto = r.medianaPonderada
      r.metodo = 'ponderado_directo'
    } else {
      r.valorPropuesto = r.medianaPonderada
      r.metodo = 'ponderado_semantico'
    }
  }

  console.log(`\n🚫 Filtrados (sin sustantivo principal): ${filteredMainNoun}`)
  console.log(`🚫 Filtrados (banderas rojas): ${filteredRedFlag}`)
  console.log(`⚠️  Sin match semántico (solo ref coach, sin directos): ${withoutSemanticMatch}`)
  console.log(`\n📋 ALIMENTOS PROCESADOS: ${resultados.length}`)

  // Separar por categoría para mejor reporte
  const conDirectos = resultados.filter(r => r.numDirectos > 0)
  const soloSemanticos = resultados.filter(r => r.numDirectos === 0)

  console.log(`   ├─ Con precio directo: ${conDirectos.length}`)
  console.log(`   └─ Solo matching semántico: ${soloSemanticos.length}`)

  let cambiosSignificativos = 0
  let cambiosMenores = 0
  let sinRefActual = 0
  let sinCambio = 0

  // Mostrar tabla de resumen
  console.log('\n' + '─'.repeat(100))
  console.log('  ALIMENTOS CON PRECIO DIRECTO (señal primaria)')
  console.log('─'.repeat(100))

  for (const r of conDirectos) {
    const a = r.alimento
    const refAnterior = r.refActual !== null ? `${r.refActual.toFixed(2)}€/kg` : 'SIN REF'
    const diff = r.refActual !== null
      ? ((r.valorPropuesto - r.refActual) / r.refActual * 100).toFixed(1)
      : 'N/A'
    const diffAbs = r.refActual !== null
      ? Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1)
      : 1

    const flag = r.refActual === null ? '🆕'
      : diffAbs > 0.2 ? '🔴'
        : diffAbs > 0.1 ? '🟡'
          : diffAbs > MIN_DIFF_PCT ? '🟠'
            : '🟢'

    if (r.refActual === null) sinRefActual++
    else if (diffAbs > MIN_DIFF_PCT) cambiosSignificativos++
    else sinCambio++

    const superNombres = [...r.porSuper.keys()]
      .slice(0, 5)
      .map(sid => slugMap.get(sid) || sid)
      .join(', ')

    if (diffAbs > MIN_DIFF_PCT || r.refActual === null) {
      console.log(`\n  ${flag} ${a.nombre}`)
      console.log(`     Usos: ${a.usos} | Directos: ${r.numDirectos}p en ${r.numSupDirectos} supers | Semánticos: ${r.numSemanticos}p | Total: ${r.numSupTotal} supers`)
      console.log(`     Método: ${r.metodo} | Ponderado: ${r.medianaPonderada.toFixed(2)}€/kg | Sin outliers: ${r.medianaSinOutliers.toFixed(2)}€/kg | Rango: ${r.min.toFixed(2)}-${r.max.toFixed(2)}€/kg`)
      console.log(`     Ref coach: ${refAnterior} → ${r.valorPropuesto.toFixed(2)}€/kg (${diff}%)`)
    }
  }

  console.log('\n' + '─'.repeat(100))
  console.log('  ALIMENTOS SOLO MATCHING SEMÁNTICO')
  console.log('─'.repeat(100))

  for (const r of soloSemanticos) {
    const a = r.alimento
    const refAnterior = r.refActual !== null ? `${r.refActual.toFixed(2)}€/kg` : 'SIN REF'
    const diff = r.refActual !== null
      ? ((r.valorPropuesto - r.refActual) / r.refActual * 100).toFixed(1)
      : 'N/A'
    const diffAbs = r.refActual !== null
      ? Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1)
      : 1

    const flag = r.refActual === null ? '🆕'
      : diffAbs > 0.2 ? '🔴'
        : diffAbs > 0.1 ? '🟡'
          : diffAbs > MIN_DIFF_PCT ? '🟠'
            : '🟢'

    if (r.refActual === null) sinRefActual++
    else if (diffAbs > MIN_DIFF_PCT) cambiosSignificativos++
    else sinCambio++

    const superNombres = [...r.porSuper.keys()]
      .map(sid => slugMap.get(sid) || sid)
      .join(', ')

    if (diffAbs > MIN_DIFF_PCT || r.refActual === null) {
      console.log(`\n  ${flag} ${a.nombre}`)
      console.log(`     Usos: ${a.usos} | Matches: ${r.numSemanticos} productos en ${r.numSupTotal} supers (${superNombres})`)
      console.log(`     Ponderado: ${r.medianaPonderada.toFixed(2)}€/kg | Rango: ${r.min.toFixed(2)}-${r.max.toFixed(2)}€/kg`)
      console.log(`     Ref coach: ${refAnterior} → ${r.valorPropuesto.toFixed(2)}€/kg (${diff}%)`)
    }
  }

  // Resumen global
  console.log('\n' + '═'.repeat(100))
  console.log('  RESUMEN GLOBAL')
  console.log('═'.repeat(100))
  console.log(`  Total alimentos procesados:  ${resultados.length}`)
  console.log(`  ├─ Con precio directo:       ${conDirectos.length}`)
  console.log(`  └─ Solo matching semántico:   ${soloSemanticos.length}`)

  const aActualizar = resultados.filter(r => {
    if (r.refActual === null) return true
    const diffAbs = Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1)
    return diffAbs > MIN_DIFF_PCT
  })

  console.log(`\n  📊 CAMBIOS:`)
  console.log(`  🔴 Cambio >20%:                ${resultados.filter(r => r.refActual !== null && Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1) > 0.2).length}`)
  console.log(`  🟡 Cambio 10-20%:              ${resultados.filter(r => r.refActual !== null && Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1) > 0.1 && Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1) <= 0.2).length}`)
  console.log(`  🟠 Cambio ${(MIN_DIFF_PCT * 100).toFixed(0)}-10%:           ${resultados.filter(r => r.refActual !== null && Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1) > MIN_DIFF_PCT && Math.abs(r.valorPropuesto - r.refActual) / (r.refActual || 1) <= 0.1).length}`)
  console.log(`  🟢 Sin cambio relevante:       ${sinCambio}`)
  console.log(`  🆕 Sin ref coach actual:       ${sinRefActual}`)
  console.log(`  🚫 Sin match semántico:        ${withoutSemanticMatch}`)
  console.log(`  🚫 Filtrados total (matching): ${filteredMainNoun + filteredRedFlag} (${filteredMainNoun} sin sustantivo, ${filteredRedFlag} banderas rojas)`)

  // ── 9. APLICAR (--apply) ──────────────────────────────────
  if (!DRY_RUN) {
    console.log('\n' + '═'.repeat(100))
    console.log('  💥 APLICANDO ACTUALIZACIONES')
    console.log('═'.repeat(100))

    let ok = 0, err = 0, skip = 0, inserted = 0

    for (const r of aActualizar) {
      const a = r.alimento
      const nuevoPrecio = r.valorPropuesto

      if (!r.refActualId) {
        // No tiene entrada referencia — crear una nueva
        const notas = r.numDirectos > 0
          ? `Precio desde ${r.numDirectos} productos directos + ${r.numSemanticos} semánticos. Método: ${r.metodo}. Fecha: ${new Date().toISOString().slice(0, 10)}.`
          : `Precio estimado desde ${r.numSemanticos} productos semánticos. Método: ${r.metodo}. Fecha: ${new Date().toISOString().slice(0, 10)}.`

        const { error } = await sb.from('productos_supermercado').insert({
          supermercado_id: REF_ID,
          alimento_id: a.id,
          precio_por_kg: nuevoPrecio,
          precio_unidad: null,
          unidad: 'kg',
          url_producto: `referencia://coach/${a.id}`,
          nombre_original: a.nombre,
          marca: 'Referencia coach (calculado)',
          preferido: false,
          notas,
          fecha_precio: new Date().toISOString().slice(0, 10),
        }).maybeSingle()

        if (error) {
          if (error.code === '23505') { skip++; continue }
          console.log(`  ❌ Error insertando ${a.nombre}: ${error.message}`)
          err++
        } else {
          inserted++
          console.log(`  🆕 ${a.nombre.padEnd(40)} ${nuevoPrecio.toFixed(2)}€/kg (creado)`)
        }
      } else {
        // Actualizar ref coach existente
        const notas = r.numDirectos > 0
          ? `Precio actualizado desde ${r.numDirectos} productos directos + ${r.numSemanticos} semánticos. Método: ${r.metodo}. Anterior: ${r.refActual?.toFixed(2) || 'sin ref'}€/kg. Fecha: ${new Date().toISOString().slice(0, 10)}.`
          : `Precio actualizado desde ${r.numSemanticos} productos semánticos. Método: ${r.metodo}. Anterior: ${r.refActual?.toFixed(2) || 'sin ref'}€/kg. Fecha: ${new Date().toISOString().slice(0, 10)}.`

        const { error } = await sb.from('productos_supermercado')
          .update({
            precio_por_kg: nuevoPrecio,
            notas,
            fecha_precio: new Date().toISOString().slice(0, 10),
          })
          .eq('id', r.refActualId)
          .maybeSingle()

        if (error) {
          console.log(`  ❌ Error actualizando ${a.nombre}: ${error.message}`)
          err++
        } else {
          ok++
          const pct = r.refActual > 0
            ? ((nuevoPrecio - r.refActual) / r.refActual * 100).toFixed(1)
            : 'N/A'
          console.log(`  ${r.metodo === 'directo_sin_outliers' ? '✅' : '🔄'} ${a.nombre.padEnd(40)} ${r.refActual.toFixed(2)} → ${nuevoPrecio.toFixed(2)}€/kg (${pct}%)`)
        }
      }
    }

    console.log(`\n  ✅ ${ok} actualizados`)
    console.log(`  🆕 ${inserted} creados nuevos`)
    console.log(`  ⏭️  ${skip} sin cambios significativos (omitidos)`)
    console.log(`  ❌ ${err} errores`)
  }

  if (DRY_RUN) {
    console.log(`\n  ${aActualizar.length} alimentos cambiarían con --apply`)
    console.log(`  Para aplicar: node scripts/calcular-precios-coach-desde-reales.mjs --apply`)
    if (!FORCE) {
      console.log(`  Para forzar incluso cambios <5%: node scripts/calcular-precios-coach-desde-reales.mjs --apply --force`)
    }
  }

  process.exit(0)
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
