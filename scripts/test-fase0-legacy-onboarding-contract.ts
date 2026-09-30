import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')

function main() {
  const legacyPage = read('app/onboarding/perfil/page.tsx')
  const legacyPost = read('app/api/onboarding/perfil/route.ts')
  const legacyPostBody = legacyPost.split('export async function POST')[1]
  const activeOnboarding = read('app/onboarding/page.tsx')
  const generationClient = read('lib/planes/generation-client.ts')

  assert.match(legacyPage, /router\.replace\('\/onboarding'\)/)

  assert.match(legacyPost, /codigo: 'LEGACY_ONBOARDING_ROUTE_RETIRED'/)
  assert.match(legacyPost, /accion: 'Usa \/onboarding para completar tu perfil\.'/)
  assert.match(legacyPost, /status: 410/)
  assert.ok(legacyPostBody)
  assert.doesNotMatch(legacyPostBody, /createApiSupabase|createServiceSupabase|guardarDietaHabitualCliente/)
  assert.doesNotMatch(legacyPostBody, /\.from\(|\.upsert\(|\.update\(/)

  assert.match(activeOnboarding, /generarPlanInicialDesdeCliente/)
  assert.match(activeOnboarding, /async function reintentarGeneracion\(\)/)
  assert.match(activeOnboarding, /Reintentar creación del plan/)
  assert.match(generationClient, /credentials: 'include'/)
  assert.match(generationClient, /origen: 'onboarding'/)

  console.log('fase0 legacy onboarding contract tests passed')
}

main()
