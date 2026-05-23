#!/usr/bin/env node
/**
 * INVESTIGA QUÉ PRODUCTOS REALES MATCHearon PARA CADA ALIMENTO
 * Útil para verificar falsos positivos antes de aplicar.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

const SKIP_MAIN_WORDS = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '0,4', '0,0', '0%', '100%', 'natural', 'eco', 'bio', 'light',
  'entero', 'tradicional', 'premium', 'extra', 'suave', 'intenso',
  'fresco', 'fresca', 'cruda', 'crudo', 'cocido', 'cocida',
  'molida', 'molido', 'rallado', 'triturado', 'tostada', 'tostadas',
  'seco', 'seca', 'secos', 'secas', 'congelado', 'congelada',
  'sin', 'con', '0,0%', '0,4º', 'lata', 'frasco', 'bolsa', 'pack',
  'caja', 'botella', 'bote', 'tarrina', 'bandeja',
])

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
  const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'con', 'sin', 'y', 'e', 'o', 'a', 'para', 'por', 'al', 'un', 'una', 'su', 'que', '0', '0,4', 'lo'])
  return palabras.filter(p => !STOP.has(p))
}

function getMainNoun(s) {
  const palabras = getPalabrasClave(s)
  return palabras.length > 0 ? palabras[0] : null
}

const MIN_RATIO = 0.4
const MIN_MATCH_WORDS = 2

/** Alimentos sospechosos a investigar */
const SOSPECHOSOS = [
  'Leche de almendras',
  'azucar glas',
  'Leche en polvo',
  'Leche de coco (lata)',
  'Tortita de arroz',
  'Espárragos trigueros',
  'Pasta de almendras (sin azúcar)',
  'Huevo duro',
  'Queso gruyer',
  'Vinagre de vino',
  'Hígado de pollo',
  'Boquerón limpio sin cabeza',
  'Bicarbonato de sodio',
  'Levadura fresca Levital',
  'Salsa sriracha',
  'Proteína en polvo (vainilla o chocolate)',
  'Nuez moscada molida',
  'Sal en escamas (para decorar)',
  'arroz para sushi',
  'gelatina en láminas',
]

async function main() {
  // Cargar todos los productos reales
  const allProds = []
  const PAGE_SIZE = 1000
  let desde = 0
  let hayMas = true
  while (hayMas) {
    const { data, error } = await sb.from('productos_supermercado')
      .select('id, alimento_id, supermercado_id, precio_por_kg, nombre_original, marca')
      .gt('precio_por_kg', 0)
      .range(desde, desde + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) { hayMas = false; break }
    allProds.push(...data)
    if (data.length < PAGE_SIZE) hayMas = false
    else desde += PAGE_SIZE
  }
  const realProds = allProds.filter(p => p.supermercado_id !== REF_ID)

  // Cargar supermercados
  const { data: supers } = await sb.from('supermercados').select('id, slug, nombre')
  const slugMap = new Map(supers.map(s => [s.id, s.slug]))

  // Cargar alimentos que coincidan con los sospechosos
  const { data: alimentos } = await sb.from('alimentos')
    .select('id, nombre, categoria')
    .in('nombre', SOSPECHOSOS)

  if (!alimentos || alimentos.length === 0) {
    // Intentar con ILIKE
    const all = []
    for (const name of SOSPECHOSOS) {
      const { data } = await sb.from('alimentos')
        .select('id, nombre, categoria')
        .ilike('nombre', `%${name}%`)
      if (data) all.push(...data)
    }
    alimentos = all.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
  }

  console.log(`Alimentos encontrados: ${alimentos?.length || 0}\n`)

  for (const a of (alimentos || [])) {
    console.log('═'.repeat(100))
    console.log(`  🔍 ${a.nombre}`)
    console.log(`     ID: ${a.id}`)
    console.log(`     Categoría: ${a.categoria || 'sin categoría'}`)

    const palabras = getPalabrasClave(a.nombre)
    const mainNoun = getMainNoun(a.nombre)
    console.log(`     Palabras clave: [${palabras.join(', ')}]`)
    console.log(`     Sustantivo principal: "${mainNoun}"`)

    // Buscar productos matcheados
    const matched = new Map()

    if (palabras.length > 0 && mainNoun) {
      // Construir índice rápido para este alimento
      const prodIndex = new Map()
      for (const p of realProds) {
        if (!p.nombre_original) continue
        const pn = norm(p.nombre_original)
        const matchWords = palabras.filter(w => pn.includes(w)).length
        const ratio = matchWords / palabras.length

        if (ratio >= MIN_RATIO && matchWords >= MIN_MATCH_WORDS) {
          if (!pn.includes(mainNoun)) continue
          if (!matched.has(p.id) || matched.get(p.id).ratio < ratio) {
            matched.set(p.id, { ...p, matchWords, ratio })
          }
        }
      }
    }

    if (matched.size === 0) {
      console.log('     ❌ Sin matches\n')
      continue
    }

    // Mostrar productos matcheados, ordenados por ratio descendente
    const sorted = [...matched.values()].sort((a, b) => b.ratio - a.ratio)

    console.log(`     📊 ${sorted.length} productos matcheados:`)

    for (const m of sorted) {
      const precio = m.precio_por_kg?.toFixed(2) || '?'
      const slug = slugMap.get(m.supermercado_id) || m.supermercado_id
      const nombre = (m.nombre_original || '').slice(0, 50)
      const marca = (m.marca || '').slice(0, 20)
      const ratioStr = `${(m.ratio * 100).toFixed(0)}%`
      console.log(`       ${ratioStr.padEnd(6)} ${precio}€/kg  [${slug.padEnd(12)}] ${nombre.padEnd(52)} ${marca}`)
    }
    console.log()
  }

  process.exit(0)
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
