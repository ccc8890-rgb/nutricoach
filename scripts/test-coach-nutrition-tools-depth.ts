import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['components/AjusteMacrosIA.tsx', 'coach-macro-adjustment'],
  ['components/AjusteMacrosIA.tsx', 'coach-macro-comparison'],
  ['components/HistorialDietasIA.tsx', 'coach-diet-history'],
  ['components/PeriodizacionPanel.tsx', 'coach-periodization-panel'],
  ['components/clientes/SuplementacionPanel.tsx', 'coach-supplement-panel'],
  ['components/clientes/SuplementacionPanel.tsx', 'coach-supplement-card'],
]
for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)

const macro = read('components/AjusteMacrosIA.tsx')
expect(!macro.includes("background: '#FEF2F2'"), 'el ajuste IA no debe conservar paneles claros hardcodeados')
expect(!macro.includes("background: '#FAFAFA'"), 'la comparativa no debe conservar tarjetas claras hardcodeadas')

const css = read('app/globals.css')
for (const className of ['.coach-macro-adjustment', '.coach-diet-history', '.coach-periodization-panel', '.coach-supplement-panel']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach nutrition tools depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach nutrition tools depth: 12 contracts PASS')
