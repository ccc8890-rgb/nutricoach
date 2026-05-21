#!/usr/bin/env tsx
/**
 * Script CLI para ejecutar el pipeline de ingesta de papers.
 *
 * USO:
 *   npx tsx scripts/ingestar-papers.ts                    # Ingesta completa
 *   npx tsx scripts/ingestar-papers.ts --dry-run           # Simular sin insertar
 *   npx tsx scripts/ingestar-papers.ts --skip-extraction   # Solo fetch + evaluar (sin DeepSeek)
 *   npx tsx scripts/ingestar-papers.ts --fuente pubmed-proteina,pubmed-composicion  # Fuentes específicas
 *   npx tsx scripts/ingestar-papers.ts --verbose           # Log detallado
 *
 * Para ejecución periódica (Vercel Cron Jobs o cron local):
 *   0 8 * * 1 cd /ruta/proyecto && npx tsx scripts/ingestar-papers.ts >> logs/ingesta.log 2>&1
 *
 * Requiere:
 *   - .env.local con SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL
 *   - DEEPSEEK_API_KEY (solo si no se usa --skip-extraction)
 */

import 'dotenv/config'
import { ejecutarIngesta, FUENTES_RSS } from '../lib/ingesta-papers'

// ── Parsear argumentos CLI ──────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipExtraction = args.includes('--skip-extraction')
const verbose = args.includes('--verbose')

const fuenteIdx = args.indexOf('--fuente')
const fuentesIds = fuenteIdx >= 0 && args[fuenteIdx + 1]
  ? args[fuenteIdx + 1].split(',').map(s => s.trim())
  : undefined

// ── Validar configuración ───────────────────────────────────────────
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables de entorno SUPABASE. Asegúrate de tener .env.local configurado.')
  process.exit(1)
}

if (!skipExtraction && !process.env.DEEPSEEK_API_KEY) {
  console.error('❌ DEEPSEEK_API_KEY no configurada. Usa --skip-extraction si solo quieres fetch RSS.')
  process.exit(1)
}

// ── Log inicial ─────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════')
console.log('🧠  Pipeline de Ingesta de Papers - NutriCoach')
console.log('═══════════════════════════════════════════════')
console.log('')
console.log(`📡 Fuentes activas:      ${fuentesIds ? fuentesIds.length : FUENTES_RSS.length}`)
console.log(`🔬 Extracción DeepSeek:  ${skipExtraction ? '❌ SKIP' : '✅ ACTIVA'}`)
console.log(`🧪 Dry run:              ${dryRun ? '✅ SÍ' : '❌ NO (insertará en BD)'}`)
console.log(`📝 Verbose:              ${verbose ? '✅ SÍ' : '❌ NO'}`)
console.log('')

if (fuentesIds) {
  console.log(`📌 Fuentes específicas: ${fuentesIds.join(', ')}`)
  console.log('')
}

// ── Ejecutar ingesta ────────────────────────────────────────────────
async function main() {
  const startTotal = Date.now()

  try {
    const resultado = await ejecutarIngesta({
      fuentesIds,
      skipExtraction,
      dryRun,
    })

    const elapsed = ((Date.now() - startTotal) / 1000).toFixed(1)

    console.log('')
    console.log('📊  RESULTADOS')
    console.log('────────────────────────────────────────')
    console.log(`   Fuentes consultadas:     ${resultado.fuentes_consultadas}`)
    console.log(`   Papers encontrados:      ${resultado.papers_encontrados}`)
    console.log(`   Papers extraídos:        ${resultado.papers_extraidos}`)
    console.log(`   Papers evaluados (>=7):  ${resultado.papers_evaluados}`)
    console.log(`   Papers incluídos (nuevos): ${resultado.papers_incluidos}`)
    console.log(`   Papers insertados:       ${resultado.papers_insertados}`)
    console.log(`   Duración total:          ${elapsed}s`)
    console.log('')

    if (resultado.errores.length > 0) {
      console.log('⚠️  ERRORES:')
      for (const err of resultado.errores) {
        console.log(`   • ${err}`)
      }
      console.log('')
    }

    if (dryRun) {
      console.log('🧪 Dry run completado — no se insertaron datos en la BD.')
    }

    console.log(`✅ Ingesta finalizada en ${elapsed}s`)
    process.exit(0)
  } catch (error) {
    console.error('')
    console.error('❌ Error fatal en el pipeline de ingesta:')
    console.error(error instanceof Error ? error.message : error)
    console.error('')
    process.exit(1)
  }
}

main()
