import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/clientes/nuevo/page.tsx', 'coach-client-create'],
  ['app/clientes/nuevo/page.tsx', 'coach-client-create__section'],
  ['app/clientes/[id]/revisar-plan/page.tsx', 'coach-client-review'],
  ['app/clientes/[id]/revisar-rapido/page.tsx', 'coach-client-quick-review'],
]
for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)

const css = read('app/globals.css')
for (const className of ['.coach-client-create', '.coach-client-create__section', '.coach-client-review', '.coach-client-quick-review']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach client onboarding depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach client onboarding depth: 8 contracts PASS')
