#!/usr/bin/env tsx
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceSupabase } from '../lib/supabase-server'

async function main() {
  const supabase = createServiceSupabase()
  const { data, error } = await supabase.from('knowledge_base').select('tags, condiciones, titulo')
  if (error) { console.error(error); process.exit(1) }

  const tagCounts = new Map<string, number>()
  const condCounts = new Map<string, number>()

  for (const row of data) {
    for (const t of row.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    for (const c of row.condiciones ?? []) condCounts.set(c, (condCounts.get(c) ?? 0) + 1)
  }

  const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])

  console.log('=== KNOWLEDGE_BASE TAG DIAGNÓSTICO ===')
  console.log(`Total papers: ${data.length}`)
  console.log('')

  console.log('── TAGS (de DeepSeek / PubMed) ──')
  for (const [tag, count] of sortDesc(tagCounts)) {
    console.log(`  ${tag.padEnd(35)} ${count} papers`)
  }

  console.log('')
  console.log('── CONDICIONES ──')
  for (const [c, count] of sortDesc(condCounts)) {
    console.log(`  ${c.padEnd(35)} ${count} papers`)
  }

  // CLIENT-SIDE tags (from knowledge-base.ts)
  console.log('')
  console.log('── CLIENT PROFILE TAGS (from knowledge-base.ts) ──')
  const clientTags = [
    'perder_grasa', 'deficit', 'ganar_musculo', 'hipertrofia', 'volumen', 'recomposicion',
    'rendimiento', 'atletismo', 'deporte', 'competicion',
    'running', 'fondo', 'maraton', 'trail', 'resistencia_aerobica',
    'ciclismo', 'triatlon', 'bici', 'ironman',
    'hyrox', 'crossfit', 'funcional',
    'fuerza', 'powerlifting', 'halterofilia',
    'diabetes', 'resistencia_insulina', 'glucemia',
    'hipotiroidismo', 'tiroides',
    'pcos', 'sop', 'menopausia', 'climaterio',
    'vegano', 'vegetariano', 'plant_based',
    'mayor_55', 'sarcopenia', 'envejecimiento',
    'amateur', 'recreacional', 'principiante',
    'hta', 'hipertension', 'presion_alta', 'cardiovascular',
    'dislipemia', 'colesterol',
    'higado_graso', 'nafld', 'esteatosis',
    'ansiedad', 'salud_mental',
    'salud_general',
  ]

  const kbTags = new Set(tagCounts.keys())

  const overlap = clientTags.filter(t => kbTags.has(t))
  const missingFromKB = clientTags.filter(t => !kbTags.has(t))
  const extraInKB = [...kbTags].filter(t => !clientTags.includes(t))

  console.log(`Cliente tags total: ${clientTags.length}`)
  console.log(`KB tags total: ${kbTags.size}`)
  console.log('')
  console.log(`✅ Overlap (cliente ↔ KB): ${overlap.length} tags`)
  if (overlap.length > 0) console.log(`  ${overlap.join(', ')}`)
  console.log('')
  console.log(`❌ Client-side tags NOT in KB: ${missingFromKB.length}`)
  for (const t of missingFromKB) console.log(`  ❌ ${t}`)
  console.log('')
  console.log(`🔬 KB-only tags (NOT in client profile): ${extraInKB.length}`)
  for (const t of extraInKB.sort()) console.log(`  🔬 ${t} (${tagCounts.get(t)} papers)`)

  // Show samples
  console.log('')
  console.log('── SAMPLE PAPERS (5 with most tags) ──')
  const sorted = [...data].sort((a, b) => (b.tags?.length ?? 0) - (a.tags?.length ?? 0)).slice(0, 5)
  for (const p of sorted) {
    console.log(`  📄 ${(p.titulo ?? '').slice(0, 80)}`)
    console.log(`     tags: ${(p.tags ?? []).join(', ')}`)
    console.log(`     condiciones: ${(p.condiciones ?? []).join(', ')}`)
    console.log('')
  }

  // Find papers that WOULD match a specific profile
  console.log('── TEST: Which papers match "perder_grasa" profile? ──')
  const testTags = ['perder_grasa', 'deficit', 'diabetes', 'hipertension']
  let matched = 0
  for (const row of data) {
    const rowTags = new Set(row.tags ?? [])
    if (testTags.some(t => rowTags.has(t))) {
      matched++
      if (matched <= 3) {
        console.log(`  ✅ ${(row.titulo ?? '').slice(0, 70)}`)
        console.log(`     tags: ${(row.tags ?? []).join(', ')}`)
      }
    }
  }
  console.log(`  Total papers matching any of [${testTags.join(', ')}]: ${matched} / ${data.length}`)
}

main().catch(console.error)
