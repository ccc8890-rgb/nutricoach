import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// El menú del coach ya no tiene «Control»: costes y rentabilidad viven en Compra y costes.
const sidebar = readFileSync('components/Sidebar.tsx', 'utf8')
assert.ok(!sidebar.includes('CONTROL_ITEMS'), 'Sidebar no debe tener CONTROL_ITEMS')
assert.ok(!sidebar.includes("key: 'control'"), 'Sidebar no debe tener la sección control')

const compra = sidebar.slice(sidebar.indexOf('const COMPRA_ITEMS'), sidebar.indexOf('\n]', sidebar.indexOf('const COMPRA_ITEMS')))
for (const href of ['/compra', '/precios', '/precios/escandallo', '/precios/rentabilidad']) {
  assert.ok(compra.includes(`'${href}'`), `COMPRA_ITEMS debe incluir ${href}`)
}
const recetario = sidebar.slice(sidebar.indexOf('const RECETARIO_ITEMS'), sidebar.indexOf('\n]', sidebar.indexOf('const RECETARIO_ITEMS')))
assert.ok(recetario.includes("'/recetas/revisar'"), 'RECETARIO_ITEMS debe seguir incluyendo Revisión')

const shell = readFileSync('components/CoachShell.tsx', 'utf8')
assert.ok(!shell.includes("area: 'Control'"), 'CoachShell no debe usar el área Control')
console.log('menu-recetario OK')
