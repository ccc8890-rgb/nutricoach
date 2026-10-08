import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { limpiarPerfil } from '../lib/ajustes/perfil'

const ok = (b: unknown) => { const r = limpiarPerfil(b); assert.equal(r.ok, true, JSON.stringify(r)); return (r as { ok: true; cambios: Record<string, unknown> }).cambios }
const mal = (b: unknown) => assert.equal(limpiarPerfil(b).ok, false, JSON.stringify(b))

assert.deepEqual(ok({ nombre: '  Carlos ', apellidos: ' Casanova Cordero', telefono: '+34 600 123 456' }), {
  nombre: 'Carlos', apellidos: 'Casanova Cordero', telefono: '+34 600 123 456',
})
assert.deepEqual(ok({ telefono: '' }), { telefono: null })
assert.deepEqual(ok({ apellidos: '' }), { apellidos: null })
assert.deepEqual(ok({}), {})

// El rol, el correo y el id nunca se aceptan desde aquí
assert.deepEqual(ok({ nombre: 'Carlos', role: 'admin', email: 'x@y.z', id: 'abc' }), { nombre: 'Carlos' })

// Entradas inválidas
mal(null)
mal('texto')
mal({ nombre: '' })
mal({ nombre: '   ' })
mal({ nombre: 'a'.repeat(81) })
mal({ apellidos: 'a'.repeat(81) })
mal({ telefono: 'abc' })
mal({ telefono: '1'.repeat(30) })
mal({ nombre: 123 })

const root = resolve(import.meta.dirname, '..')
const sidebar = readFileSync(resolve(root, 'components/Sidebar.tsx'), 'utf8')
const panel = readFileSync(resolve(root, 'components/ajustes/AjustesPanel.tsx'), 'utf8')
const estilos = readFileSync(resolve(root, 'components/ajustes/ajustes.css'), 'utf8')

assert.match(sidebar, /ajustesActivo \? 'sidebar-link active w-full'/, 'Ajustes debe recibir el mismo estado activo que el resto del menú')
assert.match(panel, /className="ajustes-input/, 'Los campos de Ajustes deben usar un tratamiento visual propio')
assert.match(estilos, /\.ajustes-input/, 'Los campos deben diferenciarse de la superficie de la tarjeta')
assert.match(estilos, /focus-visible/, 'Los campos deben conservar un foco claramente visible')

console.log('ajustes-perfil: ok')
