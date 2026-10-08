import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const globals = readFileSync(resolve(root, 'app/globals.css'), 'utf8')
const layout = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8')
const shell = readFileSync(resolve(root, 'components/CoachShell.tsx'), 'utf8')
const sidebar = readFileSync(resolve(root, 'components/Sidebar.tsx'), 'utf8')

assert.match(globals, /--atelier-accent:/, 'La paleta global debe declarar el acento Atelier')
assert.match(globals, /--atelier-paper:/, 'La paleta global debe declarar el tono papel')
assert.match(layout, /Instrument_Sans/, 'La interfaz debe usar Instrument Sans')
assert.match(shell, /coach-atelier-shell/, 'El shell del coach debe usar el lenguaje Atelier')
assert.match(sidebar, /coach-atelier-sidebar/, 'El sidebar debe tener tratamiento Atelier')
assert.match(globals, /prefers-reduced-motion/, 'El sistema debe respetar movimiento reducido')

console.log('performance-atelier: OK')
