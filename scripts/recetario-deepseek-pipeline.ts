/**
 * Pipeline barato y escalable para lotes DeepSeek:
 * 1. valida JSON
 * 2. importa solo si valida
 * 3. repara/matchea ingredientes con scope por lote y coach
 * 4. ejecuta quality gate
 *
 * Uso:
 *   npm run recetas:pipeline -- scripts/lote.json --coach-email coach@email.com
 *   npm run recetas:pipeline -- scripts/lote.json --coach-id uuid --skip-quality-gate
 */
import { spawnSync } from 'node:child_process'

type Args = {
  file?: string
  coachId?: string
  coachEmail?: string
  skipQualityGate: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const parsed: Args = { skipQualityGate: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--coach-id') {
      parsed.coachId = args[++i]
      continue
    }
    if (arg === '--coach-email') {
      parsed.coachEmail = args[++i]
      continue
    }
    if (arg === '--skip-quality-gate') {
      parsed.skipQualityGate = true
      continue
    }
    if (!arg.startsWith('--')) {
      parsed.file = arg
      continue
    }
    throw new Error(`Argumento no reconocido: ${arg}`)
  }

  return parsed
}

function run(label: string, command: string, args: string[]) {
  console.log(`\n▶ ${label}`)
  console.log(`$ ${[command, ...args].join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${label} falló con código ${result.status ?? 'desconocido'}`)
  }
}

function coachArgs(args: Args) {
  if (args.coachId) return ['--coach-id', args.coachId]
  if (args.coachEmail) return ['--coach-email', args.coachEmail]
  return []
}

async function main() {
  const args = parseArgs()
  if (!args.file) {
    console.error('Uso: npm run recetas:pipeline -- scripts/lote.json --coach-email coach@email.com')
    process.exit(1)
  }

  const runner = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const common = ['tsx']
  const coach = coachArgs(args)

  run('Validar lote DeepSeek', runner, [...common, 'scripts/validar-lote-deepseek.ts', args.file])
  run('Importar recetas en revisión', runner, [...common, 'scripts/importar-lote-deepseek.ts', args.file, ...coach])
  run('Reparar y vincular ingredientes del lote', runner, [...common, 'scripts/reparar-lote-deepseek-recetas.ts', args.file, ...coach])

  if (!args.skipQualityGate) {
    run('Quality gate del recetario', 'node', ['scripts/quality-gate-recetas.mjs', '--json'])
  }

  console.log('\n✅ Pipeline completado. Las recetas quedan en estado en_revision para revisión humana antes de aprobar.')
}

main().catch(error => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
