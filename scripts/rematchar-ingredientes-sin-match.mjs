#!/usr/bin/env node
/**
 * rematchar-ingredientes-sin-match.mjs
 *
 * Re-intenta matchear receta_ingredientes con alimento_id=null
 * contra la tabla alimentos actualizada.
 *
 * Estrategia:
 * 1. Carga todos los alimentos en memoria (Map nombre_normalizado → id)
 * 2. Para cada ingrediente sin match, intenta:
 *    a) Match exacto normalizado
 *    b) Match parcial: todas las palabras significativas del ingrediente aparecen en el nombre del alimento
 *    c) Match inverso: todas las palabras del alimento aparecen en el nombre del ingrediente
 * 3. Actualiza alimento_id donde hay match
 *
 * USO:
 *   node scripts/rematchar-ingredientes-sin-match.mjs             (dry-run)
 *   node scripts/rematchar-ingredientes-sin-match.mjs --aplicar
 *   node scripts/rematchar-ingredientes-sin-match.mjs --horas 4   (solo últimas N horas)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(resolve(__dirname, '../.env.local'), 'utf-8').split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '')
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APLICAR = process.argv.includes('--aplicar')
const HORAS = (() => { const i = process.argv.indexOf('--horas'); return i !== -1 ? parseInt(process.argv[i+1]) : 0 })()

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Palabras a ignorar en matching (stopwords culinarias)
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'con', 'y', 'en', 'a', 'al', 'o', 'sin',
  'fresco', 'fresca', 'frescos', 'frescas', 'seco', 'seca', 'secos', 'secas',
  'grande', 'grandes', 'pequeno', 'molido', 'molida', 'crudo', 'cruda',
  'cocido', 'cocida', 'entero', 'entera', 'natural', 'puro', 'pura',
  'para', 'por', 'las', 'los', 'una', 'unos', 'unas', 'muy', 'mas', 'poco'])

// Ingredientes que no deben matchearse (alcohol u otros problemáticos)
const NOMBRES_BLOQUEADOS = new Set(['vino', 'agua', 'sal', 'hielo', 'caldo'])

function palabrasSignificativas(s) {
  // Mínimo 4 caracteres y no stopword
  return norm(s).split(' ').filter(w => w.length >= 4 && !STOPWORDS.has(w))
}

// Comprueba si la palabra p aparece como palabra completa en el texto objetivo
function contieneComoPalabra(texto, p) {
  const re = new RegExp('(?:^|\\s)' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|\\s|s\\b)', 'i')
  return re.test(' ' + texto + ' ')
}

async function main() {
  console.log('🔗 Re-match ingredientes sin alimento_id')
  console.log(`📋 Modo: ${APLICAR ? '🔴 APLICAR' : '🔍 DRY RUN'}${HORAS ? ` | Últimas ${HORAS}h` : ''}`)
  console.log()

  // 1. Cargar alimentos en memoria
  const alimentos = []
  let offset = 0
  while (true) {
    const { data } = await sb.from('alimentos').select('id, nombre, calorias').range(offset, offset + 999).order('id')
    if (!data || data.length === 0) break
    alimentos.push(...data)
    if (data.length < 1000) break
    offset += 1000
  }
  console.log(`📦 ${alimentos.length} alimentos en memoria`)

  // Construir índice
  const mapaExacto = new Map()  // norm(nombre) → alimento
  for (const a of alimentos) {
    mapaExacto.set(norm(a.nombre), a)
  }

  // 2. Cargar receta_ingredientes sin match
  let q = sb.from('receta_ingredientes')
    .select('id, nombre_libre, receta_id, created_at')
    .is('alimento_id', null)
    .not('nombre_libre', 'is', null)

  if (HORAS > 0) {
    const desde = new Date(Date.now() - HORAS * 3600000).toISOString()
    // Unir con recetas para filtrar por fecha
    // Simplificación: cargar todos y filtrar por receta
  }

  const { data: sinMatch, error } = await q.order('id').limit(5000)
  if (error) { console.error('Error:', error.message); process.exit(1) }

  console.log(`🔍 ${sinMatch?.length || 0} ingredientes sin alimento_id`)
  console.log()

  if (!sinMatch || sinMatch.length === 0) {
    console.log('✅ Todos los ingredientes tienen alimento_id')
    return
  }

  // 3. Intentar re-match
  const matches = []
  const noMatch = []

  for (const ing of sinMatch) {
    const nombre = ing.nombre_libre || ''
    const n = norm(nombre)

    // a) Match exacto
    if (mapaExacto.has(n)) {
      const a = mapaExacto.get(n)
      matches.push({ id: ing.id, nombre_libre: nombre, alimento: a, tipo: 'exacto' })
      continue
    }

    // b) Match parcial: palabras del ingrediente ⊆ nombre del alimento
    const palabras = palabrasSignificativas(nombre)
    // Bloquear ingredientes genéricos problemáticos
    if (palabras.length === 0 || palabras.every(p => NOMBRES_BLOQUEADOS.has(p))) {
      noMatch.push(ing); continue
    }

    let mejorMatch = null
    let mejorScore = 0

    for (const a of alimentos) {
      const aN = norm(a.nombre)
      const palabrasA = palabrasSignificativas(a.nombre)
      if (palabrasA.length === 0) continue

      // Usar word-boundary matching (no substring)
      const coinciden = palabras.filter(p => contieneComoPalabra(aN, p))
      const score = coinciden.length / Math.max(palabras.length, palabrasA.length)

      // Requerir al menos 1 palabra compartida y score mínimo
      if (coinciden.length >= 1 && score > mejorScore && score >= 0.5) {
        mejorScore = score
        mejorMatch = a
      }
    }

    if (mejorMatch) {
      matches.push({ id: ing.id, nombre_libre: nombre, alimento: mejorMatch, tipo: `parcial(${(mejorScore*100).toFixed(0)}%)` })
    } else {
      noMatch.push(ing)
    }
  }

  console.log(`✅ Con match: ${matches.length}`)
  console.log(`❌ Sin match: ${noMatch.length}`)
  console.log()

  // Mostrar matches encontrados
  if (matches.length > 0) {
    console.log('📋 Matches encontrados:')
    for (const m of matches) {
      const kcalStr = m.alimento.calorias > 0 ? `${m.alimento.calorias} kcal` : '0 kcal ⚠️'
      console.log(`  "${m.nombre_libre}" → "${m.alimento.nombre}" [${m.tipo}] (${kcalStr})`)
    }
    console.log()
  }

  if (noMatch.length > 0 && noMatch.length <= 30) {
    console.log('📋 Sin match (necesitan alimentos nuevos o MATCH_FIXES):')
    const vistos = new Set()
    for (const m of noMatch) {
      if (!vistos.has(m.nombre_libre)) {
        console.log(`  - "${m.nombre_libre}"`)
        vistos.add(m.nombre_libre)
      }
    }
    console.log()
  }

  if (!APLICAR) {
    console.log('💡 Para aplicar: node scripts/rematchar-ingredientes-sin-match.mjs --aplicar')
    return
  }

  // 4. Aplicar updates
  let actualizados = 0
  let errores = 0

  for (const m of matches) {
    // No actualizar si el alimento tiene 0 kcal y no es condimento/especia
    if (m.alimento.calorias === 0 && !['Especias y condimentos', 'Caldos y sopas'].includes(m.alimento.categoria)) {
      console.log(`  ⏭️  Skip (0 kcal): "${m.nombre_libre}" → "${m.alimento.nombre}"`)
      continue
    }

    const { error } = await sb
      .from('receta_ingredientes')
      .update({ alimento_id: m.alimento.id })
      .eq('id', m.id)

    if (error) {
      console.error(`  ❌ ${m.nombre_libre}: ${error.message}`)
      errores++
    } else {
      actualizados++
    }
  }

  console.log(`✅ ${actualizados} actualizados | ❌ ${errores} errores`)
}

main().catch(console.error)
