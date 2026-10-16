import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/dietas/[id]/page.tsx', 'coach-diet-macro-editor'],
  ['app/dietas/[id]/page.tsx', 'coach-diet-audit-rail'],
  ['app/dietas/[id]/page.tsx', 'coach-diet-day-grid'],
  ['app/dietas/[id]/page.tsx', 'coach-diet-meal-card'],
  ['app/dietas/alimentos/page.tsx', 'coach-food-filters'],
  ['app/dietas/alimentos/page.tsx', 'coach-food-card'],
  ['app/dietas/plantillas/page.tsx', 'coach-diet-templates'],
  ['app/dietas/plantillas/page.tsx', 'coach-diet-template-card'],
  ['app/dietas/nueva/page.tsx', 'coach-new-diet'],
  ['app/dietas/nueva/page.tsx', 'coach-tmb-panel'],
]
for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)

const create = read('app/dietas/nueva/page.tsx')
expect(!create.includes("backgroundColor: '#f0fdf4'"), 'el panel TMB no debe mantener fondo claro hardcodeado')
const css = read('app/globals.css')
for (const className of ['.coach-diet-macro-editor', '.coach-diet-audit-rail', '.coach-food-filters', '.coach-diet-templates', '.coach-new-diet']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach diet workspace depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach diet workspace depth: 16 contracts PASS')
