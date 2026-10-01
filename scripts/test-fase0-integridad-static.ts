import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (ruta: string) => readFileSync(join(__dirname, '..', ruta), 'utf8')

const [onboardingCompleto, onboardingPerfil, generador, generacionLib, executor, tareasRoute, aprobarRoute, coachInsights] =
  [
    leer('app/api/onboarding/completo/route.ts'),
    leer('app/api/onboarding/perfil/route.ts'),
    leer('app/api/generar-plan-inicial/route.ts'),
    leer('lib/planes/generacion-inicial.ts'),
    leer('lib/agentes/executor.ts'),
    leer('app/api/agentes/tareas/route.ts'),
    leer('app/api/aprobar-cliente/route.ts'),
    leer('lib/actividad/coach-insights.ts'),
  ]

// Task 3: sin self-fetch del generador desde onboarding
assert.doesNotMatch(onboardingCompleto, /NEXT_PUBLIC_APP_URL[\s\S]*generar-plan-inicial/)
assert.doesNotMatch(onboardingPerfil, /NEXT_PUBLIC_APP_URL[\s\S]*generar-plan-inicial/)

// Task 2: claim idempotente, planes como borrador y activación final
assert.match(generador, /reclamarGeneracionInicial/)
assert.match(generacionLib, /claim_generacion_plan_inicial/)
assert.match(generador, /activo:\s*false/)
assert.match(generador, /activar_planes_generacion/)

// Task 5: ningún agente autoaplica sin aprobación del coach
assert.doesNotMatch(executor, /if\s*\(!resultado\.requiere_aprobacion\)[\s\S]*aplicarTarea/)

// Task 4: ownership coach–cliente al decidir tareas y planes activos al aprobar
assert.match(tareasRoute, /autorizarCoachCliente/)
assert.match(aprobarRoute, /ACTIVE_PLANS_REQUIRED/)

// Task 6: la salud de fuentes condiciona los flags de actividad
assert.match(coachInsights, /evaluarSaludFuente/)
assert.match(coachInsights, /puedeInterpretarAusencia/)

console.log('fase0 static integrity tests passed')
