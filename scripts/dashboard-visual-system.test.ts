import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const page = readFileSync(resolve(root, 'app/dashboard/page.tsx'), 'utf8')
const styles = readFileSync(resolve(root, 'app/dashboard/dashboard.css'), 'utf8')

assert.match(page, /import ['"]\.\/dashboard\.css['"]/, 'El dashboard debe cargar estilos aislados')
assert.match(page, /coach-dashboard-shell/, 'El dashboard debe tener un scope visual propio')
assert.match(styles, /\.coach-dashboard-shell/, 'Los estilos deben quedar limitados al dashboard')
assert.match(styles, /prefers-reduced-motion/, 'El acabado visual debe respetar movimiento reducido')
assert.match(styles, /focus-visible/, 'Los controles deben conservar foco visible')

console.log('dashboard-visual-system: OK')
