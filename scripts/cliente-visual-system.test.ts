import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const page = readFileSync(resolve(root, 'app/cliente/page.tsx'), 'utf8')
const styles = readFileSync(resolve(root, 'app/cliente/cliente.css'), 'utf8')

assert.match(page, /import ['"]\.\/cliente\.css['"]/, 'El portal cliente debe cargar estilos aislados')
assert.match(page, /cliente-portal-shell/, 'El portal cliente debe tener un scope visual propio')
assert.match(styles, /\.cliente-portal-shell/, 'Los estilos deben quedar limitados al portal cliente')
assert.match(styles, /prefers-reduced-motion/, 'El portal debe respetar movimiento reducido')
assert.match(styles, /focus-visible/, 'La navegación debe conservar foco visible')
assert.match(page, /cliente-header-hidden/, 'La cabecera debe poder replegarse al hacer scroll')
assert.match(page, /addEventListener\(['"]scroll['"]/, 'La cabecera debe reaccionar a la dirección del scroll')
assert.match(styles, /translate3d\(0, calc\(-100% - 1px\), 0\)/, 'La cabecera replegada debe liberar campo visual')

console.log('cliente-visual-system: OK')
