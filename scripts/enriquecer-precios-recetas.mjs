#!/usr/bin/env node
/**
 * ENRIQUECER PRECIOS REALES EN ALIMENTOS DE RECETAS
 *
 * Estrategia:
 * Para cada alimento de receta que solo tiene precio referencia coach,
 * buscar productos existentes en productos_supermercado cuyo nombre_original
 * coincida semánticamente, y crear NUEVOS enlaces directos.
 *
 * Así un mismo producto (ej: "Aceite Oliva Virgen Extra Hacendado 1L")
 * puede aportar precio REAL a "Aceite de oliva 0,4º" (el alimento genérico
 * que usan las recetas) SIN tocar la estructura existente.
 *
 * Filtro de calidad: el producto debe contener la palabra principal
 * (primer sustantivo significativo) del nombre del alimento para evitar
 * falsos positivos como "Chocolate con Almendras" vinculado a "Pasta de almendras".
 *
 * Uso:
 *   node scripts/enriquecer-precios-recetas.mjs          # dry-run
 *   node scripts/enriquecer-precios-recetas.mjs --apply  # ejecutar
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

/** Mínimo ratio de palabras coincidentes */
const MIN_RATIO = 0.4
const MIN_MATCH_WORDS = 2

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

// ── Helpers ──────────────────────────────────────────────────────────

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrae palabras clave significativas del nombre del alimento.
 * Elimina contenido entre paréntesis (modificadores como "sin sal", "con piel")
 * y filtra palabras vacías.
 */
function getPalabrasClave(s) {
  // Quitar contenido entre paréntesis
  const sinParentesis = String(s || '').replace(/\([^)]*\)/g, '')
  const n = norm(sinParentesis)
  const palabras = n.split(/\s+/).filter(p => p.length > 2 && !SKIP_MAIN_WORDS.has(p))

  // Palabras vacías comunes
  const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'con', 'sin', 'y', 'e', 'o', 'a', 'para', 'por', 'al', 'un', 'una', 'su', 'que', '0', '0,4'])
  return palabras.filter(p => !STOP.has(p))
}

/**
 * Obtiene el sustantivo principal (primera palabra significativa del nombre,
 * después de quitar paréntesis y palabras vacías).
 */
function getMainNoun(s) {
  const palabras = getPalabrasClave(s)
  return palabras.length > 0 ? palabras[0] : null
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(90))
  console.log('  ENRIQUECER PRECIOS REALES EN ALIMENTOS DE RECETAS')
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo análisis)' : '💥 APLICANDO cambios'}`)
  console.log('═'.repeat(90))

  // 1. Cargar supermercados
  const { data: supers } = await sb.from('supermercados').select('id, slug, nombre')
  const slugMap = new Map(supers.map(s => [s.id, s.slug]))
  const realIds = new Set(supers.filter(s => s.id !== REF_ID).map(s => s.id))

  // 2. Alimentos usados en recetas
  const { data: ri } = await sb.from('receta_ingredientes').select('alimento_id').not('alimento_id', 'is', null)
  const usedIds = [...new Set(ri.map(r => r.alimento_id))]
  const usoCount = {}
  for (const r of ri) usoCount[r.alimento_id] = (usoCount[r.alimento_id] || 0) + 1

  const alimentos = []
  for (let i = 0; i < usedIds.length; i += 100) {
    const { data } = await sb.from('alimentos').select('id, nombre').in('id', usedIds.slice(i, i + 100))
    if (data) alimentos.push(...data)
  }
  console.log(`\n📦 Alimentos referenciados en recetas: ${alimentos.length}`)

  // 3. Productos con precio REAL (con paginación — Supabase limita a 1000)
  const allProds = []
  const PAGE_SIZE = 1000
  let desde = 0
  let hayMas = true
  while (hayMas) {
    const { data, error } = await sb.from('productos_supermercado')
      .select('id, alimento_id, supermercado_id, precio_por_kg, precio_unidad, unidad, url_producto, fecha_precio, notas, nombre_original, marca')
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

  console.log(`📦 Productos con precio real: ${(allProds || []).length}`)

  // 4. Alimentos que YA tienen precio real
  const hasRealPrice = new Set()
  for (const p of allProds || []) {
    if (p.supermercado_id !== REF_ID) hasRealPrice.add(p.alimento_id)
  }

  // 5. Identificar solo-ref (sin precio real)
  const soloRef = alimentos
    .filter(a => !hasRealPrice.has(a.id))
    .map(a => ({ ...a, usos: usoCount[a.id] || 0 }))
    .sort((a, b) => b.usos - a.usos)

  console.log(`🎯 Alimentos sin precio real (solo-ref): ${soloRef.length}`)

  // 6. Construir índice de productos por palabra clave
  const prodIndex = new Map()
  for (const p of allProds || []) {
    if (p.supermercado_id === REF_ID || !p.nombre_original) continue
    for (const w of getPalabrasClave(p.nombre_original)) {
      if (!prodIndex.has(w)) prodIndex.set(w, [])
      prodIndex.get(w).push(p)
    }
  }
  console.log(`📚 Índice de palabras clave: ${prodIndex.size} términos únicos`)

  // 7. Hacer matching con filtro de sustantivo principal
  const matches = []
  let filteredFalsePositives = 0

  for (const a of soloRef) {
    const palabras = getPalabrasClave(a.nombre)
    if (palabras.length === 0) continue

    const mainNoun = getMainNoun(a.nombre)
    if (!mainNoun) continue

    const candidates = new Map()

    for (const palabra of palabras) {
      const prods = prodIndex.get(palabra) || []
      for (const p of prods) {
        const pn = norm(p.nombre_original || '')
        const matchWords = palabras.filter(w => pn.includes(w)).length
        const ratio = palabras.length > 0 ? matchWords / palabras.length : 0

        if (ratio >= MIN_RATIO && matchWords >= MIN_MATCH_WORDS) {
          // Filtro anti-falso positivo: el producto debe contener el sustantivo principal
          if (!pn.includes(mainNoun)) {
            filteredFalsePositives++
            continue
          }

          const key = `${p.id}:${p.supermercado_id}`
          if (!candidates.has(key) || candidates.get(key).ratio < ratio) {
            candidates.set(key, { producto: p, matchWords, ratio })
          }
        }
      }
    }

    for (const entry of candidates.values()) {
      matches.push({
        alimento: a,
        producto: entry.producto,
        matchWords: entry.matchWords,
        ratio: entry.ratio,
        totalPalabras: palabras.length,
      })
    }
  }

  console.log(`🚫 Falsos positivos filtrados: ~${filteredFalsePositives} candidatos descartados (sin sustantivo principal)`)

  // 8. Agrupar matches por alimento
  const byAlimento = new Map()
  for (const m of matches) {
    if (!byAlimento.has(m.alimento.id)) {
      byAlimento.set(m.alimento.id, { alimento: m.alimento, productos: new Map() })
    }
    const entry = byAlimento.get(m.alimento.id)
    const sid = m.producto.supermercado_id
    const slug = slugMap.get(sid) || sid
    if (!entry.productos.has(sid)) {
      entry.productos.set(sid, { slug, count: 0, precios: [] })
    }
    entry.productos.get(sid).count++
    entry.productos.get(sid).precios.push(m.producto.precio_por_kg)
  }

  const sorted = [...byAlimento.values()].sort((a, b) => b.alimento.usos - a.alimento.usos)

  // Mostrar todos los matches sin falsos positivos
  console.log('\n' + '─'.repeat(90))
  console.log('  📋 MATCHES VÁLIDOS')
  console.log('─'.repeat(90))

  let totalNewLinks = 0
  for (const entry of sorted) {
    const a = entry.alimento

    console.log(`\n  🔹 ${a.nombre} (${a.usos} usos)`)
    for (const sup of entry.productos.values()) {
      const pMin = Math.min(...sup.precios)
      const pMax = Math.max(...sup.precios)
      const pMed = median(sup.precios)
      const rango = pMin === pMax ? `${pMin.toFixed(2)}€/kg` : `${pMin.toFixed(2)}-${pMax.toFixed(2)}€/kg`
      console.log(`     ${sup.slug.padEnd(20)} ${String(sup.count).padStart(3)} productos  ~${pMed.toFixed(2)}€/kg (${rango})`)
    }
    totalNewLinks += entry.productos.size
  }

  console.log(`\n📈 TOTAL: ${sorted.length} alimentos mejorarían, ${totalNewLinks} nuevos enlaces alimento×supermercado`)

  // 9. APLICAR
  if (!DRY_RUN && matches.length > 0) {
    console.log('\n' + '═'.repeat(90))
    console.log('  💥 APLICANDO ENRIQUECIMIENTO')
    console.log('═'.repeat(90))

    let ok = 0, err = 0, skip = 0

    for (const entry of sorted) {
      const a = entry.alimento
      for (const [sid, sup] of entry.productos) {
        // Verificar si ya existe un enlace directo
        const { data: existing } = await sb.from('productos_supermercado')
          .select('id')
          .eq('alimento_id', a.id)
          .eq('supermercado_id', sid)
          .gt('precio_por_kg', 0)
          .limit(1)

        if (existing && existing.length > 0) {
          skip++
          continue
        }

        // Tomar el mejor producto (mayor ratio de match) para este alimento+supermercado
        const bestMatch = matches
          .filter(m => m.alimento.id === a.id && m.producto.supermercado_id === sid)
          .sort((a, b) => b.ratio - a.ratio)[0]

        if (!bestMatch) continue

        const p = bestMatch.producto

        const { error } = await sb.from('productos_supermercado').insert({
          supermercado_id: p.supermercado_id,
          alimento_id: a.id,
          precio_por_kg: p.precio_por_kg,
          precio_unidad: p.precio_unidad,
          unidad: p.unidad,
          url_producto: p.url_producto,
          fecha_precio: p.fecha_precio || new Date().toISOString(),
          notas: `Enlazado desde: ${p.nombre_original || p.alimento_id} (enriquecimiento automático)`,
          nombre_original: p.nombre_original,
          marca: p.marca,
        }).maybeSingle()

        if (error) {
          if (error.code === '23505') { skip++; continue }
          console.log(`  ❌ Error: ${error.message}`)
          err++
        } else {
          ok++
        }
      }
    }

    console.log(`\n  ✅ ${ok} nuevos enlaces creados`)
    console.log(`  ⏭️  ${skip} ya existían (omitidos)`)
    console.log(`  ❌ ${err} errores`)
  }

  if (DRY_RUN) {
    console.log(`\n  Para aplicar: node scripts/enriquecer-precios-recetas.mjs --apply`)
  }

  process.exit(0)
}

function median(arr) {
  if (!arr || arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
