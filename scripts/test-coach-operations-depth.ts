import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/coach/metodologia/page.tsx', 'coach-methodology'],
  ['app/conocimiento/page.tsx', 'coach-knowledge'],
  ['app/conocimiento/nueva/page.tsx', 'coach-knowledge-create'],
  ['app/contenido/page.tsx', 'coach-content-studio'],
  ['components/contenido/BandejaIdeas.tsx', 'coach-content-inbox'],
  ['components/contenido/DiaGrabacion.tsx', 'coach-content-shoot'],
  ['components/contenido/TableroContenido.tsx', 'coach-content-board'],
  ['components/contenido/CalendarioContenido.tsx', 'coach-content-calendar'],
]
for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)

const css = read('app/globals.css')
for (const selector of ['.coach-methodology', '.coach-knowledge .card', '.coach-knowledge-create .card', '.coach-content-studio', '.coach-content-board section']) {
  expect(css.includes(selector), `falta ${selector} en globals.css`)
}

if (failures.length) {
  console.error(`coach operations depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach operations depth: 13 contracts PASS')
