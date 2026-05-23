#!/usr/bin/env node
/**
 * INVESTIGA por qué productos básicos (aceite oliva, cebolla, etc.)
 * no tienen precio REAL en Mercadona/Consum a pesar de tener 8465+ productos scrapeados.
 * 
 * Hipótesis: duplicados en alimentos (mismo nombre, distinto ID) o
 *            fallo en el matching scraping → alimentos
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve('.env.local')
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

async function main() {
  // 1. Cargar productos scrapeados de Mercadona y Consum
  const { data: supers } = await sb.from('supermercados').select('id, nombre')
  const superName = new Map(supers.map(s => [s.id, s.nombre]))
  const mercadonaId = supers.find(s => s.slug === 'mercadona')?.id
  const consumId = supers.find(s => s.slug === 'consum')?.id

  console.log('=== 1. PRODUCTOS SCRAPEADOS POR ALIMENTO (Mercadona + Consum) ===')
  // Get all productos_supermercado for Mercadona and Consum
  const { data: prodMerc } = await sb.from('productos_supermercado')
    .select('alimento_id')
    .eq('supermercado_id', mercadonaId)
    .gt('precio_por_kg', 0)
  const { data: prodConsum } = await sb.from('productos_supermercado')
    .select('alimento_id')
    .eq('supermercado_id', consumId)
    .gt('precio_por_kg', 0)

  const mercAlimentos = new Set(prodMerc?.map(p => p.alimento_id) || [])
  const consumAlimentos = new Set(prodConsum?.map(p => p.alimento_id) || [])

  console.log(`Mercadona: ${mercAlimentos.size} alimentos únicos con precio`)
  console.log(`Consum:   ${consumAlimentos.size} alimentos únicos con precio`)
  console.log(`Ambos:    ${[...mercAlimentos].filter(id => consumAlimentos.has(id)).length} alimentos en común`)

  // 2. Top 20 alimentos SOLO referencia - buscar si existen duplicados con precio real
  const { data: ri } = await sb.from('receta_ingredientes').select('alimento_id').not('alimento_id', 'is', null)
  const alimentoIds = [...new Set(ri.map(r => r.alimento_id))]

  const alimentos = []
  for (let i = 0; i < alimentoIds.length; i += 100) {
    const { data } = await sb.from('alimentos').select('id, nombre, categoria').in('id', alimentoIds.slice(i, i + 100))
    if (data) alimentos.push(...data)
  }
  const alimentoMap = new Map(alimentos.map(a => [a.id, a]))

  // Precios totales por alimento
  const { data: allProds } = await sb.from('productos_supermercado')
    .select('alimento_id, supermercado_id')
    .in('alimento_id', alimentoIds)
    .gt('precio_por_kg', 0)

  const foodSupMap = new Map()
  for (const p of allProds || []) {
    if (!foodSupMap.has(p.alimento_id)) foodSupMap.set(p.alimento_id, new Set())
    foodSupMap.get(p.alimento_id).add(p.supermercado_id)
  }

  const realIds = new Set(supers.filter(s => s.id !== REF_ID).map(s => s.id))
  const usoCount = {}
  for (const r of ri) usoCount[r.alimento_id] = (usoCount[r.alimento_id] || 0) + 1

  // Alimentos que solo tienen referencia
  const soloRef = alimentos.filter(a => {
    const sups = foodSupMap.get(a.id)
    if (!sups) return true
    return ![...sups].some(sid => realIds.has(sid))
  }).map(a => ({ ...a, usos: usoCount[a.id] || 0 })).sort((a, b) => b.usos - a.usos)

  console.log(`\n=== 2. TOP 30 ALIMENTOS CON SOLO PRECIO REFERENCIA ===`)
  for (const a of soloRef.slice(0, 30)) {
    console.log(`  ${String(a.usos).padStart(3)} usos | ${a.nombre.padEnd(40)} [${a.categoria || ''}]`)
  }

  // 3. Para cada uno, buscar duplicados semánticos
  console.log(`\n=== 3. BUSCANDO DUPLICADOS SEMÁNTICOS ===`)
  let conDuplicado = 0
  let sinDuplicado = 0

  for (const a of soloRef.slice(0, 50)) {
    // Normalize name for fuzzy search
    const name = a.nombre.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim()
    const words = name.split(/\s+/).filter(w => w.length > 2)
    if (words.length < 2) { sinDuplicado++; continue }

    // Search for similar names
    const { data: similares } = await sb.from('alimentos')
      .select('id, nombre, categoria')
      .or(words.slice(0, 2).map(w => `nombre.ilike.%${w}%`).join(','))
      .not('id', 'eq', a.id)

    if (!similares || similares.length === 0) { sinDuplicado++; continue }

    // Check if any similar has a real price
    const conPrecio = similares.filter(s => {
      const sups = foodSupMap.get(s.id)
      return sups && [...sups].some(sid => realIds.has(sid))
    })

    if (conPrecio.length > 0) {
      conDuplicado++
      console.log(`\n  🔴 "${a.nombre}" (${a.usos} usos) → ${conPrecio.length} similares CON PRECIO REAL:`)
      conPrecio.slice(0, 3).forEach(s => {
        const sups = foodSupMap.get(s.id)
        const supNombres = [...sups].filter(sid => realIds.has(sid)).map(sid => superName.get(sid)).join(', ')
        console.log(`     ✅ "${s.nombre}" [${s.categoria}] → en: ${supNombres}`)
      })
    } else {
      sinDuplicado++
    }
  }

  console.log(`\n=== 4. RESUMEN ===`)
  console.log(`Total solo-ref analizados: ${soloRef.slice(0, 50).length}`)
  console.log(`Con duplicado con precio real: ${conDuplicado}`)
  console.log(`Sin duplicado con precio real: ${sinDuplicado}`)
  console.log(`\nPara los ${conDuplicado} con duplicado → se podría re-vincular ingredientes al ID con precio`)
  console.log(`Para los ${sinDuplicado} sin duplicado → toca poblar precio referencia o scrapear más`)

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
