// scripts/audit-recetas-hoy.ts
// Auditoría de recetas generadas hoy con estado='en_revision'
// Uso: npx tsx scripts/audit-recetas-hoy.ts

import * as dotenv from 'dotenv'
import * as path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { validarVocabulario } from '../lib/recetas/agente-recetario/vocabulary-guard'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ─── Criterios de nombre ────────────────────────────────────────────────────

const BAD_NAME_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /para\s+tapering/i, reason: 'Nombre contiene contexto técnico "para tapering"' },
  { regex: /pre[- ]entreno/i, reason: 'Nombre contiene "pre-entreno"' },
  { regex: /post[- ]entreno/i, reason: 'Nombre contiene "post-entreno"' },
  { regex: /\btapering\b/i, reason: 'Nombre contiene "tapering"' },
  { regex: /para\s+carga/i, reason: 'Nombre contiene "para carga"' },
  { regex: /para\s+running/i, reason: 'Nombre termina con contexto técnico "para running"' },
  { regex: /para\s+el?\s+rendimiento\b/i, reason: 'Nombre menciona rendimiento como contexto técnico' },
  { regex: /\bdislipidemia\b/i, reason: 'Nombre menciona patología: dislipidemia' },
  { regex: /\bhipotiroidismo\b/i, reason: 'Nombre menciona patología: hipotiroidismo' },
  { regex: /\bcolon\s+irritable\b/i, reason: 'Nombre menciona patología: colon irritable' },
  { regex: /\binsulina\b/i, reason: 'Nombre menciona patología: insulina' },
  { regex: /\bsaludable\b/i, reason: 'Nombre contiene "saludable" (evitar jerga fit)' },
  { regex: /\bfit\b/i, reason: 'Nombre contiene "fit"' },
  { regex: /\bhealthy\b/i, reason: 'Nombre contiene "healthy"' },
  { regex: /\bproteico\b/i, reason: 'Nombre contiene "proteico"' },
]

// Patrón: nombre aburrido/genérico = menos de 3 palabras sin adjetivo culinario ni técnica
const CULINARY_ADJECTIVES = [
  'meloso', 'cremoso', 'jugoso', 'tierno', 'crujiente', 'glaseado', 'especiado',
  'aliñado', 'vaporizado', 'dorado', 'tostado', 'caramelizado', 'ahumado',
  'marinado', 'empanado', 'gratinado', 'asado', 'pochado', 'estofado',
  'guisado', 'salteado', 'confitado', 'escabechado', 'al vapor', 'al horno',
  'a la plancha', 'al ajillo', 'al wok', 'con sofrito', 'con alioli',
  'a la vasca', 'a la catalana', 'en salsa', 'en escabeche',
  'picante', 'suave', 'aromático', 'fresco', 'ligero',
]

function isBoring(nombre: string): boolean {
  const words = nombre.trim().split(/\s+/)
  // Menos de 4 palabras y sin adjetivo culinario ni técnica
  if (words.length < 4) {
    const lower = nombre.toLowerCase()
    const hasAdjective = CULINARY_ADJECTIVES.some(adj => lower.includes(adj))
    if (!hasAdjective) return true
  }
  return false
}

// "Batido de proteína" → malo si proteína es la palabra principal del descriptor
function isProteinMainDescriptor(nombre: string): boolean {
  return /^batido\s+de\s+prote[íi]na\b/i.test(nombre)
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

type AuditStatus = 'GOOD' | 'WARNING' | 'BAD'

interface AuditResult {
  id: string
  nombre: string
  status: AuditStatus
  reasons: string[]
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Fecha de hoy en formato ISO
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  console.log(`\n📋 Auditoría de recetas generadas hoy (≥ ${todayISO.split('T')[0]}) con estado='en_revision'\n`)

  const { data: recetas, error } = await supabase
    .from('recetas')
    .select('id, nombre, descripcion, instrucciones, consejos, tags, tipo_plato, created_at')
    .eq('estado', 'en_revision')
    .gte('created_at', todayISO)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error al cargar recetas:', error.message)
    process.exit(1)
  }

  if (!recetas || recetas.length === 0) {
    console.log('ℹ️  No hay recetas de hoy con estado en_revision.')
    process.exit(0)
  }

  console.log(`📦 Total recetas a auditar: ${recetas.length}\n`)
  console.log('─'.repeat(72))

  const results: AuditResult[] = []

  for (const receta of recetas) {
    const reasons: string[] = []

    // 1. Vocabulary guard
    const instrucciones = receta.instrucciones
      ? (typeof receta.instrucciones === 'string'
          ? receta.instrucciones.split('\n')
          : Array.isArray(receta.instrucciones)
          ? receta.instrucciones
          : [])
      : []

    const vocResult = validarVocabulario({
      nombre: receta.nombre ?? '',
      descripcion: receta.descripcion ?? '',
      instrucciones,
      consejos: receta.consejos ?? undefined,
    })

    if (!vocResult.valido) {
      for (const v of vocResult.violaciones) {
        reasons.push(`[vocabulary:${v.campo}] patrón "${v.patron}"${v.sugerencia ? ` → sugerencia: "${v.sugerencia}"` : ''}`)
      }
    }

    // 2. Bad name patterns
    for (const { regex, reason } of BAD_NAME_PATTERNS) {
      if (regex.test(receta.nombre ?? '')) {
        reasons.push(`[nombre] ${reason}`)
      }
    }

    // 3. Aburrido/genérico
    if (isBoring(receta.nombre ?? '')) {
      reasons.push(`[nombre] Nombre genérico/aburrido (< 4 palabras sin técnica culinaria): "${receta.nombre}"`)
    }

    // 4. "Batido de proteína" como descriptor principal
    if (isProteinMainDescriptor(receta.nombre ?? '')) {
      reasons.push(`[nombre] "Batido de proteína" como descriptor principal — demasiado genérico`)
    }

    // Determinar status
    let status: AuditStatus
    if (reasons.length === 0) {
      status = 'GOOD'
    } else {
      // WARNING si solo tiene problemas de nombre (no vocabulario)
      const hasVocabularyViolation = reasons.some(r => r.startsWith('[vocabulary'))
      status = hasVocabularyViolation ? 'BAD' : 'WARNING'
    }

    results.push({ id: receta.id, nombre: receta.nombre, status, reasons })

    // Log en tiempo real
    const icon = status === 'GOOD' ? '✅' : status === 'WARNING' ? '⚠️ ' : '❌'
    console.log(`${icon} ${status.padEnd(7)} | ${receta.nombre}`)
    if (reasons.length > 0) {
      for (const r of reasons) {
        console.log(`         → ${r}`)
      }
    }
  }

  // ─── Resumen final ─────────────────────────────────────────────────────────
  const good = results.filter(r => r.status === 'GOOD')
  const warnings = results.filter(r => r.status === 'WARNING')
  const bad = results.filter(r => r.status === 'BAD')
  const toApprove = results.filter(r => r.status === 'GOOD' || r.status === 'WARNING')
  const toRegenerate = results.filter(r => r.status === 'BAD')

  console.log('\n' + '═'.repeat(72))
  console.log('RESUMEN')
  console.log('═'.repeat(72))
  console.log(`  ✅ GOOD     : ${good.length}`)
  console.log(`  ⚠️  WARNING  : ${warnings.length}`)
  console.log(`  ❌ BAD      : ${bad.length}`)
  console.log(`  Total       : ${results.length}`)

  console.log('\n─── APROBAR (GOOD + WARNING) ───────────────────────────────────────')
  if (toApprove.length === 0) {
    console.log('  (ninguna)')
  } else {
    for (const r of toApprove) {
      const icon = r.status === 'GOOD' ? '✅' : '⚠️ '
      console.log(`  ${icon} ${r.id}  →  ${r.nombre}`)
    }
  }

  console.log('\n─── REGENERAR (BAD) ────────────────────────────────────────────────')
  if (toRegenerate.length === 0) {
    console.log('  (ninguna)')
  } else {
    for (const r of toRegenerate) {
      console.log(`  ❌ ${r.id}  →  ${r.nombre}`)
      for (const reason of r.reasons) {
        console.log(`       · ${reason}`)
      }
    }
  }

  // Output JSON para máquinas
  const output = {
    fecha: today.toISOString().split('T')[0],
    total: results.length,
    good: good.length,
    warnings: warnings.length,
    bad: bad.length,
    aprobar: toApprove.map(r => r.id),
    regenerar: toRegenerate.map(r => ({ id: r.id, nombre: r.nombre, reasons: r.reasons })),
  }

  console.log('\n─── JSON OUTPUT ────────────────────────────────────────────────────')
  console.log(JSON.stringify(output, null, 2))
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
