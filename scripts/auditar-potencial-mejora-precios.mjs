#!/usr/bin/env node
/**
 * AUDITORÍA PROFUNDA: Productos con nombre_original que PODRÍAN vincularse
 * a alimentos de recetas mediante matching semántico.
 * 
 * Busca productos existentes en productos_supermercado cuyo nombre_original
 * coincida semánticamente con alimentos de recetas que hoy no tienen precio real.
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
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const REF_ID = '11111111-1111-4111-8111-111111111111'

function norm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

async function main() {
  // 1. Alimentos usados en recetas
  const { data: ri } = await sb.from('receta_ingredientes').select('alimento_id').not('alimento_id', 'is', null)
  const usedIds = [...new Set(ri.map(r => r.alimento_id))]
  const usoCount = {}
  for (const r of ri) usoCount[r.alimento_id] = (usoCount[r.alimento_id] || 0) + 1

  const alimentos = []
  for (let i = 0; i < usedIds.length; i += 100) {
    const { data } = await sb.from('alimentos').select('id, nombre').in('id', usedIds.slice(i, i + 100))
    if (data) alimentos.push(...data)
  }

  // 2. Productos con precio REAL por alimento
  const { data: allProds } = await sb.from('productos_supermercado')
    .select('id, alimento_id, supermercado_id, precio_por_kg, nombre_original, marca')
    .gt('precio_por_kg', 0)
    .limit(5000)

  const supByFood = new Map()
  for (const p of allProds || []) {
    if (p.supermercado_id === REF_ID) continue
    if (!supByFood.has(p.alimento_id)) supByFood.set(p.alimento_id, new Set())
    supByFood.get(p.alimento_id).add(p.supermercado_id)
  }

  // 3. Alimentos solo-ref (sin precio real)
  const soloRef = alimentos.filter(a => {
    const sups = supByFood.get(a.id)
    return !sups || sups.size === 0
  }).map(a => ({ ...a, usos: usoCount[a.id] || 0 }))
    .sort((a, b) => b.usos - a.usos)

  // 4. Construir índice de productos por palabra clave
  // Agrupar productos por su palabra más significativa
  const prodIndex = {}
  for (const p of allProds || []) {
    if (p.supermercado_id === REF_ID || !p.nombre_original) continue
    const n = norm(p.nombre_original)
    const words = n.split(/\s+/).filter(w => w.length > 3)
    for (const w of words) {
      if (!prodIndex[w]) prodIndex[w] = []
      prodIndex[w].push(p)
    }
  }

  const supers = new Map()
  const { data: superList } = await sb.from('supermercados').select('id, slug')
  for (const s of superList) supers.set(s.id, s.slug)

  console.log('═'.repeat(100))
  console.log('  AUDITORÍA PROFUNDA: Matching semántico productos → alimentos de recetas')
  console.log('═'.repeat(100))
  console.log(`\n  Alimentos sin precio real: ${soloRef.length}`)

  let totalMatches = 0
  const resultados = []

  for (const a of soloRef) {
    const n = norm(a.nombre)
    const palabras = n.split(/\s+/).filter(p => p.length > 2)
    if (palabras.length === 0) continue

    // Buscar productos cuyas palabras clave coincidan
    const foundProds = new Map() // alimento_id → {supers, count, example}

    for (const palabra of palabras) {
      const prods = prodIndex[palabra]
      if (!prods) continue
      for (const p of prods) {
        const pn = norm(p.nombre_original)
        // Calcular cuántas palabras del alimento aparecen en el producto
        const matchWords = palabras.filter(w => pn.includes(w)).length
        const ratio = matchWords / palabras.length

        // Umbral: al menos 50% de palabras coinciden Y al menos 2 palabras
        if (ratio >= 0.5 && matchWords >= 2) {
          if (!foundProds.has(p.alimento_id)) {
            foundProds.set(p.alimento_id, {
              supermercados: new Set(),
              count: 0,
              example: p.nombre_original,
              ratio
            })
          }
          const entry = foundProds.get(p.alimento_id)
          entry.supermercados.add(p.supermercado_id)
          entry.count++
          if (entry.ratio < ratio) {
            entry.ratio = ratio
            entry.example = p.nombre_original
          }
        }
      }
    }

    if (foundProds.size > 0) {
      totalMatches += [...foundProds.values()].reduce((s, e) => s + e.supermercados.size, 0)

      const bestEntries = [...foundProds.entries()]
        .sort((a, b) => b[1].supermercados.size - a[1].supermercados.size)
        .slice(0, 3) // top 3 alimentos origen

      const supList = [...new Set(
        [...foundProds.values()].flatMap(e => [...e.supermercados].map(sid => supers.get(sid)))
      )].filter(Boolean).join(', ')

      const prodCount = [...foundProds.values()].reduce((s, e) => s + e.count, 0)
      const nSup = [...new Set([...foundProds.values()].flatMap(e => [...e.supermercados]))].length

      resultados.push({
        nombre: a.nombre,
        usos: a.usos,
        alimentosOrigen: foundProds.size,
        productos: prodCount,
        supermercados: nSup,
        supList,
        bestMatch: bestEntries[0]?.[1]?.example || ''
      })
    }
  }

  // Mostrar resultados
  resultados.sort((a, b) => b.usos - a.usos)
  console.log('\n  Alimento'.padEnd(38) + 'Usos'.padEnd(6) + 'Prod'.padEnd(6) + 'Sup'.padEnd(5) + 'Supermercados')
  console.log('  ' + '-'.repeat(95))
  for (const r of resultados) {
    console.log(`  ${r.nombre.padEnd(38)} ${String(r.usos).padEnd(5)} ${String(r.productos).padEnd(5)} ${String(r.supermercados).padEnd(4)} ${r.supList}`)
    if (r.bestMatch) {
      console.log(`  ${''.padEnd(38)} ${''.padEnd(5)} ${''.padEnd(5)} ${''.padEnd(4)} Ej: "${r.bestMatch.substring(0, 55)}"`)
    }
  }

  console.log(`\n📈 Total alimentos que podrían ganar precios reales: ${resultados.length} de ${soloRef.length}`)
  console.log(`   Conexiones potenciales totales (alimento×supermercado): ${totalMatches}`)

  // Resumen por supermercado
  const supStats = {}
  for (const r of resultados) {
    for (const sup of r.supList.split(', ')) {
      if (sup) supStats[sup] = (supStats[sup] || 0) + 1
    }
  }
  console.log('\n📊 Alimentos que ganarían precio por supermercado:')
  for (const [sup, count] of Object.entries(supStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sup.padEnd(25)} ${String(count).padStart(3)} alimentos`)
  }

  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
