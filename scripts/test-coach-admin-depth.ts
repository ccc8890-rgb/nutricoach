import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/cuestionarios/page.tsx', 'coach-questionnaires'],
  ['app/respuestas/page.tsx', 'coach-responses'],
  ['components/CuestionarioCreador.tsx', 'coach-questionnaire-builder'],
  ['components/RespuestasClientes.tsx', 'coach-responses-list'],
  ['components/ajustes/AjustesPanel.tsx', 'coach-settings'],
]
for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)

const css = read('app/globals.css')
for (const selector of ['.coach-questionnaires', '.coach-questionnaire-builder .card', '.coach-responses-list .card', '.coach-settings > div > section']) {
  expect(css.includes(selector), `falta ${selector} en globals.css`)
}

if (failures.length) {
  console.error(`coach admin depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach admin depth: 9 contracts PASS')
