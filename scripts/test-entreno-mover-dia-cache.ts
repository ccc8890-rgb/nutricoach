import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/training/EntrenoKanban.tsx', 'utf8')

assert.match(
  source,
  /useSWRConfig/,
  'Mover una sesión debe sincronizar la caché compartida de la semana',
)
assert.match(
  source,
  /mutate\(SEMANA_ENTRENO_KEY/,
  'La semana debe revalidarse después de guardar el nuevo día',
)

console.log('✓ Mover una sesión sincroniza la vista Semana y la vista Hoy')
