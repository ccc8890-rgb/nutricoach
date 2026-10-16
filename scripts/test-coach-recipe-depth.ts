import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/recetas/page.tsx', 'coach-recipe-library'],
  ['app/recetas/[id]/page.tsx', 'coach-recipe-detail'],
  ['app/recetas/[id]/editar/page.tsx', 'coach-recipe-editor'],
  ['app/recetas/nueva/page.tsx', 'coach-recipe-create'],
  ['app/recetas/auditoria/page.tsx', 'coach-recipe-audit'],
  ['app/recetas/cobertura/page.tsx', 'coach-recipe-coverage'],
  ['app/recetas/(revision)/imagenes/page.tsx', 'coach-recipe-images'],
  ['app/recetas/(revision)/revisar/page.tsx', 'coach-recipe-review'],
]
for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)

const css = read('app/globals.css')
for (const selector of ['.coach-recipe-detail > div:first-child', '.coach-recipe-editor .card', '.coach-recipe-create .card', '.coach-recipe-audit table', '.coach-recipe-coverage section', '.coach-recipe-images section', '.coach-recipe-review article']) {
  expect(css.includes(selector), `falta ${selector} en globals.css`)
}

if (failures.length) {
  console.error(`coach recipe depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach recipe depth: 15 contracts PASS')
