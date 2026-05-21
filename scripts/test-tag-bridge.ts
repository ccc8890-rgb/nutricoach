#!/usr/bin/env tsx
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createServiceSupabase } from '../lib/supabase-server'
import { TAG_BRIDGE, expandirTags } from '../lib/knowledge-base'

/**
 * Script de verificación del TAG_BRIDGE.
 * Simula varios perfiles de cliente y muestra cuántos papers matchean.
 */
async function testBridge() {
  const supabase = createServiceSupabase()

  // Primero, test local de expansión
  console.log('=== TEST LOCAL: Expansión TAG_BRIDGE ===')
  const testCases = [
    'perder_grasa',
    'ganar_musculo',
    'running',
    'hyrox',
    'diabetes',
    'hipertension',
    'sarcopenia',
  ]

  for (const tag of testCases) {
    const expanded = expandirTags([tag])
    console.log(`  ${tag.padEnd(20)} → ${expanded.join(', ')}`)
  }

  // Simular perfiles de cliente completos
  const perfiles = [
    {
      nombre: 'Carlos — perder grasa + diabetes',
      tags: ['perder_grasa', 'deficit', 'diabetes', 'hipertension'],
    },
    {
      nombre: 'Ana — ganar músculo + running',
      tags: ['ganar_musculo', 'hipertrofia', 'running', 'rendimiento'],
    },
    {
      nombre: 'Pedro — hyrox + fuerza',
      tags: ['hyrox', 'fuerza', 'rendimiento', 'competicion'],
    },
    {
      nombre: 'Marta — mayor 65 + sarcopenia',
      tags: ['sarcopenia', 'mayor_55', 'envejecimiento', 'proteina'],
    },
    {
      nombre: 'Laura — vegana + perder grasa',
      tags: ['vegano', 'plant_based', 'perder_grasa', 'deficit'],
    },
    {
      nombre: 'Javier — diabetes tipo 2 + hipertenso',
      tags: ['diabetes', 'hipertension', 'resistencia_insulina', 'cardiovascular'],
    },
    {
      nombre: 'Sofía — recomposición + crossfit',
      tags: ['recomposicion', 'crossfit', 'funcional', 'hiit'],
    },
  ]

  console.log('')
  console.log('=== TEST SUPABASE: Búsqueda con TAG_BRIDGE ===')
  console.log('')

  for (const perfil of perfiles) {
    const expanded = expandirTags(perfil.tags)
    const tagsEscaped = expanded.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')

    const { data, error } = await supabase
      .from('knowledge_base')
      .select('titulo, tags')
      .eq('activo', true)
      .or(`tags.ov.{${tagsEscaped}}`)
      .limit(20)

    if (error) {
      console.error(`  ❌ ${perfil.nombre}: Error — ${error.message}`)
      continue
    }

    console.log(`  ── ${perfil.nombre} ──`)
    console.log(`     Tags cliente: ${perfil.tags.join(', ')}`)
    console.log(`     Tags expandidos (${expanded.length}): ${expanded.join(', ')}`)
    console.log(`     Papers encontrados: ${data?.length ?? 0}`)
    if (data && data.length > 0) {
      const sampleTitles = data.slice(0, 3).map(r =>
        `       📄 ${(r.titulo ?? '').slice(0, 75)}  [tags: ${(r.tags ?? []).slice(0, 4).join(', ')}${(r.tags ?? []).length > 4 ? '...' : ''}]`
      ).join('\n')
      console.log(sampleTitles)
    }
    console.log('')
  }

  // Comparación: cuántos papers encontraba ANTES del bridge vs AHORA
  console.log('=== COMPARATIVA: SIN bridge vs CON bridge ===')
  for (const perfil of perfiles) {
    const tagsOriginal = perfil.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')
    const tagsExpandidos = expandirTags(perfil.tags)
    const tagsExpEscaped = tagsExpandidos.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')

    const [resOriginal, resExpandido] = await Promise.all([
      supabase.from('knowledge_base').select('id').eq('activo', true).or(`tags.ov.{${tagsOriginal}}`).limit(50),
      supabase.from('knowledge_base').select('id').eq('activo', true).or(`tags.ov.{${tagsExpEscaped}}`).limit(50),
    ])

    const before = (resOriginal.data ?? []).length
    const after = (resExpandido.data ?? []).length
    const diff = after - before
    const pct = before > 0 ? Math.round((after - before) / before * 100) : '+∞'
    console.log(`  ${perfil.nombre.padEnd(45)} SIN: ${String(before).padStart(3)} → CON: ${String(after).padStart(3)} (${diff > 0 ? '+' : ''}${diff}, ${pct}%)`)
  }
}

testBridge().catch(console.error)
