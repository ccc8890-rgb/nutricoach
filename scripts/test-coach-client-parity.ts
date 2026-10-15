import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const failures: string[] = []
const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message) }

const index = read('app/clientes/page.tsx')
const detail = read('app/clientes/[id]/page.tsx')
const toolbar = read('components/clientes/ClientesToolbar.tsx')
const table = read('components/clientes/ClientesTabla.tsx')
const mobile = read('components/clientes/ClientesListaMobile.tsx')
const css = read('app/globals.css')

expect(index.includes('coach-client-index'), 'el índice debe declarar el lenguaje visual de clientes')
expect(detail.includes('<CoachPage') && detail.includes('coach-client-detail'), 'la ficha debe usar CoachPage y el lenguaje visual de clientes')
expect(detail.includes('coach-client-hero'), 'la ficha debe usar una cabecera editorial propia')
expect(detail.includes('coach-client-tabs'), 'la ficha debe usar el rail de navegación compartido')
expect(toolbar.includes('coach-client-toolbar'), 'la toolbar debe usar el módulo editorial compartido')
expect(table.includes('coach-client-table'), 'la tabla debe usar el patrón editorial compartido')
expect(mobile.includes('coach-client-mobile-list'), 'la lista móvil debe usar el patrón editorial compartido')
expect(!table.includes('⚠') && !mobile.includes('⚠'), 'los avisos no deben representarse con emojis')
expect(!/text-\[(9|10)px\]/.test(table + mobile), 'la información principal no debe bajar de 11px')
for (const className of ['.coach-client-hero', '.coach-client-toolbar', '.coach-client-table', '.coach-client-tabs']) {
  expect(css.includes(className), `falta ${className} en globals.css`)
}

if (failures.length) {
  console.error(`coach client parity: FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('coach client parity: 12 contracts PASS')
