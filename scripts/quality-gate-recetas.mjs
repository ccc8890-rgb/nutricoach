#!/usr/bin/env node
// Wrapper legacy: la lógica real vive en scripts/quality-gate-recetas.ts.
import { spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const result = spawnSync('npx', ['tsx', 'scripts/quality-gate-recetas.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: ROOT,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
