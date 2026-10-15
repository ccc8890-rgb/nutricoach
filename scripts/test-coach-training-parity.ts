import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const command = read('app/entrenos/page.tsx')
const plan = read('app/entrenos/[id]/page.tsx')
const templates = read('app/entrenos/plantillas/page.tsx')
const exercises = read('app/entrenos/ejercicios/page.tsx')
const timeline = read('components/training/PlanTimeline.tsx')
const css = read('app/globals.css')

expect(command.includes("redirect('/entrenos/plantillas')") || command.includes('coach-training-command'), 'la entrada debe respetar el flujo actual o usar el sistema editorial')
expect(command.includes("redirect('/entrenos/plantillas')") || command.includes('coach-training-cockpit'), 'el command center activo debe tener cockpit técnico')
expect(plan.includes('coach-training-plan'), 'el editor de plan debe usar la superficie técnica')
expect(templates.includes('coach-training-templates'), 'plantillas debe compartir sistema')
expect(exercises.includes('coach-exercise-library'), 'ejercicios debe compartir sistema')
expect(timeline.includes('coach-plan-timeline'), 'timeline debe declarar el patrón técnico')
for (const name of ['.coach-training-command', '.coach-training-cockpit', '.coach-training-plan', '.coach-exercise-library']) {
  expect(css.includes(name), `falta ${name} en globals.css`)
}

if (failures.length) {
  console.error(`coach training parity: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach training parity: 10 contracts PASS')
