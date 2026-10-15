import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['components/AdminPrecios.tsx', 'coach-price-admin'],
  ['app/precios/escandallo/page.tsx', 'coach-costing-page'],
  ['app/precios/rentabilidad/page.tsx', 'coach-profitability-page'],
  ['components/EscandalloReceta.tsx', 'coach-recipe-costing'],
  ['components/DashboardRentabilidad.tsx', 'coach-profitability-dashboard'],
  ['components/ComparadorSupermercados.tsx', 'coach-supermarket-comparison'],
  ['app/compra/page.tsx', 'coach-shopping-page'],
  ['components/ListaCompra.tsx', 'coach-shopping-card'],
]

for (const [file, className] of contracts) {
  expect(read(file).includes(className), `${file} debe declarar ${className}`)
}

const css = read('app/globals.css')
for (const className of ['.coach-price-admin', '.coach-costing-page', '.coach-profitability-page', '.coach-shopping-page']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach commerce parity: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach commerce parity: 12 contracts PASS')
