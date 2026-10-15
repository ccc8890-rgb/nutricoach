import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const hub = read('app/nutricion/page.tsx')
const plans = read('app/dietas/page.tsx')
const editor = read('app/dietas/[id]/page.tsx')
const foods = read('app/dietas/alimentos/page.tsx')
const css = read('app/globals.css')

expect(hub.includes('coach-nutrition-hub'), 'el hub debe usar el sistema editorial de nutrición')
expect(hub.includes('coach-module-link'), 'los accesos deben ser filas operativas, no tarjetas genéricas')
expect(plans.includes('coach-diet-index') && plans.includes('coach-plan-row'), 'el listado de planes debe compartir el patrón editorial')
expect(editor.includes('coach-diet-editor'), 'el editor debe declarar su superficie de trabajo')
expect(editor.includes('coach-diet-header'), 'el editor debe tener cabecera técnica')
expect(foods.includes('coach-food-library'), 'alimentos debe integrarse en el mismo sistema')
for (const name of ['.coach-nutrition-hub', '.coach-module-link', '.coach-diet-editor', '.coach-food-library']) {
  expect(css.includes(name), `falta ${name} en globals.css`)
}

if (failures.length) {
  console.error(`coach nutrition parity: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach nutrition parity: 10 contracts PASS')
