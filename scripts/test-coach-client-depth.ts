import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const detail = read('app/clientes/[id]/page.tsx')
const summary = read('components/clientes/ResumenCliente.tsx')
const adherence = read('components/clientes/AdherenciaScore.tsx')
const heatmap = read('components/clientes/MealAdherenciaHeatmap.tsx')
const planner = read('components/clientes/SemanaDietaPlanner.tsx')
const cost = read('components/clientes/CosteSemanal.tsx')
const micro = read('components/clientes/MicronutrientesCoach.tsx')
const css = read('app/globals.css')

for (const [source, className] of [
  [detail, 'coach-client-overview'],
  [detail, 'coach-client-nutrition'],
  [detail, 'coach-work-card'],
  [detail, 'coach-tools-toggle'],
  [summary, 'coach-summary-panel'],
  [adherence, 'coach-adherence-score'],
  [heatmap, 'coach-meal-heatmap'],
  [planner, 'coach-diet-planner'],
  [cost, 'coach-nutrition-module'],
  [micro, 'coach-nutrition-module'],
] as const) expect(source.includes(className), `falta ${className} en su componente`)

expect(css.includes('font-family: var(--font-instrument)'), 'la navegación coach debe usar la tipografía de interfaz')
for (const className of ['.coach-client-section', '.coach-work-card', '.coach-summary-panel', '.coach-diet-planner', '.coach-nutrition-module']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach client depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach client depth: 16 contracts PASS')
