import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const contracts: Array<[string, string]> = [
  ['app/precios/escandallo/page.tsx', 'coach-costing-page'],
  ['app/precios/rentabilidad/page.tsx', 'coach-profitability-page'],
  ['app/compra/page.tsx', 'coach-shopping-page'],
  ['components/AdminPrecios.tsx', 'coach-price-admin'],
  ['components/DashboardRentabilidad.tsx', 'coach-profitability-dashboard'],
  ['components/ComparadorSupermercados.tsx', 'coach-supermarket-comparison'],
  ['components/ListaCompra.tsx', 'coach-shopping-card'],
  ['components/lista-compra/SelectorComparativa.tsx', 'coach-shopping-compare'],
]
for (const [file, className] of contracts) expect(read(file).includes(className), `${file} debe declarar ${className}`)

const css = read('app/globals.css')
for (const selector of ['.coach-costing-page > div:first-child', '.coach-profitability-dashboard table', '.coach-shopping-page > div:first-child', '.coach-shopping-compare', '.coach-price-admin .card']) {
  expect(css.includes(selector), `falta ${selector} en globals.css`)
}

if (failures.length) {
  console.error(`coach commerce depth: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('coach commerce depth: 13 contracts PASS')
