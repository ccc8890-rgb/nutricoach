import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const callers = [
  'app/clientes/[id]/revisar-plan/page.tsx',
  'app/clientes/[id]/revisar-rapido/page.tsx',
]

async function main() {
  for (const path of callers) {
    const source = await readFile(path, 'utf8')
    const regenerationHandler = source.match(/const regenera\w* = async \(\) => \{[\s\S]*?\n  \}/)?.[0]

    assert.ok(regenerationHandler, `${path}: no se encontró el handler de regeneración`)
    assert.match(
      regenerationHandler,
      /const idempotencyKey = `coach:\$\{crypto\.randomUUID\(\)\}`/,
      `${path}: cada acción debe crear una clave de intento nueva`,
    )
    assert.match(
      regenerationHandler,
      /idempotency_key:\s*idempotencyKey/,
      `${path}: el payload debe enviar la clave del intento`,
    )
  }

  console.log('fase0 generation caller contract tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
